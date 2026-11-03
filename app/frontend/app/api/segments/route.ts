import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applySegmentAction, isSegmentAction } from "@/lib/spatial/segmentChange";
import { tokenMatches } from "@/lib/spatial/server/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = (reason: string, status = 422) => NextResponse.json({ reason }, { status });

// PATCH /api/segments: the operator closes, reopens or restricts one path segment
// (R8.1, R8.2, R17.1). Routes on /live pick the change up within 3 s (R8.3, R9).
export async function PATCH(request: Request) {
  if (!tokenMatches(request.headers.get("x-operator-token"), process.env.OPERATOR_TOKEN)) {
    return bad("bad operator token", 401);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await request.json();
  } catch {
    return bad("body is not valid JSON");
  }
  const { segment_id, action } = body ?? {};
  if (!UUID.test(segment_id ?? "")) return bad("segment_id must be a uuid");
  if (!isSegmentAction(action)) return bad("action must be close, reopen, humans_only or allow_robots");

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return bad("server not configured", 500);
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: segment, error: readErr } = await db
    .from("path_segments")
    .select("segment_id, map_version_id, label, availability, robot_access")
    .eq("segment_id", segment_id)
    .maybeSingle();
  if (readErr) return bad(readErr.message, 500);
  if (!segment) return bad("unknown segment_id", 404);

  const next = applySegmentAction(segment, action);
  if (next.availability === segment.availability && next.robot_access === segment.robot_access) {
    return NextResponse.json({ ...segment, changed: false }, { status: 200 });
  }

  // Bump the map's path state revision so every change has its own number.
  const { data: map, error: mapErr } = await db
    .from("map_versions")
    .select("current_path_state_revision")
    .eq("map_version_id", segment.map_version_id)
    .single();
  if (mapErr) return bad(mapErr.message, 500);
  const revision = map.current_path_state_revision + 1;
  const { data: bumped, error: bumpErr } = await db
    .from("map_versions")
    .update({ current_path_state_revision: revision })
    .eq("map_version_id", segment.map_version_id)
    .eq("current_path_state_revision", map.current_path_state_revision)
    .select("map_version_id");
  if (bumpErr) return bad(bumpErr.message, 500);
  if (!bumped || bumped.length === 0) return bad("another change landed first, try again", 409);

  const { error: writeErr } = await db
    .from("path_segments")
    .update({ ...next, last_state_revision: revision })
    .eq("segment_id", segment_id);
  if (writeErr) return bad(writeErr.message, 500);

  // Until path events are stored (PathEvent), the server log is the record of who changed what.
  console.info(`[operator] ${segment.label}: ${action} (revision ${revision})`);
  return NextResponse.json({ ...segment, ...next, last_state_revision: revision, changed: true }, { status: 200 });
}
