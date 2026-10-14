import type { GraphResponse, Profile, RoutingFunction, RoutingResult } from "../contracts";
import { findRoute } from "../../routing";
import { ApiError } from "./errors";

/** Adapt Sumit's pure shortest-path function to the M2 route response contract. */
export const routingFunction: RoutingFunction = ({ nodes, segments, start_node_id, end_node_id, profile }) => {
  const result = findRoute(nodes.map((node) => node.node_id), [...segments], start_node_id, end_node_id, profile);
  if (result.status === "invalid_input") {
    throw new ApiError(502, "INVALID_GRAPH", "The map graph cannot be routed.");
  }
  if (result.status === "unreachable") return { status: "unreachable", steps: [], total_distance_m: null };
  if (result.total_distance_m === null) {
    throw new ApiError(502, "INVALID_ROUTING_RESULT", "The routing function returned an invalid result.");
  }
  return { status: "valid", steps: result.steps, total_distance_m: result.total_distance_m };
};

/** Validate the returned path against the database snapshot before sending it to a viewer.
 * Shortest-path correctness and unreachable detection belong to Sumit's routing tests.
 */
export function validateRoutingResult(
  result: RoutingResult, graph: GraphResponse, start: string, end: string, profile: Profile,
): RoutingResult {
  const bad = (): never => { throw new ApiError(502, "INVALID_ROUTING_RESULT", "The routing function returned an invalid result."); };
  if (!result || !Array.isArray(result.steps)) bad();
  if (result.status === "unreachable") {
    if (start === end || result.steps.length !== 0 || result.total_distance_m !== null) bad();
    return { status: "unreachable", steps: [], total_distance_m: null };
  }
  if (result.status !== "valid" || !Number.isFinite(result.total_distance_m) || result.total_distance_m < 0
      || result.steps.length > graph.nodes.length - 1) bad();
  const segments = new Map(graph.segments.map((segment) => [segment.segment_id, segment]));
  const visited = new Set([start]);
  let current = start;
  let distance = 0;
  const steps = result.steps.map((step) => {
    if (!step) bad();
    const segment = segments.get(step.segment_id);
    if (!segment || step.from_node_id !== current || segment.availability !== "open"
        || (profile === "robot" && segment.robot_access !== "allowed")) return bad();
    const forward = step.from_node_id === segment.start_node_id && step.to_node_id === segment.end_node_id;
    const reverse = segment.direction === "bidirectional" && step.from_node_id === segment.end_node_id
      && step.to_node_id === segment.start_node_id;
    if ((!forward && !reverse) || visited.has(step.to_node_id)) bad();
    visited.add(step.to_node_id);
    current = step.to_node_id;
    distance += segment.distance_m;
    return { segment_id: step.segment_id, from_node_id: step.from_node_id, to_node_id: step.to_node_id };
  });
  if (current !== end || Math.abs(distance - result.total_distance_m) > 0.000001 * Math.max(1, distance)) bad();
  return { status: "valid", steps, total_distance_m: distance };
}
