// Operator changes to one path segment (R8.1, R8.2, R17.1, R17.2).
// Open/closed and robot access are separate fields, so closing or reopening
// never touches the robot restriction, and the other way around.

import type { PathSegment } from "./contracts";

export const SEGMENT_ACTIONS = ["close", "reopen", "humans_only", "allow_robots"] as const;
export type SegmentAction = (typeof SEGMENT_ACTIONS)[number];

export type SegmentState = Pick<PathSegment, "availability" | "robot_access">;

export function isSegmentAction(value: unknown): value is SegmentAction {
  return typeof value === "string" && (SEGMENT_ACTIONS as readonly string[]).includes(value);
}

/** The segment state after an action. Only the field the action is about changes. */
export function applySegmentAction(state: SegmentState, action: SegmentAction): SegmentState {
  switch (action) {
    case "close":
      return { ...state, availability: "closed" };
    case "reopen":
      return { ...state, availability: "open" };
    case "humans_only":
      return { ...state, robot_access: "restricted" };
    case "allow_robots":
      return { ...state, robot_access: "allowed" };
  }
}

/** Plain words for the operator screen, e.g. "Closed . humans only". */
export function describeSegmentState(state: SegmentState): string {
  const open = state.availability === "open" ? "Open" : "Closed";
  const robots = state.robot_access === "allowed" ? "robots allowed" : "humans only";
  return `${open} . ${robots}`;
}
