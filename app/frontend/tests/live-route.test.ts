import assert from "node:assert/strict";
import { test } from "node:test";
import type { GraphNode, PathSegment } from "../lib/spatial/contracts";
import { nearestNode, pickStartNode, routePolyline } from "../lib/spatial/liveRoute";

const node = (id: string, x: number, z: number): GraphNode =>
  ({ node_id: id, map_version_id: "m", graph_revision: 1, label: id, position: { x_m: x, y_m: 0, z_m: z } });
const A = node("A", 0, 0), B = node("B", 4, 0), C = node("C", 4, 4);
const seg = (id: string, from: GraphNode, to: GraphNode): PathSegment => ({
  segment_id: id, map_version_id: "m", graph_revision: 1, label: id, start_node_id: from.node_id, end_node_id: to.node_id,
  direction: "bidirectional", distance_m: 4, availability: "open", robot_access: "allowed", last_state_revision: 1,
  geometry: [from.position, to.position],
});
const AB = seg("AB", A, B), BC = seg("BC", B, C);

test("nearestNode picks the closest node in the x-z plane and ignores height", () => {
  const near = nearestNode([A, B, C], { x_m: 3.5, z_m: 3 });
  assert.equal(near?.node.node_id, "C");
  assert.equal(nearestNode([], { x_m: 0, z_m: 0 }), null);
});

test("pickStartNode keeps the current node until another is clearly closer", () => {
  // Standing 2.2 m from A and 1.8 m from B: B is closer, but only by 0.4 m (< 0.75 m margin).
  const pos = { x_m: 2.2, z_m: 0 };
  assert.equal(pickStartNode([A, B, C], pos, "A")?.node_id, "A");
  assert.equal(pickStartNode([A, B, C], pos, null)?.node_id, "B");
  // 3.5 m along: B is 3 m closer than A, so the start switches.
  assert.equal(pickStartNode([A, B, C], { x_m: 3.5, z_m: 0 }, "A")?.node_id, "B");
});

test("routePolyline follows steps in order and reverses segments walked backwards", () => {
  const forward = routePolyline([AB, BC], [
    { segment_id: "AB", from_node_id: "A", to_node_id: "B" },
    { segment_id: "BC", from_node_id: "B", to_node_id: "C" },
  ]);
  assert.deepEqual(forward, [{ x_m: 0, z_m: 0 }, { x_m: 4, z_m: 0 }, { x_m: 4, z_m: 4 }]);
  const backward = routePolyline([AB, BC], [
    { segment_id: "BC", from_node_id: "C", to_node_id: "B" },
    { segment_id: "AB", from_node_id: "B", to_node_id: "A" },
  ]);
  assert.deepEqual(backward, [{ x_m: 4, z_m: 4 }, { x_m: 4, z_m: 0 }, { x_m: 0, z_m: 0 }]);
  assert.deepEqual(routePolyline([AB], []), []);
});
