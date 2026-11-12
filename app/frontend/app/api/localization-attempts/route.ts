import { createHandlers } from "@/lib/spatial/server/handlers";
import { createSpatialRepository } from "@/lib/spatial/server/repository";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { parseLiveAttempt } from "@/lib/spatial/attemptIngest";
import { deviceTokenOk } from "@/lib/spatial/server/deviceToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createHandlers(createSpatialRepository).attempts;

export async function POST(request: Request) {
  if (!deviceTokenOk(request.headers.get("x-device-token"))) {
    return NextResponse.json({ reason: "bad token" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ reason: "body is not valid JSON" }, { status: 422 });
  }
  const parsed = parseLiveAttempt(body);
  if ("reason" in parsed) {
    return NextResponse.json({ reason: parsed.reason }, { status: 422 });
  }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ reason: "server not configured" }, { status: 500 });
  }
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db.rpc("m4_record_live_attempt", { p_attempt: parsed.value });
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ reason: "attempt_id already belongs to different data" }, { status: 409 });
    }
    if (["22023", "23503", "23514", "22P02", "22007", "22003"].includes(error.code)) {
      return NextResponse.json({ reason: "attempt or test point is invalid" }, { status: 422 });
    }
    return NextResponse.json({ reason: "could not save attempt" }, { status: 500 });
  }
  return NextResponse.json(data, { status: data?.created ? 201 : 200 });
}
