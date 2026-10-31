// R9 rerouting helpers: notice when path segments change and say what changed.
//
// The live page reloads the graph every few seconds. Comparing fingerprints tells it
// whether anything that affects routes changed (a closure or a robot restriction),
// so it only recalculates the route when it has to.
//
// Pure functions: no network, no React.
//
// Author: Sumit, Oct 31 2026

import type { GraphResponse, PathSegment } from "./contracts";

/**
 * A short string that changes whenever a route could change: the graph revision,
 * or any segment's open/closed or robot allowed/restricted state.
 * @param graph the graph from /api/graph
 * @returns the same string for the same path state, in any segment order
 */
export function pathStateKey(graph: Pick<GraphResponse, "map_version" | "segments">): string {
  const segments = [...graph.segments]
    .sort((a, b) => a.segment_id.localeCompare(b.segment_id))
    .map((s) => `${s.segment_id}:${s.availability}:${s.robot_access}`);
  return `${graph.map_version.current_graph_revision}#${segments.join(",")}`;
}

/**
 * Plain-words list of what changed between two graph loads, for the reroute banner.
 * @param before segments from the previous load
 * @param after segments from the new load
 * @returns e.g. ["S2 N2 to N3 closed", "S4 N4 to N5 restricted for robots"]
 */
export function describePathChange(before: PathSegment[], after: PathSegment[]): string[] {
  const old = new Map(before.map((s) => [s.segment_id, s]));
  const changes: string[] = [];
  for (const segment of after) {
    const previous = old.get(segment.segment_id);
    if (!previous) continue; // new segments come with a new graph revision, not a closure
    if (previous.availability !== segment.availability) {
      changes.push(`${segment.label} ${segment.availability === "closed" ? "closed" : "reopened"}`);
    }
    if (previous.robot_access !== segment.robot_access) {
      changes.push(`${segment.label} ${segment.robot_access === "restricted" ? "restricted for robots" : "open to robots again"}`);
    }
  }
  return changes;
}
