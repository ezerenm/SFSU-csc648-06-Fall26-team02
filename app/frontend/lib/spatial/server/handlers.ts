import type { GraphResponse, RouteResponse, RoutingFunction } from "../contracts";
import { ApiError, respond } from "./errors";
import type { SpatialRepository } from "./repository";
import { validateRoutingResult } from "./routing";
import { attemptFilters, query, routeRequest, uuid } from "./validation";

async function visibleGraph(repository: SpatialRepository, id: string): Promise<GraphResponse> {
  const graph = await repository.graph(id);
  if (!graph) throw new ApiError(404, "MAP_NOT_FOUND", "The map was not found or is not available for this demo.");
  return graph;
}

export function createHandlers(repository: () => SpatialRepository, route: RoutingFunction | null = null) {
  return {
    graph: (request: Request) => respond(async () => {
      const params = query(request, ["map_version_id"]);
      const id = uuid(params.get("map_version_id"), "map_version_id");
      return visibleGraph(repository(), id);
    }),
    attempts: (request: Request) => respond(async () => {
      const filters = attemptFilters(request);
      const store = repository();
      const graph = await visibleGraph(store, filters.map_version_id);
      if (filters.test_point_id && !graph.test_points.some((point) => point.test_point_id === filters.test_point_id)) {
        throw new ApiError(404, "TEST_POINT_NOT_FOUND", "The test point is not available on this map.");
      }
      const result = await store.attempts(filters);
      return { ...result, limit: filters.limit, offset: filters.offset, data_origin: "synthetic" };
    }),
    route: (request: Request) => respond(async (): Promise<RouteResponse> => {
      const input = await routeRequest(request);
      const graph = await visibleGraph(repository(), input.map_version_id);
      if (!graph.nodes.some((node) => node.node_id === input.start_node_id)) {
        throw new ApiError(404, "START_NODE_NOT_FOUND", "The start node is not available on this map.");
      }
      const destination = graph.destinations.find((item) => item.destination_id === input.destination_id && item.is_active);
      if (!destination) throw new ApiError(404, "DESTINATION_NOT_FOUND", "The destination is not available on this map.");
      if (!route) throw new ApiError(503, "ROUTING_UNAVAILABLE", "Routing is awaiting Sumit's routing-function integration.");
      const rawResult = await route({
        nodes: structuredClone(graph.nodes), segments: structuredClone(graph.segments),
        start_node_id: input.start_node_id, end_node_id: destination.node_id, profile: input.profile,
      });
      const result = validateRoutingResult(rawResult, graph, input.start_node_id, destination.node_id, input.profile);
      return {
        ...result, ...input, graph_revision: graph.map_version.current_graph_revision,
        path_state_revision: graph.map_version.current_path_state_revision,
        start_mode: "manual", created_at: new Date().toISOString(),
      };
    }),
  };
}
