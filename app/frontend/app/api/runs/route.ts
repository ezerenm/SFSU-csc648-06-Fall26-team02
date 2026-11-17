import { NextResponse } from "next/server";
import { hasRunRole, runIdentity } from "@/lib/spatial/server/runAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = (reason: string, status = 422) => NextResponse.json({ reason }, { status });

async function jsonBody(request: Request): Promise<unknown> {
  try { return await request.json(); } catch { return null; }
}

// One active live robot-phone run per map and device. Run IDs are session IDs.
export async function POST(request: Request) {
  const identity = await runIdentity(request);
  if ("reason" in identity) return bad(identity.reason, identity.status);
  const body = await jsonBody(request);
  if (!body || typeof body !== "object") return bad("body is not valid JSON");
  const { map_version_id, device_id } = body as Record<string, unknown>;
  if (typeof map_version_id !== "string" || !UUID.test(map_version_id)) return bad("map_version_id must be a uuid");
  if (typeof device_id !== "string" || device_id.trim().length < 1 || device_id.length > 120) {
    return bad("device_id must be 1-120 characters");
  }

  const { data: map, error: mapError } = await identity.db.from("map_versions")
    .select("site_id").eq("map_version_id", map_version_id)
    .eq("publication_state", "published").maybeSingle();
  if (mapError) return bad("could not read map", 500);
  if (!map) return bad("unknown or unpublished map_version_id", 404);
  const denied = await hasRunRole(identity.db, map.site_id, identity.userId);
  if (denied) return bad(denied.reason, denied.status);

  const { data, error } = await identity.db.from("navigation_sessions")
    .insert({
      user_id: identity.userId, site_id: map.site_id, map_version_id,
      device_id, device_model: null, agent_type: "robot_proxy",
      mode: "live", data_origin: "live_sdk", status: "active",
    })
    .select("session_id").single();
  if (error?.code === "23505") return bad("this device already has an active run", 409);
  if (error?.code === "42501") return bad("developer, operator or administrator role required", 403);
  if (error) return bad("could not start run", 500);
  return NextResponse.json({ run_id: data.session_id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const identity = await runIdentity(request);
  if ("reason" in identity) return bad(identity.reason, identity.status);
  const body = await jsonBody(request);
  if (!body || typeof body !== "object") return bad("body is not valid JSON");
  const { run_id, action } = body as Record<string, unknown>;
  if (typeof run_id !== "string" || !UUID.test(run_id)) return bad("run_id must be a uuid");
  if (action !== "stop") return bad("action must be stop");

  const { data: run, error: readError } = await identity.db.from("navigation_sessions")
    .select("session_id, site_id, status, ended_at")
    .eq("session_id", run_id).maybeSingle();
  if (readError) return bad("could not read run", 500);
  if (!run) return bad("unknown run_id", 404);
  const denied = await hasRunRole(identity.db, run.site_id, identity.userId);
  if (denied) return bad(denied.reason, denied.status);
  if (run.status === "ended") return NextResponse.json({ run_id, status: "ended", ended_at: run.ended_at });
  if (run.status !== "active") return bad("run cannot be stopped", 409);

  const { data, error } = await identity.db.from("navigation_sessions")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("session_id", run_id).eq("status", "active")
    .select("session_id, status, ended_at").maybeSingle();
  if (error?.code === "42501") return bad("developer, operator or administrator role required", 403);
  if (error) return bad("could not stop run", 500);
  if (!data) return bad("run state changed, try again", 409);
  return NextResponse.json({ run_id: data.session_id, status: data.status, ended_at: data.ended_at });
}
