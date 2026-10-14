import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = ["localizing", "valid", "lost"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const bad = (reason: string) => NextResponse.json({ reason }, { status: 422 });

function tokenOk(given: string | null) {
  const expected = process.env.DEVICE_TOKEN;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// POST /api/poses: the phone sends its VPS pose; the server converts and stores it.
export async function POST(request: Request) {
  if (!tokenOk(request.headers.get("x-device-token"))) {
    return NextResponse.json({ reason: "bad token" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return bad("body is not valid JSON");
  }

  const {
    sample_id, map_version_id, device_id, provider_map_id,
    provider_pose, tracking_status, captured_at, attempt_id,
  } = body ?? {};

  if (!UUID.test(sample_id ?? "")) return bad("sample_id must be a uuid");
  if (!UUID.test(map_version_id ?? "")) return bad("map_version_id must be a uuid");
  if (typeof device_id !== "string" || !device_id || device_id.length > 120)
    return bad("device_id must be 1-120 characters");
  if (!STATUSES.includes(tracking_status))
    return bad("tracking_status must be localizing, valid or lost");

  const p = provider_pose?.position;
  const r = provider_pose?.rotation;
  if (!p || !isNum(p.x) || !isNum(p.y) || !isNum(p.z))
    return bad("provider_pose.position needs numeric x, y, z");
  if (!r || !isNum(r.x) || !isNum(r.y) || !isNum(r.z) || !isNum(r.w))
    return bad("provider_pose.rotation needs numeric x, y, z, w");

  const when = new Date(captured_at);
  if (Number.isNaN(when.getTime())) return bad("captured_at must be an ISO timestamp");
  if (when.getTime() > Date.now() + 60_000) return bad("captured_at is in the future");

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ reason: "server not configured" }, { status: 500 });
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: map, error: mapErr } = await db
    .from("map_versions")
    .select("map_version_id, vps_map_id")
    .eq("map_version_id", map_version_id)
    .eq("publication_state", "published")
    .maybeSingle();
  if (mapErr) return NextResponse.json({ reason: mapErr.message }, { status: 500 });
  if (!map) return bad("unknown or unpublished map_version_id");
  if (map.vps_map_id && provider_map_id && provider_map_id !== map.vps_map_id)
    return bad("provider_map_id does not match this map version");

  // Unity is left-handed, the database world frame is right-handed (y up): negate z.
  const world_position = { x_m: p.x, y_m: p.y, z_m: -p.z };

  // Facing direction from the quaternion. 0 = world +Z, positive toward world +X.
  const fx = 2 * (r.x * r.z + r.w * r.y);
  const fz = 1 - 2 * (r.x * r.x + r.y * r.y);
  const heading_deg = (((Math.atan2(fx, -fz) * 180) / Math.PI) % 360 + 360) % 360;

  const { error } = await db.from("pose_samples").insert({
    sample_id,
    map_version_id,
    attempt_id: attempt_id ?? null,
    device_id,
    provider_map_id: provider_map_id ?? null,
    provider_pose,
    world_position,
    heading_deg,
    tracking_status,
    data_origin: "real",
    captured_at: when.toISOString(),
  });

  if (error) {
    // Same sample_id sent again (a retry): already stored, report success.
    if (error.code === "23505")
      return NextResponse.json({ sample_id, world_position }, { status: 200 });
    if (error.code === "23503") return bad("unknown attempt_id");
    return NextResponse.json({ reason: error.message }, { status: 500 });
  }
  return NextResponse.json({ sample_id, world_position }, { status: 201 });
}
