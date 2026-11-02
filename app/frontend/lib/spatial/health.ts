// R14 localization health: how reliably the phone localizes at each test point.
//
// Rules (M2 Data Definitions 1.14), checked in order, first match wins:
//   1. Gray    fewer than 10 attempts
//   2. Red     success rate below 60%
//   3. Red     5+ verified accuracy samples and median error above 1.5 m
//   4. Gray    fewer than 5 verified accuracy samples
//   5. Green   success rate 80%+ and median error 1 m or less
//   6. Yellow  everything else
//
// Only completed attempts count (in_progress is skipped). The doc counts "live"
// attempts only; "simulation" mode exists so the pipeline can be tested on the
// labeled synthetic seed data, and every result says which mode it used.
//
// Pure functions: no DB, no React. GET /api/health passes the attempts in.
//
// Author: Sumit, Oct 30 2026

import type { Outcome } from "./contracts";

export type HealthStatus = "gray" | "red" | "yellow" | "green";

/** Which attempts count: "live" (the doc's rule) or "simulation" (labeled test data). */
export type HealthMode = "live" | "simulation";
export const HEALTH_MODES: readonly HealthMode[] = ["live", "simulation"];

/** The attempt fields health needs. Names match the localization_attempts columns. */
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

/** Health of one test point for one device on one map. */
export type HealthResult = {
  test_point_id: string;
  map_version_id: string;
  device_id: string;
  mode: HealthMode;
  attempt_ids: string[]; // exact attempts used, so any number can be traced back
  attempt_count: number; // R14.1
  success_count: number;
  success_rate: number | null; // R14.2, 0 to 1, null when there are no attempts
  median_latency_ms: number | null; // successful attempts only
  valid_error_count: number; // R14.4
  median_horizontal_error_m: number | null; // R14.3
  health_status: HealthStatus; // R14.5
  reason: string; // the rule that matched, in plain words
};

/** Thresholds from 1.14. Change a number here and in the doc together. */
export const HEALTH_RULES = {
  minAttempts: 10,
  minValidErrors: 5,
  redSuccessBelow: 0.6,
  redErrorAboveM: 1.5,
  greenSuccessAtLeast: 0.8,
  greenErrorAtMostM: 1.0,
} as const;

/**
 * Middle value of a list (average of the two middle values for even lengths).
 * @param values numbers in any order; the input is not changed
 * @returns the median, or null for an empty list
 */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** An attempt has a usable accuracy sample only if the error is marked valid and is a real number. */
function hasVerifiedError(attempt: HealthAttempt): boolean {
  return attempt.error_is_valid
    && typeof attempt.horizontal_error_m === "number"
    && Number.isFinite(attempt.horizontal_error_m);
}

/**
 * Picks the health color from already-computed metrics (rules 1 to 6 above).
 * @param metrics counts and medians for one test point
 * @returns the color and the rule that matched, in plain words
 */
export function classify(metrics: {
  attempt_count: number;
  success_rate: number | null;
  valid_error_count: number;
  median_horizontal_error_m: number | null;
}): { status: HealthStatus; reason: string } {
  const rules = HEALTH_RULES;
  const successRate = metrics.success_rate ?? 0;
  const medianError = metrics.median_horizontal_error_m;
  const hasEnoughErrors = metrics.valid_error_count >= rules.minValidErrors;

  // Rule 1
  if (metrics.attempt_count < rules.minAttempts) {
    return { status: "gray", reason: `Only ${metrics.attempt_count} of ${rules.minAttempts} attempts needed` };
  }
  // Rule 2
  if (successRate < rules.redSuccessBelow) {
    return { status: "red", reason: `Success rate below ${rules.redSuccessBelow * 100}%` };
  }
  // Rule 3
  if (hasEnoughErrors && medianError !== null && medianError > rules.redErrorAboveM) {
    return { status: "red", reason: `Median error above ${rules.redErrorAboveM} m` };
  }
  // Rule 4
  if (!hasEnoughErrors) {
    return {
      status: "gray",
      reason: `Only ${metrics.valid_error_count} of ${rules.minValidErrors} verified accuracy samples needed`,
    };
  }
  // Rule 5
  if (successRate >= rules.greenSuccessAtLeast && medianError !== null && medianError <= rules.greenErrorAtMostM) {
    return {
      status: "green",
      reason: `Success ${rules.greenSuccessAtLeast * 100}% or more and median error ${rules.greenErrorAtMostM} m or less`,
    };
  }
  // Rule 6
  return { status: "yellow", reason: "Works, but below the green bar" };
}

/**
 * Computes health for one test point + device + map.
 * @param key which test point, map version and device to compute for
 * @param attempts any attempts; the ones that do not match the key or mode are ignored
 * @param mode "live" (default, the doc's rule) or "simulation"
 * @returns the metrics, color and reason for that key
 */
export function computeHealth(
  key: { test_point_id: string; map_version_id: string; device_id: string },
  attempts: HealthAttempt[],
  mode: HealthMode = "live",
): HealthResult {
  const counted = attempts.filter((attempt) =>
    attempt.test_point_id === key.test_point_id
    && attempt.map_version_id === key.map_version_id
    && attempt.device_id === key.device_id
    && attempt.mode === mode
    && attempt.outcome !== "in_progress");
  const successes = counted.filter((attempt) => attempt.outcome === "success");
  const latencies = successes
    .map((attempt) => attempt.latency_ms)
    .filter((latency): latency is number => typeof latency === "number");
  const errors = counted.filter(hasVerifiedError).map((attempt) => attempt.horizontal_error_m as number);

  const metrics = {
    attempt_count: counted.length,
    success_rate: counted.length === 0 ? null : successes.length / counted.length,
    valid_error_count: errors.length,
    median_horizontal_error_m: median(errors),
  };
  const { status, reason } = classify(metrics);

  return {
    ...key,
    mode,
    attempt_ids: counted.map((attempt) => attempt.attempt_id),
    success_count: successes.length,
    median_latency_ms: median(latencies),
    ...metrics,
    health_status: status,
    reason,
  };
}

/**
 * Computes health for every test point + device + map found in the attempts.
 * @param attempts attempts from one or more test points and devices
 * @param mode "live" (default) or "simulation"; attempts of other modes are skipped
 * @returns one result per test point + device + map, in first-seen order
 */
export function computeAllHealth(attempts: HealthAttempt[], mode: HealthMode = "live"): HealthResult[] {
  const keys = new Map<string, { test_point_id: string; map_version_id: string; device_id: string }>();
  for (const attempt of attempts) {
    if (attempt.mode !== mode) continue;
    const id = `${attempt.map_version_id}|${attempt.test_point_id}|${attempt.device_id}`;
    if (!keys.has(id)) {
      keys.set(id, {
        test_point_id: attempt.test_point_id,
        map_version_id: attempt.map_version_id,
        device_id: attempt.device_id,
      });
    }
  }
  return [...keys.values()].map((key) => computeHealth(key, attempts, mode));
}
