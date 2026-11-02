import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { GraphResponse } from "../lib/spatial/contracts";
import { describePathChange, pathStateKey } from "../lib/spatial/pathState";

// Same synthetic fixture as the other API tests.
const graph = JSON.parse(readFileSync("../../milestones/M2/examples/graph-response.json", "utf8")) as GraphResponse;
const withSegment = (index: number, change: Partial<GraphResponse["segments"][number]>): GraphResponse => {
  const copy = structuredClone(graph);
  copy.segments[index] = { ...copy.segments[index], ...change };
  return copy;
};

test("the key ignores segment order", () => {
  const reversed = { ...graph, segments: [...graph.segments].reverse() };
  assert.equal(pathStateKey(reversed), pathStateKey(graph));
});

test("the key changes on a closure, a robot restriction or a new graph revision", () => {
  const base = pathStateKey(graph);
  assert.notEqual(pathStateKey(withSegment(0, { availability: "closed" })), base);
  assert.notEqual(pathStateKey(withSegment(0, { robot_access: "restricted" })), base);
  const revised = structuredClone(graph);
  revised.map_version.current_graph_revision += 1;
  assert.notEqual(pathStateKey(revised), base);
});

test("describePathChange names closures and reopenings", () => {
  const label = graph.segments[0].label;
  const closed = withSegment(0, { availability: "closed" });
  assert.deepEqual(describePathChange(graph.segments, closed.segments), [`${label} closed`]);
  assert.deepEqual(describePathChange(closed.segments, graph.segments), [`${label} reopened`]);
});

test("describePathChange names robot restrictions", () => {
  const index = graph.segments.findIndex((s) => s.robot_access === "allowed");
  const label = graph.segments[index].label;
  const restricted = withSegment(index, { robot_access: "restricted" });
  assert.deepEqual(describePathChange(graph.segments, restricted.segments), [`${label} restricted for robots`]);
  assert.deepEqual(describePathChange(restricted.segments, graph.segments), [`${label} open to robots again`]);
});

test("no changes means an empty list", () => {
  assert.deepEqual(describePathChange(graph.segments, structuredClone(graph).segments), []);
});
