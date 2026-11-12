import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { poseOrigin } from "@/lib/spatial/poseOrigin";
import { poseFields, TRACKING_STATUSES } from "@/lib/spatial/poseFields";
import { deviceTokenOk } from "@/lib/spatial/server/deviceToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bad = (reason: string) => NextResponse.json({ reason }, { status: 422 });

// POST /api/poses: the phone sends its VPS pose; the server converts and stores it.
export async function POST(request: Request) {
  if (!deviceTokenOk(request.headers.get("x-device-token"))) {
    return NextResponse.json({ reason: "bad token" }, { status: 401 });
  }

 // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await request.json();
  } catch {
    return bad("body is not valid JSON");
  }

  const {
    sample_id, map_version_id, device_id, provider_map_id,
    provider_pose, tracking_status, captured_at, attempt_id, data_origin,
  } = body ?? {};

  if (!UUID.test(sample_id ?? "")) return bad("sample_id must be a uuid");
  if (!UUID.test(map_version_id ?? "")) return bad("map_version_id must be a uuid");
  if (typeof device_id !== "string" || !device_id || device_id.length > 120)
    return bad("device_id must be 1-120 characters");
  if (!TRACKING_STATUSES.includes(tracking_status))
    return bad("tracking_status must be localizing, valid or lost");

  // Only valid samples carry a position; localizing and lost are status reports (R4.1).
  const fields = poseFields(tracking_status, provider_pose);
  if ("reason" in fields) return bad(fields.reason);

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

  const { world_position } = fields;

  const { error } = await db.from("pose_samples").insert({
    sample_id,
    map_version_id,
    attempt_id: attempt_id ?? null,
    device_id,
    provider_map_id: provider_map_id ?? null,
    provider_pose: fields.provider_pose,
    world_position,
    heading_deg: fields.heading_deg,
    tracking_status,
    // Fake-test poses (Send Fake Pose in Unity) must never be stored as real localizations.
    data_origin: poseOrigin(device_id, data_origin),
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
