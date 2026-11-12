import assert from "node:assert/strict";
import { test } from "node:test";
import { applySegmentAction, describeSegmentState, isSegmentAction } from "../lib/spatial/segmentChange";

const open = { availability: "open", robot_access: "allowed" } as const;

test("close and reopen change only availability (R8.1, R8.2)", () => {
  const closed = applySegmentAction(open, "close");
  assert.deepEqual(closed, { availability: "closed", robot_access: "allowed" });
  assert.deepEqual(applySegmentAction(closed, "reopen"), open);
});

test("humans only and allow robots change only robot access (R17.1)", () => {
  const humansOnly = applySegmentAction(open, "humans_only");
  assert.deepEqual(humansOnly, { availability: "open", robot_access: "restricted" });
  assert.deepEqual(applySegmentAction(humansOnly, "allow_robots"), open);
});

test("a robot restriction survives close and reopen (R17.2)", () => {
  let state = applySegmentAction(open, "humans_only");
  state = applySegmentAction(state, "close");
  state = applySegmentAction(state, "reopen");
  assert.deepEqual(state, { availability: "open", robot_access: "restricted" });
});

test("only the four actions are accepted", () => {
  for (const action of ["close", "reopen", "humans_only", "allow_robots"]) assert.ok(isSegmentAction(action));
  for (const action of ["delete", "", null, undefined, 1, "CLOSE"]) assert.ok(!isSegmentAction(action));
});

test("segment state reads in plain words", () => {
  assert.equal(describeSegmentState(open), "Open . robots allowed");
  assert.equal(describeSegmentState({ availability: "closed", robot_access: "restricted" }), "Closed . humans only");
});
