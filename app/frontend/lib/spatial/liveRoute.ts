import type { GraphNode, PathSegment, RouteStep } from "./contracts";

/** Horizontal (x, z) position in the world frame, meters. */
export type Xz = { x_m: number; z_m: number };

/** Within this distance of the destination node the user has arrived. */
export const ARRIVED_M = 1.0;
/** The auto start node only changes when another node is this much closer (stops route flicker). */
export const SWITCH_MARGIN_M = 0.75;

export const distance = (a: Xz, b: Xz) => Math.hypot(a.x_m - b.x_m, a.z_m - b.z_m);

export function nearestNode(nodes: readonly GraphNode[], pos: Xz): { node: GraphNode; distance_m: number } | null {
  let best: { node: GraphNode; distance_m: number } | null = null;
  for (const node of nodes) {
    const d = distance(node.position, pos);
    if (!best || d < best.distance_m) best = { node, distance_m: d };
  }
  return best;
}

/** Nearest node, but keep the current one unless another is at least `margin` meters closer. */
export function pickStartNode(
  nodes: readonly GraphNode[], pos: Xz, currentId: string | null, margin = SWITCH_MARGIN_M,
): GraphNode | null {
  const near = nearestNode(nodes, pos);
  if (!near) return null;
  const current = nodes.find((n) => n.node_id === currentId);
  if (current && distance(current.position, pos) <= near.distance_m + margin) return current;
  return near.node;
}

/** Joins the geometry of each step, reversing a segment that is walked end -> start. */
export function routePolyline(segments: readonly PathSegment[], steps: readonly RouteStep[]): Xz[] {
  const byId = new Map(segments.map((s) => [s.segment_id, s]));
  const points: Xz[] = [];
  for (const step of steps) {
    const segment = byId.get(step.segment_id);
    if (!segment) continue;
    const geometry = segment.start_node_id === step.from_node_id ? segment.geometry : [...segment.geometry].reverse();
    geometry.forEach((p, i) => {
      if (i === 0 && points.length > 0) return; // shared joint with the previous step
      points.push({ x_m: p.x_m, z_m: p.z_m });
    });
  }
  return points;
}
