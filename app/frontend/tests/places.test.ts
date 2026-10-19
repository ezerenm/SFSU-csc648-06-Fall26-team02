import assert from "node:assert/strict";
import { test } from "node:test";
import type { Destination, GraphNode } from "../lib/spatial/contracts";
import { formatMeters, placeNamer, placesFor } from "../lib/spatial/places";

const node = (id: string, label: string): GraphNode =>
  ({ node_id: id, map_version_id: "m", graph_revision: 1, label, position: { x_m: 0, y_m: 0, z_m: 0 } });
const dest = (id: string, nodeId: string, name: string, is_active = true): Destination =>
  ({ destination_id: id, site_id: "s", map_version_id: "m", graph_revision: 1, node_id: nodeId, name, description: "", is_active });

test("placesFor keeps node order and uses destination names", () => {
  const nodes = [node("n1", "N1 Door"), node("n2", "N2 Corner"), node("n3", "N3 Front")];
  // API sorts destinations by name; places must still follow node order.
  const places = placesFor(nodes, [dest("d3", "n3", "Front of Room"), dest("d1", "n1", "Door")]);
  assert.deepEqual(places.map((p) => p.name), ["Door", "N2 Corner", "Front of Room"]);
  assert.deepEqual(places.map((p) => p.destination_id), ["d1", null, "d3"]);
});

test("placesFor ignores inactive destinations", () => {
  const places = placesFor([node("n1", "N1 Door")], [dest("d1", "n1", "Old name", false)]);
  assert.equal(places[0].name, "N1 Door");
  assert.equal(places[0].destination_id, null);
});

test("placeNamer and formatMeters", () => {
  const name = placeNamer(placesFor([node("n1", "N1 Door")], [dest("d1", "n1", "Door")]));
  assert.equal(name("n1"), "Door");
  assert.equal(name("abcdef0123456789"), "abcdef01");
  assert.equal(formatMeters(5.116), "5.1 m");
  assert.equal(formatMeters(0), "0.0 m");
});
