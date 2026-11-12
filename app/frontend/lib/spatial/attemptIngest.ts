const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FAILURES = new Set(["timeout", "tracking_loss", "network_error", "map_mismatch", "cancelled", "other_failure"]);

export type LiveAttempt = {
  attempt_id: string;
  map_version_id: string;
  test_point_id: string;
  device_id: string;
  sdk_version: string;
  mode: "live";
  data_origin: "live_sdk";
  condition_label: string;
  camera_direction: string;
  started_at: string;
  ended_at: string;
  outcome: string;
  failure_reason: string | null;
  latency_ms: number | null;
};

type Parsed = { value: LiveAttempt } | { reason: string };
const record = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const label = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.trim().length <= 120;
const timestamp = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(v)
  && Number.isFinite(Date.parse(v));

export function parseLiveAttempt(body: unknown): Parsed {
  if (!record(body)) return { reason: "body must be an object" };
  for (const key of ["attempt_id", "map_version_id", "test_point_id"] as const) {
    if (typeof body[key] !== "string" || !UUID.test(body[key])) return { reason: `${key} must be a uuid` };
  }
  for (const key of ["device_id", "sdk_version", "condition_label", "camera_direction"] as const) {
    if (!label(body[key])) return { reason: `${key} must be 1-120 characters` };
  }
  if (body.mode !== "live" || body.data_origin !== "live_sdk") {
    return { reason: "mode must be live and data_origin must be live_sdk" };
  }
  if (!timestamp(body.started_at) || !timestamp(body.ended_at)) {
    return { reason: "started_at and ended_at must be ISO timestamps" };
  }
  const elapsed = Date.parse(body.ended_at) - Date.parse(body.started_at);
  if (elapsed < 0) return { reason: "ended_at must not be before started_at" };
  if (Date.parse(body.ended_at) > Date.now() + 60_000) return { reason: "ended_at is in the future" };
  if (body.outcome !== "success" && !FAILURES.has(String(body.outcome))) {
    return { reason: "unknown outcome" };
  }
  const failure = body.failure_reason === "" || body.failure_reason == null ? null : body.failure_reason;
  if (failure !== null && (typeof failure !== "string" || failure.trim().length > 1000)) {
    return { reason: "failure_reason must be at most 1000 characters" };
  }
  const latency = body.latency_ms === -1 || body.latency_ms == null ? null : body.latency_ms;
  if (body.outcome === "success") {
    if (failure !== null) return { reason: "success cannot have a failure_reason" };
    if (typeof latency !== "number" || !Number.isFinite(latency) || latency < 0 || latency > 30000
      || elapsed > 30000 || latency > elapsed) {
      return { reason: "success requires latency_ms within 30 seconds and the attempt window" };
    }
  } else {
    if (typeof failure !== "string" || failure.trim().length === 0) {
      return { reason: "failure_reason is required for failed attempts" };
    }
    if (latency !== null) return { reason: "failed attempts must send latency_ms as -1" };
    if (body.outcome === "timeout" && elapsed < 30000) {
      return { reason: "timeout requires at least 30 seconds" };
    }
  }
  return { value: {
    attempt_id: body.attempt_id as string,
    map_version_id: body.map_version_id as string,
    test_point_id: body.test_point_id as string,
    device_id: (body.device_id as string).trim(),
    sdk_version: (body.sdk_version as string).trim(),
    mode: "live",
    data_origin: "live_sdk",
    condition_label: (body.condition_label as string).trim(),
    camera_direction: (body.camera_direction as string).trim(),
    started_at: new Date(body.started_at).toISOString(),
    ended_at: new Date(body.ended_at).toISOString(),
    outcome: body.outcome as string,
    failure_reason: failure as string | null,
    latency_ms: latency as number | null,
  } };
}
