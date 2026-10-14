# M2 graph, search and routing contracts

The implementation follows [Sumit's Data Definitions V2 at 2ec1d0c](https://github.com/ezerenm/SFSU-csc648-06-Fall26-team02/blob/2ec1d0c/milestones/M2/SpatialOS_M2_Section1_Data_Definitions.md). Runtime wire types are in [contracts.ts](../../app/frontend/lib/spatial/contracts.ts). The definitions branch has not been merged into Noah's branch.

## Coordinates and graph rules

- IDs are UUID strings, SQL/JSON names are `snake_case`, timestamps are UTC ISO 8601, position/distance units are meters, and latency units are milliseconds. Missing measurements are null, never an invented zero.
- `position` is exactly `{x_m, y_m, z_m}` with finite numeric components, each within ±1,000,000 m (a defensive indoor-data limit). The common frame is right-handed and Y-up; X/Z form the horizontal plane. The real origin and +X/+Z directions must be recorded against the selected Scaniverse model.
- The model defines the world frame, assuming its unit scale and orientation have been verified. Graph coordinates are picked in that frame. Do not assume Unity/VPS provider coordinates can be copied directly. Source axes, scale, quaternion interpretation and source-to-world conversion must be checked with Sumit, Daksh and Ezeren.
- Orientation, when later recorded, is a normalized quaternion `{x,y,z,w}` in the named frame. The M2 graph API does not ingest or return phone poses.
- One map has a current graph revision and path-state revision. Edge endpoints and destinations must reference nodes in the same map and graph revision. Attempt points must belong to the same map. SQL uses composite foreign keys for these relationships.
- A segment's geometry is an ordered array of 2-1,000 positions, from its start node to its end node. Its endpoints exactly match the corresponding node coordinates. `distance_m` is the sum of 3D geometry segment lengths within 0.01 m; it must be positive and finite. Distances are not pixel distances or route costs chosen independently of geometry. **Confirm this constraint before entering real survey data.**
- `bidirectional` permits both directions; `start_to_end` permits only start → end. A reverse traversal uses the same segment ID with reversed `from_node_id`/`to_node_id`; the viewer reverses geometry for drawing it.
- Humans use open edges. Robots use open, robot-allowed edges. `availability` and `robot_access` are independent; reopening does not reset a restriction. These fields do not implement a simulated robot or closure workflow.
- Public APIs expose only the current graph of an explicitly public demo site and a published map. During M2, maintainers should publish consistent data and avoid graph edits during demonstrations. There is no revision-management/write API; coordinated manual updates and revision increments require a reviewed transaction.

## Database decisions beyond Section 1

| Field or behavior | M2 implementation |
|---|---|
| `sites.active_map_version_id` | Must reference a published map in the same site. Clear or replace it before retiring that map. |
| `sites.is_public_demo` | Added, default false. Explicit public-graph opt-in, independent of whether the site is synthetic. |
| `destinations.graph_revision` | Added, default 1. Allows a composite FK to enforce the same revision as the node. |
| `visual_asset_id`, `session_id`, `valid_pose_sample_id` | Reserved columns constrained to null until their referenced records and validation rules are implemented. Sumit's separate M2 `pose_samples` table does not populate these fields; no dangling IDs are accepted. |
| `horizontal_error_m`, `error_is_valid` | Null and false in this M2 implementation. Verified pose/reference ingestion is not implemented. |
| Synthetic attempts | `mode=simulation`, `data_origin=synthetic`, null `sdk_version`. They cannot claim live mode or valid error. |
| Live attempts | Can be stored privately by a maintainer with `mode=live`, `data_origin=live_sdk`, and an SDK version; there is no ingestion endpoint or live evidence verification. |
| Replay attempts | `mode=replay`, `data_origin=recorded`; private under M2 policies. |
| Success | End time and latency required; both elapsed time and latency must fit 30 seconds; latency cannot exceed elapsed time. |
| Failure | End time and reason required; latency null. A timeout must cover at least 30 seconds. |
| In progress | End time, latency and failure reason are null. |
| Deletion | Foreign keys prevent deleting referenced maps, nodes or points; no cascade deletion. Public roles cannot write or delete. |

A verified test-point reference requires a non-synthetic point, reference position, method and uncertainty. Alignment points and evaluation points remain separate. These definitions are foundations for later evaluation, not a health implementation.

## HTTP conventions

All responses have `Cache-Control: no-store`. IDs are validated before querying. Unknown or repeated query parameters are rejected. Error bodies use:

```json
{"error":{"code":"INVALID_REQUEST","message":"map_version_id must be a UUID."}}
```

| HTTP status | Meaning |
|---|---|
| 200 | Successful result, including empty searches and a future integrated `unreachable` route |
| 400 | Missing/invalid IDs, filters or request fields |
| 404 | Unknown or non-public map, point, start node or destination; private existence is not revealed |
| 413 / 415 | Route JSON exceeds 4,096 bytes / wrong content type |
| 502 | Integrated routing function returns an invalid path |
| 503 | Database/configuration unavailable, or routing integration missing |
| 500 | Unexpected server failure with a generic message |

Each database request has a five-second timeout. Route exceptions and upstream database details never appear in client error messages. M2 APIs use only the publishable/anon key; even signed-in callers get the same public demo view. Authorization for private trial access and writes is deferred.

## Graph API for Ezeren

```http
GET /api/graph?map_version_id=20000000-0000-4000-8000-000000000001
```

The [complete seed graph response](examples/graph-response.json) was exported from the local database. It contains:

| Property | Contents |
|---|---|
| `site` | Site ID, display name and `is_test_site` |
| `map_version` | IDs, version label, world frame, current graph/path-state revisions |
| `nodes` | UUIDs, labels, positions and map/revision IDs |
| `segments` | Endpoint IDs, geometry, direction, distance, availability and robot access |
| `destinations` | Active destination IDs, names and node references |
| `test_points` | Public synthetic point IDs/labels for search controls |

The graph RPC uses one SQL statement so its metadata and arrays share a database snapshot. No model URL is invented or returned. Ezeren supplies the reviewed model URL from the agreed map configuration. Draft/private maps return 404; a published map with no graph records returns empty arrays.

The field names match the viewer's temporary graph types. Temporary `N1`/`D1` strings are labels only; actual API IDs are UUIDs. `SceneViewer` can receive the graph arrays directly. Its route input remains the ordered `steps` array. The existing viewer branch has not been altered here.

## Localization-attempt search API

```http
GET /api/localization-attempts?map_version_id=20000000-0000-4000-8000-000000000001&test_point_id=60000000-0000-4000-8000-000000000002&outcome=timeout
```

| Parameter | Meaning |
|---|---|
| `map_version_id` | Required UUID |
| `test_point_id` | Optional UUID; must be a public synthetic point on the selected map |
| `outcome` | Optional: `in_progress`, `success`, `timeout`, `tracking_loss`, `network_error`, `map_mismatch`, `cancelled`, `other_failure` |
| `q` | Optional case-insensitive test-point-label substring, trimmed, 1-120 characters. `%`, `_` and backslash are literal; `*` is rejected to avoid PostgREST's wildcard alias. |
| `limit` | Integer 1-100; default 50 |
| `offset` | Integer 0-10,000; default 0 |

Filters combine with AND. Results sort by `started_at` descending, then `attempt_id` ascending. `total` counts all matching rows before pagination. `items` includes the typed attempt fields and `test_point: {label}`. Only synthetic attempts on visible synthetic points are returned.

```json
{"items":[],"total":0,"limit":50,"offset":0,"data_origin":"synthetic"}
```

“No matches” is not an error. An out-of-range page also returns empty items, with a refreshed filtered count. This handles [PostgREST's documented range error](https://docs.postgrest.org/en/latest/references/errors.html#group-1-api-request) without treating a late page as a database outage. Counts and page boundaries can change if a maintainer edits records between requests.

## Route API

```http
POST /api/route
Content-Type: application/json
```

```json
{
  "map_version_id": "20000000-0000-4000-8000-000000000001",
  "start_node_id": "30000000-0000-4000-8000-000000000001",
  "destination_id": "50000000-0000-4000-8000-000000000001",
  "profile": "human"
}
```

All four fields are required. M2 accepts a manually selected node, not coordinates or a live pose. The API calls Sumit's Dijkstra function through an adapter. Human, robot and unreachable responses passed through local Next.js against the shared Supabase graph; deployed behavior remains unverified. Invalid requests and missing graph entities are reported accurately.

Successful responses include the input IDs/profile, `graph_revision`, `path_state_revision`, `start_mode: "manual"`, `created_at`, `status`, `steps`, and `total_distance_m`. Each step is `{segment_id, from_node_id, to_node_id}`. Routes are not stored in M2.

- `valid`: ordered permitted path and summed distance. Start already at destination gives empty steps and distance 0.
- `unreachable`: empty steps and null distance. This is distinct from missing routing software or a database outage.

The API checks continuity, direction, open status, robot restrictions, endpoint, absence of cycles, and distance before returning a path. It does not prove shortest-path optimality or independently validate an unreachable result; those belong to the routing implementation's tests.

## Routing function contract for Sumit

```ts
type RoutingFunction = (input: {
  nodes: readonly GraphNode[];
  segments: readonly PathSegment[];
  start_node_id: string;
  end_node_id: string;
  profile: "human" | "robot";
}) => RoutingResult | Promise<RoutingResult>;
```

`RoutingResult` is `{status: "valid", steps: RouteStep[], total_distance_m: number}` or `{status: "unreachable", steps: [], total_distance_m: null}`. The API resolves the destination to `end_node_id` before calling the function. The function must be deterministic and side-effect free; it must honor direction, availability and profile rules using only the supplied snapshot.

The [server adapter](../../app/frontend/lib/spatial/server/routing.ts) calls Sumit's pure function copied from `origin/feature/r5-routing` at `ab1db5c`. Database access stays outside Dijkstra. [Seed expectations](SEED_GUIDE.md#hand-calculated-routing-expectations) cover one-way edges, closed edges, robot restrictions, disconnected destinations and a zero-length route. The API has both injected test doubles and integration tests against the actual routing function.
