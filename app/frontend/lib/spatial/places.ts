import type { Destination, GraphNode } from "./contracts";

/** One pickable place: a graph node, named after its destination when it has one. */
export type Place = { node_id: string; name: string; destination_id: string | null };

/**
 * One place per graph node, in the API's node order, so Start and Destination lists
 * show the same names in the same order on /viewer and /live.
 */
export function placesFor(nodes: readonly GraphNode[], destinations: readonly Destination[]): Place[] {
  const byNode = new Map<string, Destination>();
  for (const d of destinations) if (d.is_active && !byNode.has(d.node_id)) byNode.set(d.node_id, d);
  return nodes.map((n) => {
    const d = byNode.get(n.node_id);
    return { node_id: n.node_id, name: d?.name ?? n.label, destination_id: d?.destination_id ?? null };
  });
}

/** Display name for a node id; falls back to a short id if the node is unknown. */
export function placeNamer(places: readonly Place[]): (nodeId: string) => string {
  const names = new Map(places.map((p) => [p.node_id, p.name]));
  return (nodeId) => names.get(nodeId) ?? nodeId.slice(0, 8);
}

/** Distances are shown the same way everywhere: one decimal, meters. */
export const formatMeters = (m: number) => `${m.toFixed(1)} m`;
