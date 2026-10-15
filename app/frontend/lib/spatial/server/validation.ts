import { OUTCOMES, type AttemptFilters, type Outcome, type RouteRequest } from "../contracts";
import { ApiError } from "./errors";

export function invalid(message: string): never {
  throw new ApiError(400, "INVALID_REQUEST", message);
}

export function uuid(value: unknown, name: string): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    invalid(`${name} must be a UUID.`);
  }
  return value.toLowerCase();
}

export function query(request: Request, allowed: string[]): URLSearchParams {
  const params = new URL(request.url).searchParams;
  for (const key of params.keys()) {
    if (!allowed.includes(key) || params.getAll(key).length !== 1) {
      invalid(`Unknown or repeated query parameter: ${key.slice(0, 80)}.`);
    }
  }
  return params;
}

function integer(value: string | null, name: string, fallback: number, min: number, max: number): number {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max) {
    invalid(`${name} must be an integer from ${min} to ${max}.`);
  }
  return Number(value);
}

export function attemptFilters(request: Request): AttemptFilters {
  const params = query(request, ["map_version_id", "test_point_id", "outcome", "q", "limit", "offset"]);
  const filters: AttemptFilters = {
    map_version_id: uuid(params.get("map_version_id"), "map_version_id"),
    limit: integer(params.get("limit"), "limit", 50, 1, 100),
    offset: integer(params.get("offset"), "offset", 0, 0, 10000),
  };
  if (params.has("test_point_id")) filters.test_point_id = uuid(params.get("test_point_id"), "test_point_id");
  if (params.has("outcome")) {
    const outcome = params.get("outcome") as Outcome;
    if (!OUTCOMES.includes(outcome)) invalid("outcome is not a supported localization outcome.");
    filters.outcome = outcome;
  }
  if (params.has("q")) {
    const value = params.get("q")!.trim();
    if (value.length < 1 || value.length > 120) invalid("q must contain 1 to 120 characters.");
    if (value.includes("*")) invalid("q cannot contain an asterisk.");
    filters.q = value;
  }
  return filters;
}

export async function routeRequest(request: Request): Promise<RouteRequest> {
  query(request, []);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Use application/json.");
  }
  // Bound the actual stream, including chunked requests without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) invalid("A JSON request body is required.");
  let size = 0;
  const decoder = new TextDecoder();
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        throw new ApiError(413, "REQUEST_TOO_LARGE", "Route requests must be at most 4096 bytes.");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  let body: unknown;
  try { body = JSON.parse(text); } catch { invalid("The request body must be valid JSON."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) invalid("The body must be a JSON object.");
  const value = body as Record<string, unknown>;
  const keys = ["map_version_id", "start_node_id", "destination_id", "profile"];
  if (Object.keys(value).some((key) => !keys.includes(key))) invalid("The body contains unsupported fields.");
  if (value.profile !== "human" && value.profile !== "robot") invalid("profile must be human or robot.");
  return {
    map_version_id: uuid(value.map_version_id, "map_version_id"),
    start_node_id: uuid(value.start_node_id, "start_node_id"),
    destination_id: uuid(value.destination_id, "destination_id"),
    profile: value.profile,
  };
}
