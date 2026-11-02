import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { GraphResponse } from "../lib/spatial/contracts";
import type { HealthAttempt } from "../lib/spatial/health";
import { createHandlers } from "../lib/spatial/server/handlers";
import { GeminiError, type GeminiCaller } from "../lib/spatial/server/gemini";
import type { SpatialRepository } from "../lib/spatial/server/repository";

// Same synthetic fixture as the other API tests (TP1 to TP5).
const graph = JSON.parse(readFileSync("../../milestones/M2/examples/graph-response.json", "utf8")) as GraphResponse;
const map = graph.map_version.map_version_id;
const tp1 = graph.test_points[0];
const url = `http://localhost/api/health/summary?map_version_id=${map}&mode=simulation`;
const post = (path = url) => new Request(path, { method: "POST" });

const attempts: HealthAttempt[] = Array.from({ length: 10 }, (_, i) => ({
  attempt_id: `a${i}`, test_point_id: tp1.test_point_id, map_version_id: map, device_id: "synthetic-iphone-fixture",
  mode: "simulation", outcome: i < 7 ? "success" : "timeout", latency_ms: i < 7 ? 2000 : null,
  horizontal_error_m: null, error_is_valid: false,
}));
const repository: SpatialRepository = {
  graph: async (id) => id === map ? structuredClone(graph) : null,
  attempts: async () => ({ items: [], total: 0 }),
  healthAttempts: async () => attempts,
};
const api = (gemini: GeminiCaller | null) => createHandlers(() => repository, null, () => gemini);
const reply = (body: unknown): GeminiCaller => async () => ({ text: JSON.stringify(body), model_version: "gemini-test-001" });

test("bad input is rejected before Gemini or the database is used", async () => {
  const handlers = createHandlers(() => { throw new Error("must not open"); }, null, () => { throw new Error("must not call"); });
  for (const path of ["http://localhost/api/health/summary", `${url}&typo=1`, `${url.replace("simulation", "replay")}`]) {
    assert.equal((await handlers.healthSummary(post(path))).status, 400);
  }
});

test("without a key the summary is unavailable but facts are still returned", async () => {
  const body = await (await api(null).healthSummary(post())).json();
  assert.equal(body.status, "unavailable");
  assert.equal(body.facts.rows[0].test_point, tp1.label);
  assert.equal(body.facts.rows[0].success_percent, 70);
});

test("a good Gemini answer is completed and keeps only checked sentences", async () => {
  const label = tp1.label;
  const gemini = reply({
    observations: [
      { text: `This is simulated data. ${label} succeeded in 70% of 10 attempts.`, test_points: [label] },
      { text: `${label} is accurate to 0.2 m.`, test_points: [label] },
    ],
    suggestions: [`Add verified reference positions so ${label} can leave gray.`],
  });
  const body = await (await api(gemini).healthSummary(post())).json();
  assert.equal(body.status, "completed");
  assert.equal(body.model_version, "gemini-test-001");
  assert.equal(body.prompt_version, "health-summary-v2");
  assert.equal(body.observations.length, 1);
  assert.equal(body.rejected_count, 1);
});

test("an answer with only invented numbers is failed, not shown", async () => {
  const gemini = reply({ observations: [{ text: "Everything works 99% of the time.", test_points: [] }], suggestions: [] });
  const body = await (await api(gemini).healthSummary(post())).json();
  assert.equal(body.status, "failed");
  assert.deepEqual(body.observations, []);
});

test("Gemini timeouts and errors still return 200 with a status", async () => {
  const slow: GeminiCaller = async () => { throw new GeminiError("timed_out", "slow"); };
  const broken: GeminiCaller = async () => ({ text: "not json", model_version: "x" });
  const timedOut = await api(slow).healthSummary(post());
  assert.equal(timedOut.status, 200);
  assert.equal((await timedOut.json()).status, "timed_out");
  assert.equal((await (await api(broken).healthSummary(post())).json()).status, "failed");
});

test("a map that is not visible is a 404 and Gemini is never called", async () => {
  let called = false;
  const gemini: GeminiCaller = async () => { called = true; return { text: "{}", model_version: "x" }; };
  const response = await api(gemini).healthSummary(post(url.replace(map, "20000000-0000-4000-8000-000000000099")));
  assert.equal(response.status, 404);
  assert.equal(called, false);
});
