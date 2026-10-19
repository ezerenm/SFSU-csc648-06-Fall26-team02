import assert from "node:assert/strict";
import { test } from "node:test";
import { FAKE_TEST_DEVICE_ID, poseOrigin } from "../lib/spatial/poseOrigin";

test("fake-test device poses are stored as synthetic", () => {
  assert.equal(poseOrigin(FAKE_TEST_DEVICE_ID, undefined), "synthetic");
  // The client cannot upgrade a fake-test pose to real.
  assert.equal(poseOrigin(FAKE_TEST_DEVICE_ID, "real"), "synthetic");
});

test("a client can mark its own pose synthetic, but nothing else", () => {
  assert.equal(poseOrigin("iphone-17-pro", "synthetic"), "synthetic");
  assert.equal(poseOrigin("iphone-17-pro", undefined), "real");
  assert.equal(poseOrigin("iphone-17-pro", "real"), "real");
  assert.equal(poseOrigin("iphone-17-pro", "anything"), "real");
});
