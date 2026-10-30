import assert from "node:assert/strict";
import { test } from "node:test";
import { classify, computeAllHealth, computeHealth, median, type HealthAttempt } from "../lib/spatial/health";

const key = { test_point_id: "tp1", map_version_id: "map1", device_id: "iphone-sumit" };
let n = 0;
function attempt(over: Partial<HealthAttempt> = {}): HealthAttempt {
  n += 1;
  return {
    attempt_id: `a${n}`, ...key, mode: "live", outcome: "success",
    latency_ms: 4000, horizontal_error_m: null, error_is_valid: false, ...over,
  };
}
const many = (count: number, over: Partial<HealthAttempt> = {}) => Array.from({ length: count }, () => attempt(over));
const withError = (m: number) => ({ horizontal_error_m: m, error_is_valid: true });

test("median handles odd, even and empty lists", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), null);
});

test("rule 1: fewer than 10 attempts is gray", () => {
  const h = computeHealth(key, many(9, withError(0.5)));
  assert.equal(h.health_status, "gray");
  assert.equal(h.attempt_count, 9);
});

test("rule 2: success below 60% is red even without accuracy data", () => {
  const h = computeHealth(key, [...many(5), ...many(5, { outcome: "timeout", latency_ms: null })]);
  assert.equal(h.success_rate, 0.5);
  assert.equal(h.health_status, "red");
});

test("rule 3: median error above 1.5 m is red", () => {
  assert.equal(computeHealth(key, many(10, withError(2))).health_status, "red");
});

test("rule 4: enough attempts but fewer than 5 verified errors is gray", () => {
  const h = computeHealth(key, [...many(4, withError(0.5)), ...many(6)]);
  assert.equal(h.valid_error_count, 4);
  assert.equal(h.health_status, "gray");
});

test("rule 5: success ≥80% and median error ≤1 m is green", () => {
  const h = computeHealth(key, [...many(9, withError(0.6)), attempt({ outcome: "tracking_loss", latency_ms: null })]);
  assert.equal(h.success_rate, 0.9);
  assert.equal(h.health_status, "green");
});

test("rule 6: otherwise yellow (70% success, good error)", () => {
  const h = computeHealth(key, [...many(7, withError(0.6)), ...many(3, { outcome: "timeout", latency_ms: null })]);
  assert.equal(h.health_status, "yellow");
});

test("boundaries: exactly 60% is not red, 1.5 m is not red, 1.0 m can be green", () => {
  assert.notEqual(classify({ attempt_count: 10, success_rate: 0.6, valid_error_count: 5, median_horizontal_error_m: 1 }).status, "red");
  assert.equal(classify({ attempt_count: 10, success_rate: 0.9, valid_error_count: 5, median_horizontal_error_m: 1.5 }).status, "yellow");
  assert.equal(classify({ attempt_count: 10, success_rate: 0.8, valid_error_count: 5, median_horizontal_error_m: 1 }).status, "green");
});

test("only completed live attempts count", () => {
  const h = computeHealth(key, [
    ...many(10, withError(0.5)),
    attempt({ outcome: "in_progress", latency_ms: null }),
    attempt({ mode: "simulation" }),
    attempt({ device_id: "iphone-daksh" }),
  ]);
  assert.equal(h.attempt_count, 10);
});

test("median latency uses successful attempts only", () => {
  const h = computeHealth(key, [...many(2, { latency_ms: 2000 }), attempt({ latency_ms: 9000 }), attempt({ outcome: "timeout", latency_ms: null })]);
  assert.equal(h.median_latency_ms, 2000);
});

test("computeAllHealth splits by device", () => {
  const all = computeAllHealth([...many(3), ...many(2, { device_id: "iphone-daksh" })]);
  assert.equal(all.length, 2);
});
