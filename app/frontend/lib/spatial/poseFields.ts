// Position fields for one pose sample (R3.2, R4.1).
// Only a valid sample carries a position. A localizing or lost sample is a
// status report: the phone has no trusted pose, so nothing is stored for it
// even if the phone sent numbers (Unity's JsonUtility always fills them with zeros).

export type PoseFields = {
  provider_pose: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number; w: number } } | null;
  world_position: { x_m: number; y_m: number; z_m: number } | null;
  heading_deg: number | null;
};

export const TRACKING_STATUSES = ["localizing", "valid", "lost"];

const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

export function poseFields(trackingStatus: string, providerPose: unknown): PoseFields | { reason: string } {
  if (trackingStatus !== "valid") {
    return { provider_pose: null, world_position: null, heading_deg: null };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pose = providerPose as any;
  const p = pose?.position;
  const r = pose?.rotation;
  if (!p || !isNum(p.x) || !isNum(p.y) || !isNum(p.z))
    return { reason: "provider_pose.position needs numeric x, y, z" };
  if (!r || !isNum(r.x) || !isNum(r.y) || !isNum(r.z) || !isNum(r.w))
    return { reason: "provider_pose.rotation needs numeric x, y, z, w" };

  // Unity is left-handed, the database world frame is right-handed (y up): negate z.
  const world_position = { x_m: p.x, y_m: p.y, z_m: -p.z };

  // Facing direction from the quaternion. 0 = world +Z, positive toward world +X.
  const fx = 2 * (r.x * r.z + r.w * r.y);
  const fz = 1 - 2 * (r.x * r.x + r.y * r.y);
  const heading_deg = (((Math.atan2(fx, -fz) * 180) / Math.PI) % 360 + 360) % 360;

  return {
    provider_pose: { position: { x: p.x, y: p.y, z: p.z }, rotation: { x: r.x, y: r.y, z: r.z, w: r.w } },
    world_position,
    heading_deg,
  };
}
