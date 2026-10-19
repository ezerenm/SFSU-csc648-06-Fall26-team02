/** Device id the Unity uploader uses when "Send Fake Pose" is on (PoseUploader.cs). */
export const FAKE_TEST_DEVICE_ID = "fake-test";

export type PoseOrigin = "real" | "synthetic";

/**
 * Decided on the server, never trusted from the client as "real":
 * the fake-test device, or a client that says its pose is synthetic, is stored as synthetic.
 */
export function poseOrigin(deviceId: string, claimed: unknown): PoseOrigin {
  if (deviceId === FAKE_TEST_DEVICE_ID) return "synthetic";
  if (claimed === "synthetic") return "synthetic";
  return "real";
}
