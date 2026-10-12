// R5 routing: shortest route on the path_segments graph (Dijkstra).
//
// Rules
//   - Closed segments are never used (R8/R9: close a segment -> reroute).
//   - The robot profile skips robot_access = 'restricted' (R17).
//   - 'start_to_end' segments can only be walked one way.
//   - No usable route -> status 'unreachable' (never a guessed path).
//
// Why Dijkstra: segment lengths differ and are never negative, so BFS would
// pick fewer hops instead of fewer meters. Runs in O((V + E) log V) with the
// heap below. A* can replace the search loop later with the same signature.
//
// Pure function: no DB, no React. The API route or the viewer passes data in.

import { MinHeap } from './minHeap';
import type { Profile, RoutableSegment, RouteResult, RouteStep } from './types';

type Edge = { to: string; distance_m: number; segment_id: string };

function fail(status: 'unreachable' | 'invalid_input', reason: string, nodesExplored = 0): RouteResult {
  return { status, steps: [], node_ids: [], total_distance_m: null, reason, nodes_explored: nodesExplored };
}

export function isUsable(segment: RoutableSegment, profile: Profile): boolean {
  if (segment.availability !== 'open') return false;
  if (profile === 'robot' && segment.robot_access !== 'allowed') return false;
  return true;
}

// Adjacency list of usable segments. Built once per call (graph is small).
function buildAdjacency(segments: RoutableSegment[], profile: Profile): Map<string, Edge[]> {
  const adjacency = new Map<string, Edge[]>();
  const add = (from: string, edge: Edge) => {
    const list = adjacency.get(from);
    if (list) list.push(edge);
    else adjacency.set(from, [edge]);
  };

  for (const s of segments) {
    if (!isUsable(s, profile)) continue;
    add(s.start_node_id, { to: s.end_node_id, distance_m: s.distance_m, segment_id: s.segment_id });
    if (s.direction === 'bidirectional') {
      add(s.end_node_id, { to: s.start_node_id, distance_m: s.distance_m, segment_id: s.segment_id });
    }
  }
  return adjacency;
}

function validate(segments: RoutableSegment[], nodeIds: Set<string>, start: string, end: string): string | null {
  if (!nodeIds.has(start)) return `Unknown start node "${start}".`;
  if (!nodeIds.has(end)) return `Unknown destination node "${end}".`;
  for (const s of segments) {
    if (!Number.isFinite(s.distance_m) || s.distance_m < 0) {
      return `Segment "${s.segment_id}" has an invalid distance (${s.distance_m}).`;
    }
    if (!nodeIds.has(s.start_node_id) || !nodeIds.has(s.end_node_id)) {
      return `Segment "${s.segment_id}" points to a node that does not exist.`;
    }
  }
  return null;
}

/**
 * Shortest route from startNodeId to endNodeId.
 * @param nodeIds every graph_nodes.node_id in the map version (used for validation)
 */
export function findRoute(
  nodeIds: Iterable<string>,
  segments: RoutableSegment[],
  startNodeId: string,
  endNodeId: string,
  profile: Profile,
): RouteResult {
  const nodes = new Set(nodeIds);
  const problem = validate(segments, nodes, startNodeId, endNodeId);
  if (problem) return fail('invalid_input', problem);

  if (startNodeId === endNodeId) {
    return { status: 'valid', steps: [], node_ids: [startNodeId], total_distance_m: 0, nodes_explored: 1 };
  }

  const adjacency = buildAdjacency(segments, profile);
  const best = new Map<string, number>([[startNodeId, 0]]);
  const cameFrom = new Map<string, RouteStep>();
  const settled = new Set<string>();
  const heap = new MinHeap<string>();
  heap.push(startNodeId, 0);

  while (heap.size > 0) {
    const { item: current, priority } = heap.pop()!;
    if (settled.has(current)) continue; // stale heap entry
    if (priority > (best.get(current) ?? Infinity)) continue;
    settled.add(current);
    if (current === endNodeId) break;

    for (const edge of adjacency.get(current) ?? []) {
      if (settled.has(edge.to)) continue;
      const candidate = priority + edge.distance_m;
      if (candidate < (best.get(edge.to) ?? Infinity)) {
        best.set(edge.to, candidate);
        cameFrom.set(edge.to, { segment_id: edge.segment_id, from_node_id: current, to_node_id: edge.to });
        heap.push(edge.to, candidate);
      }
    }
  }

  if (!settled.has(endNodeId)) {
    const why =
      profile === 'robot'
        ? 'No open, robot-allowed route to this destination.'
        : 'No open route to this destination.';
    return fail('unreachable', why, settled.size);
  }

  const steps: RouteStep[] = [];
  for (let node = endNodeId; node !== startNodeId; ) {
    const step = cameFrom.get(node)!;
    steps.unshift(step);
    node = step.from_node_id;
  }

  return {
    status: 'valid',
    steps,
    node_ids: [startNodeId, ...steps.map((s) => s.to_node_id)],
    total_distance_m: best.get(endNodeId)!,
    nodes_explored: settled.size,
  };
}
