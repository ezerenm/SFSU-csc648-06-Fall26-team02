import assert from "node:assert/strict";
import { test } from "node:test";
import { poseFields } from "../lib/spatial/poseFields";

const pose = { position: { x: 1, y: 0.5, z: 2 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };

test("a valid sample stores its pose, world position and heading", () => {
  const f = poseFields("valid", pose);
  assert.ok(!("reason" in f));
  assert.deepEqual(f.provider_pose, pose);
  // Unity z is flipped into the right-handed world frame.
  assert.deepEqual(f.world_position, { x_m: 1, y_m: 0.5, z_m: -2 });
  assert.equal(f.heading_deg, 180);
});

test("a valid sample without a full pose is rejected", () => {
  assert.deepEqual(poseFields("valid", undefined), { reason: "provider_pose.position needs numeric x, y, z" });
  assert.deepEqual(poseFields("valid", { position: pose.position }), { reason: "provider_pose.rotation needs numeric x, y, z, w" });
  assert.ok("reason" in poseFields("valid", { ...pose, position: { x: 1, y: "0", z: 2 } }));
});

test("localizing and lost samples are accepted without a position (R4.1)", () => {
  for (const status of ["localizing", "lost"]) {
    assert.deepEqual(poseFields(status, undefined), { provider_pose: null, world_position: null, heading_deg: null });
  }
});

test("numbers sent with a lost sample are ignored, so the dot never jumps", () => {
  // Unity's JsonUtility always fills the pose, so a lost sample arrives with zeros.
  const zeros = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 0 } };
  assert.deepEqual(poseFields("lost", zeros), { provider_pose: null, world_position: null, heading_deg: null });
  assert.deepEqual(poseFields("localizing", pose), { provider_pose: null, world_position: null, heading_deg: null });
});
