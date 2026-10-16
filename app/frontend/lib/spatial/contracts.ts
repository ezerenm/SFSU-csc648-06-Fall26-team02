/** Shared M2 wire formats. SQL and JSON use the team's snake_case names. */
export type Position = { x_m: number; y_m: number; z_m: number };
export type Profile = "human" | "robot";
export type WorldFrame = {
  frame_id: string;
  origin_description: string;
  handedness: "right";
  up_axis: "y";
  units: "meters";
};
export type GraphNode = {
  node_id: string;
  map_version_id: string;
  graph_revision: number;
  label: string;
  position: Position;
};
export type PathSegment = {
  segment_id: string;
  map_version_id: string;
  graph_revision: number;
  label: string;
  start_node_id: string;
  end_node_id: string;
  direction: "bidirectional" | "start_to_end";
  distance_m: number;
  geometry: Position[];
  availability: "open" | "closed";
  robot_access: "allowed" | "restricted";
  last_state_revision: number;
};
export type Destination = {
  destination_id: string;
  site_id: string;
  map_version_id: string;
  graph_revision: number;
  node_id: string;
  name: string;
  description: string;
  is_active: boolean;
};
export type TestPointOption = {
  test_point_id: string;
  map_version_id: string;
  label: string;
  purpose: "evaluation" | "alignment";
  is_synthetic: boolean;
};
export type GraphResponse = {
  site: { site_id: string; name: string; is_test_site: boolean };
  map_version: {
    map_version_id: string;
    site_id: string;
    version_label: string;
    world_frame: WorldFrame;
    current_graph_revision: number;
    current_path_state_revision: number;
  };
  nodes: GraphNode[];
  segments: PathSegment[];
  destinations: Destination[];
  test_points: TestPointOption[];
};

export const OUTCOMES = [
  "in_progress", "success", "timeout", "tracking_loss", "network_error",
  "map_mismatch", "cancelled", "other_failure",
] as const;
export type Outcome = (typeof OUTCOMES)[number];
export type AttemptFilters = {
  map_version_id: string;
  test_point_id?: string;
  outcome?: Outcome;
  /** Literal case-insensitive substring of the test-point label. */
  q?: string;
  limit: number;
  offset: number;
};
export type LocalizationAttempt = {
  attempt_id: string;
  map_version_id: string;
  test_point_id: string;
  device_id: string;
  sdk_version: string | null;
  mode: "simulation";
  data_origin: "synthetic";
  condition_label: string;
  camera_direction: string;
  started_at: string;
  ended_at: string | null;
  outcome: Outcome;
  latency_ms: number | null;
  failure_reason: string | null;
  horizontal_error_m: null;
  error_is_valid: false;
  received_at: string;
  test_point: { label: string };
};
export type AttemptSearchResponse = {
  items: LocalizationAttempt[];
  total: number;
  limit: number;
  offset: number;
  data_origin: "synthetic";
};

export type RouteRequest = {
  map_version_id: string;
  start_node_id: string;
  destination_id: string;
  profile: Profile;
};
export type RouteStep = { segment_id: string; from_node_id: string; to_node_id: string };
export type RoutingResult =
  | { status: "valid"; steps: RouteStep[]; total_distance_m: number }
  | { status: "unreachable"; steps: []; total_distance_m: null };
/** Sumit's function must be deterministic, side-effect free, and use only this snapshot. */
export type RoutingFunction = (input: {
  nodes: readonly GraphNode[];
  segments: readonly PathSegment[];
  start_node_id: string;
  end_node_id: string;
  profile: Profile;
}) => RoutingResult | Promise<RoutingResult>;
export type RouteResponse = RoutingResult & RouteRequest & {
  graph_revision: number;
  path_state_revision: number;
  start_mode: "manual";
  created_at: string;
};
export type ApiErrorBody = { error: { code: string; message: string } };
