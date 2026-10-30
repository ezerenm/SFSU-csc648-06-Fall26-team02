/**
 * Localization health (R14.1–R14.5). Pure functions, no database access.
 * Rules come from M2 Data Definitions §1.14 and are applied in order; first match wins.
 */
import type { Outcome } from "./contracts";

export type HealthStatus = "gray" | "red" | "yellow" | "green";

/** The attempt fields health needs. Matches localization_attempts columns. */
export type HealthAttempt = {
  attempt_id: string;
  test_point_id: string;
  map_version_id: string;
  device_id: string;
  mode: "live" | "simulation" | "replay";
  outcome: Outcome;
  latency_ms: number | null;
  horizontal_error_m: number | null;
  error_is_valid: boolean;
};

export type HealthResult = {
  test_point_id: string;
  map_version_id: string;
  device_id: string;
  attempt_ids: string[];
  attempt_count: number; // R14.1
  success_count: number;
  success_rate: number | null; // R14.2, 0–1
  median_latency_ms: number | null;
  valid_error_count: number; // R14.4
  median_horizontal_error_m: number | null; // R14.3
  health_status: HealthStatus; // R14.5
  reason: string; // which rule matched, in plain words
};

/** Thresholds from §1.14, named so the doc and code stay in sync. */
export const HEALTH_RULES = {
  minAttempts: 10,
  minValidErrors: 5,
  redSuccessBelow: 0.6,
  redErrorAboveM: 1.5,
  greenSuccessAtLeast: 0.8,
  greenErrorAtMostM: 1.0,
} as const;

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function isValidError(a: HealthAttempt): boolean {
  return a.error_is_valid && typeof a.horizontal_error_m === "number" && Number.isFinite(a.horizontal_error_m);
}

/** Applies the §1.14 rules to already-computed metrics. */
export function classify(m: {
  attempt_count: number;
  success_rate: number | null;
  valid_error_count: number;
  median_horizontal_error_m: number | null;
}): { status: HealthStatus; reason: string } {
  const r = HEALTH_RULES;
  const rate = m.success_rate ?? 0;
  const err = m.median_horizontal_error_m;
  if (m.attempt_count < r.minAttempts)
    return { status: "gray", reason: `Only ${m.attempt_count} of ${r.minAttempts} attempts needed` };
  if (rate < r.redSuccessBelow)
    return { status: "red", reason: `Success rate below ${r.redSuccessBelow * 100}%` };
  if (m.valid_error_count >= r.minValidErrors && err !== null && err > r.redErrorAboveM)
    return { status: "red", reason: `Median error above ${r.redErrorAboveM} m` };
  if (m.valid_error_count < r.minValidErrors)
    return { status: "gray", reason: `Only ${m.valid_error_count} of ${r.minValidErrors} verified accuracy samples needed` };
  if (rate >= r.greenSuccessAtLeast && err !== null && err <= r.greenErrorAtMostM)
    return { status: "green", reason: `Success ≥${r.greenSuccessAtLeast * 100}% and median error ≤${r.greenErrorAtMostM} m` };
  return { status: "yellow", reason: "Works, but below the green bar" };
}

/**
 * Health for ONE test point + device + map. Uses only completed live attempts
 * (in_progress and non-live modes are ignored), as §1.14 requires.
 */
export function computeHealth(
  key: { test_point_id: string; map_version_id: string; device_id: string },
  attempts: HealthAttempt[],
): HealthResult {
  const used = attempts.filter((a) =>
    a.test_point_id === key.test_point_id && a.map_version_id === key.map_version_id &&
    a.device_id === key.device_id && a.mode === "live" && a.outcome !== "in_progress");
  const successes = used.filter((a) => a.outcome === "success");
  const latencies = successes.map((a) => a.latency_ms).filter((v): v is number => typeof v === "number");
  const errors = used.filter(isValidError).map((a) => a.horizontal_error_m as number);
  const metrics = {
    attempt_count: used.length,
    success_rate: used.length === 0 ? null : successes.length / used.length,
    valid_error_count: errors.length,
    median_horizontal_error_m: median(errors),
  };
  const { status, reason } = classify(metrics);
  return {
    ...key,
    attempt_ids: used.map((a) => a.attempt_id),
    success_count: successes.length,
    median_latency_ms: median(latencies),
    ...metrics,
    health_status: status,
    reason,
  };
}

/** Groups attempts by test point + device + map and computes health for each group. */
export function computeAllHealth(attempts: HealthAttempt[]): HealthResult[] {
  const keys = new Map<string, { test_point_id: string; map_version_id: string; device_id: string }>();
  for (const a of attempts) {
    const k = `${a.map_version_id}|${a.test_point_id}|${a.device_id}`;
    if (!keys.has(k)) keys.set(k, { test_point_id: a.test_point_id, map_version_id: a.map_version_id, device_id: a.device_id });
  }
  return [...keys.values()].map((key) => computeHealth(key, attempts));
}
