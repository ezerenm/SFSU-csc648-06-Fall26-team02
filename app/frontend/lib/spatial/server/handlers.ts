import type { GraphResponse, RouteResponse, RoutingFunction } from "../contracts";
import { ApiError, respond } from "./errors";
import type { SpatialRepository } from "./repository";
import { validateRoutingResult } from "./routing";
import { attemptFilters, invalid, query, routeRequest, uuid } from "./validation";
import { computeAllHealth, HEALTH_MODES, HEALTH_RULES, type HealthMode } from "../health";
import { buildHealthFacts, buildSummaryPrompt, parseSummary, PROMPT_VERSION, type HealthPointView } from "../healthSummary";
import { GeminiError, type GeminiCaller } from "./gemini";

async function visibleGraph(repository: SpatialRepository, id: string): Promise<GraphResponse> {
  const graph = await repository.graph(id);
  if (!graph) throw new ApiError(404, "MAP_NOT_FOUND", "The map was not found or is not available for this demo.");
  return graph;
}

/** Reads ?mode=, defaulting to live (the 1.14 rule). */
function healthMode(value: string | null): HealthMode {
  const mode = (value ?? "live") as HealthMode;
  if (!HEALTH_MODES.includes(mode)) invalid("mode must be live or simulation.");
  return mode;
}

/** Health for every evaluation test point on a visible map. Points with no attempts get empty results. */
async function healthPoints(store: SpatialRepository, id: string, mode: HealthMode): Promise<HealthPointView[]> {
  const graph = await visibleGraph(store, id);
  const results = computeAllHealth(await store.healthAttempts(id, mode), mode);
  return graph.test_points
    .filter((point) => point.purpose === "evaluation")
    .map((point) => ({
      test_point_id: point.test_point_id,
      label: point.label,
      is_synthetic: point.is_synthetic,
      results: results.filter((result) => result.test_point_id === point.test_point_id),
    }));
}

/**
 * @param repository opens the database adapter per request
 * @param route routing function for POST /api/route (null until wired)
 * @param summarizer creates the Gemini caller for the health summary (null = no key configured)
 */
export function createHandlers(
  repository: () => SpatialRepository,
  route: RoutingFunction | null = null,
  summarizer: () => GeminiCaller | null = () => null,
) {
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
    /**
     * GET /api/health?map_version_id=<uuid>[&mode=live|simulation]
     * R14 health for every evaluation test point on a visible map.
     * Order: validate input (400) -> check the map is visible (404) -> read attempts -> compute.
     * A point with no attempts gets an empty results list; the UI shows it as gray.
     */
    health: (request: Request) => respond(async () => {
      const params = query(request, ["map_version_id", "mode"]);
      const id = uuid(params.get("map_version_id"), "map_version_id");
      const mode = healthMode(params.get("mode"));
      const points = await healthPoints(repository(), id, mode);
      return { map_version_id: id, mode, rules: HEALTH_RULES, calculated_at: new Date().toISOString(), points };
    }),
    /**
     * POST /api/health/summary?map_version_id=<uuid>[&mode=live|simulation]
     * R16.1 plain-English summary of the health above, written by Gemini.
     * POST, not GET, so link previews and prefetching never trigger a paid model call.
     * Gemini problems never fail the request: status says what happened and facts are always returned.
     */
    healthSummary: (request: Request) => respond(async () => {
      const params = query(request, ["map_version_id", "mode"]);
      const id = uuid(params.get("map_version_id"), "map_version_id");
      const mode = healthMode(params.get("mode"));
      const facts = buildHealthFacts(await healthPoints(repository(), id, mode), mode);
      const empty = { model_version: null, observations: [], suggestions: [], rejected_count: 0 };
      const base = { map_version_id: id, mode, prompt_version: PROMPT_VERSION, facts, requested_at: new Date().toISOString() };

      const gemini = summarizer();
      if (!gemini) return { ...base, ...empty, status: "unavailable" };
      try {
        const answer = await gemini(buildSummaryPrompt(facts));
        const parsed = parseSummary(answer.text, facts);
        // If every observation failed the number check, there is nothing trustworthy to show.
        const status = parsed.observations.length > 0 ? "completed" : "failed";
        return { ...base, ...parsed, model_version: answer.model_version, status, completed_at: new Date().toISOString() };
      } catch (error) {
        const status = error instanceof GeminiError && error.kind === "timed_out" ? "timed_out" : "failed";
        // Server log only: the browser gets the status, never the error details.
        console.warn(`[health-summary] ${status}: ${error instanceof Error ? error.message : "unknown error"}`);
        return { ...base, ...empty, status, completed_at: new Date().toISOString() };
      }
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
