// R5 routing: shared types.
// Field names match Data Definitions V2 (graph_nodes, path_segments) so the
// same objects can come straight from Supabase or from seed/sample data.

export type Profile = 'human' | 'robot';

// Only the path_segments fields routing needs. Extra DB columns are fine.
export type RoutableSegment = {
  segment_id: string;
  start_node_id: string;
  end_node_id: string;
  direction: 'bidirectional' | 'start_to_end';
  distance_m: number;
  availability: 'open' | 'closed';
  robot_access: 'allowed' | 'restricted';
};

// One step of a route: which segment, walked in which direction.
export type RouteStep = {
  segment_id: string;
  from_node_id: string;
  to_node_id: string;
};

export type RouteStatus = 'valid' | 'unreachable' | 'invalid_input';

export type RouteResult = {
  status: RouteStatus;
  steps: RouteStep[];
  // Ordered node ids from start to end (empty unless status is 'valid').
  node_ids: string[];
  total_distance_m: number | null;
  // Plain-English reason when status is not 'valid' (shown in the UI).
  reason?: string;
  // How many nodes Dijkstra settled. Used later to compare against A*.
  nodes_explored: number;
};
