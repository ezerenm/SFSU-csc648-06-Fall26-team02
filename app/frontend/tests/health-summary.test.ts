import assert from "node:assert/strict";
import { test } from "node:test";
import type { HealthResult } from "../lib/spatial/health";
import {
  buildHealthFacts, buildSummaryPrompt, parseSummary, unsupportedNumbers, type HealthPointView,
} from "../lib/spatial/healthSummary";

function result(over: Partial<HealthResult> = {}): HealthResult {
  return {
    test_point_id: "tp1", map_version_id: "map1", device_id: "iphone-sumit", mode: "live",
    attempt_ids: [], attempt_count: 12, success_count: 10, success_rate: 10 / 12,
    median_latency_ms: 3460, valid_error_count: 0, median_horizontal_error_m: null,
    health_status: "gray", reason: "Only 0 of 5 verified accuracy samples needed", ...over,
  };
}
const points: HealthPointView[] = [
  { test_point_id: "tp1", label: "TP1 Door", is_synthetic: false, results: [result()] },
  { test_point_id: "tp2", label: "TP2 Front", is_synthetic: false, results: [] },
];
const facts = buildHealthFacts(points, "live");

test("facts round numbers for people and list points with no attempts", () => {
  assert.equal(facts.rows[0].success_percent, 83);
  assert.equal(facts.rows[0].median_seconds_to_localize, 3.5);
  assert.deepEqual(facts.rows[1], {
    test_point: "TP2 Front", device: null, status: "gray", reason: "No attempts yet",
    attempts: 0, successes: 0, success_percent: null, median_seconds_to_localize: null,
    verified_accuracy_samples: 0, median_error_m: null,
  });
  assert.deepEqual(facts.totals, { test_points: 2, gray: 2, red: 0, yellow: 0, green: 0 });
});

test("prompt contains the facts and the simulated-data warning only in simulation mode", () => {
  assert.match(buildSummaryPrompt(facts), /"test_point":"TP1 Door"/);
  assert.doesNotMatch(buildSummaryPrompt(facts), /SIMULATED/);
  assert.match(buildSummaryPrompt(buildHealthFacts(points, "simulation")), /SIMULATED/);
  assert.match(buildSummaryPrompt(facts), /Group test points/);
});

test("numbers from the facts are accepted, including rounded and percent forms", () => {
  assert.deepEqual(unsupportedNumbers("TP1 Door succeeded 10 of 12 times (83%) in about 3.5 s.", facts), []);
  assert.deepEqual(unsupportedNumbers("Green needs 80% success and at most 1 m error; red is below 60%.", facts), []);
});

test("made-up numbers are caught, but names with digits are not", () => {
  assert.deepEqual(unsupportedNumbers("TP1 Door succeeded 95% of the time.", facts), ["95"]);
  assert.deepEqual(unsupportedNumbers("iphone-sumit at TP2 Front has no attempts.", facts), []);
});

test("parseSummary keeps safe items and drops invented numbers and unknown points", () => {
  const raw = JSON.stringify({
    observations: [
      { text: "TP1 Door works in 83% of attempts.", test_points: ["TP1 Door"] },
      { text: "TP1 Door is accurate to 0.3 m.", test_points: ["TP1 Door"] },
      { text: "TP9 is fine.", test_points: ["TP9"] },
    ],
    suggestions: ["Tape-measure TP1 Door so accuracy can be verified.", "Run 40 more attempts."],
  });
  const parsed = parseSummary(raw, facts);
  assert.deepEqual(parsed.observations, [{ text: "TP1 Door works in 83% of attempts.", test_points: ["TP1 Door"] }]);
  assert.deepEqual(parsed.suggestions, ["Tape-measure TP1 Door so accuracy can be verified."]);
  assert.equal(parsed.rejected_count, 3);
});

test("parseSummary rejects answers that are not the expected JSON", () => {
  assert.throws(() => parseSummary("not json", facts));
  assert.throws(() => parseSummary(JSON.stringify({ observations: "x", suggestions: [] }), facts), /arrays/);
});

test("parseSummary caps the number of items", () => {
  const many = { observations: Array.from({ length: 9 }, () => ({ text: "TP1 Door is gray.", test_points: [] })), suggestions: [] };
  const parsed = parseSummary(JSON.stringify(many), facts);
  assert.equal(parsed.observations.length, 6);
  assert.equal(parsed.rejected_count, 3);
});
