import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = (reason: string, status = 422) => NextResponse.json({ reason }, { status });

// Public aggregate counts for runs on published public demo maps.
export async function GET(request: Request) {
  const runId = new URL(request.url).searchParams.get("run_id");
  if (!runId || !UUID.test(runId)) return bad("run_id must be a uuid");
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return bad("server not configured", 500);
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: run, error: runError } = await db.from("navigation_sessions")
    .select("session_id, map_version_id, site_id")
    .eq("session_id", runId).maybeSingle();
  if (runError) return bad("could not read run", 500);
  if (!run) return bad("unknown run_id", 404);
  const { data: map, error: mapError } = await db.from("map_versions")
    .select("publication_state")
    .eq("map_version_id", run.map_version_id).eq("site_id", run.site_id).maybeSingle();
  if (mapError) return bad("could not read map", 500);
  const { data: site, error: siteError } = await db.from("sites")
    .select("is_public_demo").eq("site_id", run.site_id).maybeSingle();
  if (siteError) return bad("could not read site", 500);
  if (!map || map.publication_state !== "published" || !site?.is_public_demo) {
    return bad("unknown run_id", 404);
  }

  const [samples, attempts, failures] = await Promise.all([
    db.from("pose_samples").select("sample_id", { count: "exact", head: true }).eq("session_id", runId),
    db.from("localization_attempts").select("attempt_id", { count: "exact", head: true }).eq("session_id", runId),
    db.from("localization_attempts").select("attempt_id", { count: "exact", head: true })
      .eq("session_id", runId).in("outcome", [
        "timeout", "tracking_loss", "network_error", "map_mismatch", "cancelled", "other_failure",
      ]),
  ]);
  if (samples.error || attempts.error || failures.error) return bad("could not count run records", 500);
  return NextResponse.json({ samples: samples.count ?? 0, attempts: attempts.count ?? 0,
    failures: failures.count ?? 0 });
}
