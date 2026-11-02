import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { GraphResponse } from "../lib/spatial/contracts";
import type { HealthAttempt, HealthMode } from "../lib/spatial/health";
import { createHandlers } from "../lib/spatial/server/handlers";
import type { SpatialRepository } from "../lib/spatial/server/repository";

// Same fixture the other API tests use (synthetic M2 map with TP1–TP5).
const graph = JSON.parse(readFileSync("../../milestones/M2/examples/graph-response.json", "utf8")) as GraphResponse;
const map = graph.map_version.map_version_id;
const tp1 = graph.test_points[0].test_point_id;
const get = (path: string) => new Request(`http://localhost${path}`);

function sim(i: number, outcome: HealthAttempt["outcome"] = "success"): HealthAttempt {
  return {
    attempt_id: `70000000-0000-4000-8000-${String(i).padStart(12, "0")}`, test_point_id: tp1, map_version_id: map,
    device_id: "synthetic-iphone-fixture", mode: "simulation", outcome,
    latency_ms: outcome === "success" ? 2000 : null, horizontal_error_m: null, error_is_valid: false,
  };
}

function api(attempts: HealthAttempt[] = [], seen: HealthMode[] = []) {
  const repository: SpatialRepository = {
    graph: async (value) => value === map ? structuredClone(graph) : null,
    attempts: async () => ({ items: [], total: 0 }),
    healthAttempts: async (_id, mode) => { seen.push(mode); return attempts.filter((a) => a.mode === mode); },
  };
  return createHandlers(() => repository);
}

for (const [label, path] of [
  ["missing map", "/api/health"],
  ["invalid UUID", "/api/health?map_version_id=bad"],
  ["unknown mode", `/api/health?map_version_id=${map}&mode=replay`],
  ["unknown parameter", `/api/health?map_version_id=${map}&typo=1`],
]) {
  test(`health rejects ${label} before opening a database connection`, async () => {
    const handlers = createHandlers(() => { throw new Error("must not open"); });
    assert.equal((await handlers.health(get(path))).status, 400);
  });
}

test("health returns 404 for a map that is not visible", async () => {
  const response = await api().health(get("/api/health?map_version_id=20000000-0000-4000-8000-000000000099"));
  assert.equal(response.status, 404);
});

test("health defaults to live mode and lists every evaluation point, empty when no attempts", async () => {
  const seen: HealthMode[] = [];
  const response = await api([sim(1)], seen).health(get(`/api/health?map_version_id=${map}`));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.deepEqual(seen, ["live"]);
  assert.equal(body.mode, "live");
  assert.equal(body.points.length, graph.test_points.filter((p) => p.purpose === "evaluation").length);
  assert.ok(body.points.every((p: { results: unknown[] }) => p.results.length === 0));
  assert.equal(body.rules.minAttempts, 10);
});

test("simulation mode computes health from synthetic attempts and labels it", async () => {
  const attempts = [...Array.from({ length: 7 }, (_, i) => sim(i + 1)), sim(8, "timeout"), sim(9, "timeout"), sim(10, "tracking_loss")];
  const body = await (await api(attempts).health(get(`/api/health?map_version_id=${map}&mode=simulation`))).json();
  const point = body.points.find((p: { test_point_id: string }) => p.test_point_id === tp1);
  assert.equal(body.mode, "simulation");
  assert.equal(point.results.length, 1);
  assert.equal(point.results[0].attempt_count, 10);
  assert.equal(point.results[0].success_rate, 0.7);
  // 10 attempts, 70% success, but no verified accuracy samples → rule 4 (gray), with a reason.
  assert.equal(point.results[0].health_status, "gray");
  assert.match(point.results[0].reason, /verified accuracy/);
});
