import assert from "node:assert/strict";
import test from "node:test";
import { parseLiveAttempt } from "../lib/spatial/attemptIngest";

const attempt = {
  attempt_id: "a0000000-0000-4000-8000-000000000001",
  map_version_id: "b2000000-0000-4000-8000-000000000001",
  test_point_id: "b6000000-0000-4000-8000-000000000001",
  device_id: "phone-1",
  sdk_version: "NSDK 4.1.0",
  mode: "live",
  data_origin: "live_sdk",
  condition_label: "HSS 349 class, run 1, try 2",
  camera_direction: "yaw 120 deg",
  started_at: "2026-11-10T10:00:00Z",
  ended_at: "2026-11-10T10:00:05Z",
  outcome: "success",
  failure_reason: "",
  latency_ms: 4120,
};

test("normalizes Unity success placeholders", () => {
  const parsed = parseLiveAttempt(attempt);
  assert.ok("value" in parsed);
  assert.equal(parsed.value.failure_reason, null);
  assert.equal(parsed.value.latency_ms, 4120);
});

test("normalizes a failed attempt latency and requires a reason", () => {
  const failed = { ...attempt, outcome: "cancelled", failure_reason: "user stopped", latency_ms: -1 };
  const parsed = parseLiveAttempt(failed);
  assert.ok("value" in parsed);
  assert.equal(parsed.value.latency_ms, null);
  assert.equal(parsed.value.failure_reason, "user stopped");
  assert.ok("reason" in parseLiveAttempt({ ...failed, failure_reason: "" }));
});

test("rejects a timeout shorter than 30 seconds and a success outside its window", () => {
  assert.ok("reason" in parseLiveAttempt({ ...attempt, outcome: "timeout", latency_ms: -1,
    failure_reason: "timed out" }));
  assert.ok("reason" in parseLiveAttempt({ ...attempt, latency_ms: 6000 }));
});

test("rejects map and ID mismatches before database access", () => {
  assert.ok("reason" in parseLiveAttempt({ ...attempt, test_point_id: "not a uuid" }));
  assert.ok("reason" in parseLiveAttempt({ ...attempt, mode: "simulation" }));
});
