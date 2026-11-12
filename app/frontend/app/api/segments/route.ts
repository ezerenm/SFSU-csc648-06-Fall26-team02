import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applySegmentAction, isSegmentAction } from "@/lib/spatial/segmentChange";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = (reason: string, status = 422) => NextResponse.json({ reason }, { status });

// PATCH /api/segments: the operator closes, reopens or restricts one path segment
// (R8.1, R8.2, R17.1). Routes on /live pick the change up within 3 s (R8.3, R9).
export async function PATCH(request: Request) {
  const match = /^Bearer ([^\s]+)$/.exec(request.headers.get("authorization") ?? "");
  if (!match) return bad("sign in required", 401);

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
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return bad("server not configured", 500);
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${match[1]}` } },
  });
  const { data: identity, error: authError } = await db.auth.getUser(match[1]);
  if (authError || !identity.user) return bad("sign in required", 401);

  const { data: segment, error: readErr } = await db
    .from("path_segments")
    .select("segment_id, map_version_id, label, availability, robot_access, last_state_revision")
    .eq("segment_id", segment_id)
    .maybeSingle();
  if (readErr) return bad("could not read segment", 500);
  if (!segment) return bad("unknown segment_id", 404);

  const { data: map, error: mapErr } = await db.from("map_versions")
    .select("site_id").eq("map_version_id", segment.map_version_id).maybeSingle();
  if (mapErr) return bad("could not read map", 500);
  if (!map) return bad("unknown map version", 404);
  const { data: membership, error: membershipErr } = await db.from("site_memberships")
    .select("role").eq("site_id", map.site_id).eq("user_id", identity.user.id)
    .eq("is_active", true).maybeSingle();
  if (membershipErr) return bad("could not check site role", 500);
  if (!membership || !["operator", "administrator"].includes(membership.role)) {
    return bad("operator or administrator role required", 403);
  }

  const next = applySegmentAction(segment, action);
  if (next.availability === segment.availability && next.robot_access === segment.robot_access) {
    return NextResponse.json({ ...segment, changed: false }, { status: 200 });
  }

  // The database trigger bumps the map revision in the same transaction.
  const { data: changed, error: writeErr } = await db
    .from("path_segments")
    .update({ availability: next.availability, robot_access: next.robot_access })
    .eq("segment_id", segment_id)
    .eq("last_state_revision", segment.last_state_revision)
    .select("segment_id, map_version_id, label, availability, robot_access, last_state_revision")
    .maybeSingle();
  if (writeErr?.code === "42501") return bad("operator or administrator role required", 403);
  if (writeErr) return bad("could not change segment", 500);
  if (!changed) return bad("another change landed first, try again", 409);

  // Until path events are stored (PathEvent), the server log is the record of who changed what.
  console.info(`[operator] ${identity.user.id} changed ${segment.label}: ${action} (revision ${changed.last_state_revision})`);
  return NextResponse.json({ ...changed, changed: true }, { status: 200 });
}
