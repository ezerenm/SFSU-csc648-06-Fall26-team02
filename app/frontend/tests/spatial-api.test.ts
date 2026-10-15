import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import type { GraphResponse, RouteRequest, RoutingFunction, RoutingResult } from "../lib/spatial/contracts";
import { createHandlers } from "../lib/spatial/server/handlers";
import { createSpatialRepository, supabaseRepository, type SpatialRepository } from "../lib/spatial/server/repository";
import { ApiError } from "../lib/spatial/server/errors";
import { routingFunction, validateRoutingResult } from "../lib/spatial/server/routing";

// Fixture exported from the actual local migration + seed, not a live map.
const graph = JSON.parse(readFileSync("../../milestones/M2/examples/graph-response.json", "utf8")) as GraphResponse;
const map = graph.map_version.map_version_id;
const id = (prefix: number, n: number) => `${prefix}0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const repository: SpatialRepository = {
  graph: async (value) => value === map ? structuredClone(graph) : null,
  attempts: async () => ({ items: [], total: 0 }),
};
const get = (path: string) => new Request(`http://localhost${path}`);
const routeBody: RouteRequest = { map_version_id: map, start_node_id: id(3, 1), destination_id: id(5, 1), profile: "human" };
const post = (value: unknown = routeBody, contentType = "application/json") => new Request("http://localhost/api/route", {
  method: "POST", headers: { "Content-Type": contentType }, body: JSON.stringify(value),
});
const handlers = createHandlers(() => repository);
const step = (segment: number, from: number, to: number) => ({ segment_id: id(4, segment), from_node_id: id(3, from), to_node_id: id(3, to) });
const humanResult: RoutingResult = { status: "valid", steps: [step(1, 1, 2), step(2, 2, 3)], total_distance_m: 8 };

for (const [label, path] of [
  ["missing map", "/api/graph"],
  ["invalid UUID", "/api/graph?map_version_id=bad"],
  ["duplicate map", `/api/graph?map_version_id=${map}&map_version_id=${map}`],
  ["unknown parameter", `/api/graph?map_version_id=${map}&typo=1`],
]) {
  test(`graph rejects ${label} before opening a database connection`, async () => {
    const api = createHandlers(() => { throw new Error("must not open"); });
    assert.equal((await api.graph(get(path))).status, 400);
  });
}

test("graph returns exact seeded wire shapes with no-store", async () => {
  const response = await handlers.graph(get(`/api/graph?map_version_id=${map.toUpperCase()}`));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), graph);
  assert.equal(graph.nodes.length, 8);
  assert.equal(graph.segments.length, 10);
});
test("invisible or missing map returns 404 without revealing which", async () => {
  assert.equal((await handlers.graph(get(`/api/graph?map_version_id=${id(2, 99)}`))).status, 404);
});

for (const bad of ["outcome=unknown", "outcome=", "test_point_id=bad", "limit=0", "limit=101", "offset=-1", "offset=10001", "limit=1.5", "q=", `q=${"x".repeat(121)}`, "outcome=success&outcome=timeout"]) {
  test(`search rejects ${bad.slice(0, 45)}`, async () => {
    assert.equal((await handlers.attempts(get(`/api/localization-attempts?map_version_id=${map}&${bad}`))).status, 400);
  });
}
test("search passes combined point, outcome, label and page filters", async () => {
  const api = createHandlers(() => ({ ...repository, attempts: async (filters) => {
    assert.deepEqual(filters, { map_version_id: map, test_point_id: id(6, 2), outcome: "timeout", q: "TP2", limit: 5, offset: 1 });
    return { items: [], total: 1 };
  } }));
  const response = await api.attempts(get(`/api/localization-attempts?map_version_id=${map}&test_point_id=${id(6, 2)}&outcome=timeout&q=TP2&limit=5&offset=1`));
  assert.deepEqual(await response.json(), { items: [], total: 1, limit: 5, offset: 1, data_origin: "synthetic" });
});
test("no matches is a successful empty list", async () => {
  const response = await handlers.attempts(get(`/api/localization-attempts?map_version_id=${map}&outcome=in_progress`));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { items: [], total: 0, limit: 50, offset: 0, data_origin: "synthetic" });
});
test("test point outside the visible map returns 404", async () => {
  const response = await handlers.attempts(get(`/api/localization-attempts?map_version_id=${map}&test_point_id=${id(6, 99)}`));
  assert.equal(response.status, 404);
});
test("database failures return sanitized 503; unknown exceptions return sanitized 500", async () => {
  for (const error of [new ApiError(503, "DATABASE_UNAVAILABLE", "Try again."), new Error("sensitive internal detail")]) {
    const api = createHandlers(() => ({ ...repository, graph: async () => { throw error; } }));
    const response = await api.graph(get(`/api/graph?map_version_id=${map}`));
    assert.equal(response.status, error instanceof ApiError ? 503 : 500);
    assert.ok(!(await response.text()).includes("sensitive internal detail"));
  }
});
test("integrated router returns the shortest human route on the seeded graph", async () => {
  const response = await createHandlers(() => repository, routingFunction).route(post());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, "valid");
  assert.deepEqual(body.steps, humanResult.steps);
  assert.equal(body.total_distance_m, 8);
});
test("integrated router respects robot restrictions", async () => {
  const response = await createHandlers(() => repository, routingFunction).route(post({ ...routeBody, profile: "robot" }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.steps, [step(1, 1, 2), step(3, 2, 4), step(4, 4, 5), step(5, 5, 3)]);
  assert.equal(body.total_distance_m, 16);
});
test("integrated router reports unreachable and zero-distance routes", async () => {
  const api = createHandlers(() => repository, routingFunction);
  const unreachable = await api.route(post({ ...routeBody, destination_id: id(5, 3) }));
  assert.equal(unreachable.status, 200);
  const unreachableResult = await unreachable.json();
  assert.equal(unreachableResult.status, "unreachable");
  assert.deepEqual(unreachableResult.steps, []);
  assert.equal(unreachableResult.total_distance_m, null);
  const atDestination = await api.route(post({ ...routeBody, start_node_id: id(3, 3) }));
  assert.equal(atDestination.status, 200);
  const result = await atDestination.json();
  assert.deepEqual(result.steps, []);
  assert.equal(result.total_distance_m, 0);
});
test("integrated router fails safely when the graph snapshot is inconsistent", async () => {
  const inconsistent = structuredClone(graph);
  inconsistent.segments[0].end_node_id = id(3, 99);
  const api = createHandlers(() => ({ ...repository, graph: async () => inconsistent }), routingFunction);
  const response = await api.route(post());
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error.code, "INVALID_GRAPH");
});
for (const value of [null, [], {}, { ...routeBody, profile: "car" }, { ...routeBody, start_node_id: "N1" }, { ...routeBody, start_position: { x_m: 0 } }]) {
  test(`route rejects invalid body ${JSON.stringify(value).slice(0, 60)}`, async () => {
    assert.equal((await handlers.route(post(value))).status, 400);
  });
}
test("route rejects wrong content type, invalid JSON and oversized streamed bodies", async () => {
  assert.equal((await handlers.route(post(routeBody, "text/plain"))).status, 415);
  const request = new Request("http://localhost/api/route", { method: "POST", headers: { "content-type": "application/json" }, body: "{" });
  assert.equal((await handlers.route(request)).status, 400);
  assert.equal((await handlers.route(post({ ...routeBody, padding: "x".repeat(5000) }))).status, 413);
});
test("valid UUIDs for missing start/destination are rejected", async () => {
  for (const value of [{ ...routeBody, start_node_id: id(3, 99) }, { ...routeBody, destination_id: id(5, 99) }]) {
    assert.equal((await handlers.route(post(value))).status, 404);
  }
});
test("injected routing adapter receives one graph snapshot and result gains revision metadata", async () => {
  const stub: RoutingFunction = (input) => {
    assert.deepEqual(input.nodes, graph.nodes);
    assert.deepEqual(input.segments, graph.segments);
    assert.equal(input.start_node_id, id(3, 1));
    assert.equal(input.end_node_id, id(3, 3));
    assert.equal(input.profile, "human");
    return humanResult;
  };
  const response = await createHandlers(() => repository, stub).route(post());
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result.steps, humanResult.steps);
  assert.equal(result.total_distance_m, 8);
  assert.equal(result.graph_revision, 1);
  assert.equal(result.path_state_revision, 1);
  assert.equal(result.start_mode, "manual");
});
test("unreachable result remains a 200 domain result with null distance", async () => {
  const response = await createHandlers(() => repository, () => ({ status: "unreachable", steps: [], total_distance_m: null }))
    .route(post({ ...routeBody, destination_id: id(5, 3) }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).total_distance_m, null);
});
test("start at destination is valid with zero distance and no steps", () => {
  assert.deepEqual(validateRoutingResult({ status: "valid", steps: [], total_distance_m: 0 }, graph, id(3, 3), id(3, 3), "human"),
    { status: "valid", steps: [], total_distance_m: 0 });
});
test("robot's hand-calculated allowed path validates", () => {
  const result: RoutingResult = { status: "valid", steps: [step(1, 1, 2), step(3, 2, 4), step(4, 4, 5), step(5, 5, 3)], total_distance_m: 16 };
  assert.deepEqual(validateRoutingResult(result, graph, id(3, 1), id(3, 3), "robot"), result);
});
for (const [label, result, start, end, profile] of [
  ["robot restricted segment", humanResult, id(3, 1), id(3, 3), "robot"],
  ["closed segment", { status: "valid", steps: [step(9, 7, 8)], total_distance_m: 4 }, id(3, 7), id(3, 8), "human"],
  ["reverse one-way", { status: "valid", steps: [step(5, 3, 5)], total_distance_m: 4 }, id(3, 3), id(3, 5), "human"],
  ["wrong distance", { ...humanResult, total_distance_m: 9 }, id(3, 1), id(3, 3), "human"],
  ["disconnected steps", { status: "valid", steps: [step(2, 2, 3)], total_distance_m: 4 }, id(3, 1), id(3, 3), "human"],
  ["wrong destination", humanResult, id(3, 1), id(3, 6), "human"],
  ["unknown edge", { status: "valid", steps: [step(99, 1, 3)], total_distance_m: 4 }, id(3, 1), id(3, 3), "human"],
] as const) {
  test(`routing guard rejects ${label}`, () => {
    assert.throws(() => validateRoutingResult(result as RoutingResult, graph, start, end, profile), { code: "INVALID_ROUTING_RESULT" });
  });
}

function client(fetcher: typeof fetch) {
  return createClient("https://example.supabase.co", "test-only-publishable-key", {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetcher },
  });
}
test("Supabase adapter uses graph RPC and the requested UUID", async () => {
  const store = supabaseRepository(client(async (input, init) => {
    assert.equal(new URL(String(input)).pathname, "/rest/v1/rpc/m2_get_graph");
    assert.deepEqual(JSON.parse(String(init?.body)), { requested_map_version_id: map });
    return Response.json(graph);
  }));
  assert.deepEqual(await store.graph(map), graph);
});
test("Supabase adapter applies AND filters, stable ordering, literal search and pagination", async () => {
  const store = supabaseRepository(client(async (input) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get("map_version_id"), `eq.${map}`);
    assert.equal(url.searchParams.get("test_point_id"), `eq.${id(6, 2)}`);
    assert.equal(url.searchParams.get("outcome"), "eq.timeout");
    assert.equal(url.searchParams.get("data_origin"), "eq.synthetic");
    assert.equal(url.searchParams.get("test_point.label"), "ilike.%TP\\_2\\%%");
    assert.equal(url.searchParams.get("order"), "started_at.desc,attempt_id.asc");
    assert.equal(url.searchParams.get("offset"), "2");
    assert.equal(url.searchParams.get("limit"), "3");
    return Response.json([], { headers: { "Content-Range": "*/0" } });
  }));
  assert.deepEqual(await store.attempts({ map_version_id: map, test_point_id: id(6, 2), outcome: "timeout", q: "TP_2%", offset: 2, limit: 3 }), { items: [], total: 0 });
});
test("Supabase errors and network failures never expose upstream details", async () => {
  for (const fetcher of [async () => Response.json({ message: "private database detail" }, { status: 500 }), async () => { throw new Error("network secret"); }]) {
    const store = supabaseRepository(client(fetcher));
    await assert.rejects(store.graph(map), { code: "DATABASE_UNAVAILABLE" });
    await assert.rejects(store.attempts({ map_version_id: map, limit: 50, offset: 0 }), { code: "DATABASE_UNAVAILABLE" });
  }
});
test("server configuration rejects missing or privileged keys", () => {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    for (const key of ["", "sb_secret_test", `a.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.b`]) {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = key;
      assert.throws(createSpatialRepository, { code: "CONFIGURATION_ERROR" });
    }
  } finally {
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = oldKey;
  }
});

test("search rejects PostgREST wildcard aliases", async () => {
  const response = await handlers.attempts(get(`/api/localization-attempts?map_version_id=${map}&q=*`));
  assert.equal(response.status, 400);
});
test("out-of-range pages return an empty list with the filtered total", async () => {
  let calls = 0;
  const store = supabaseRepository(client(async (input) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get("outcome"), "eq.success");
    calls++;
    if (calls === 1) return Response.json({ code: "PGRST103", message: "Requested range not satisfiable" }, { status: 416 });
    assert.equal(url.searchParams.get("offset"), "0");
    assert.equal(url.searchParams.get("limit"), "1");
    return Response.json([{ attempt_id: id(7, 1) }], { headers: { "Content-Range": "0-0/4" } });
  }));
  assert.deepEqual(await store.attempts({ map_version_id: map, outcome: "success", limit: 50, offset: 100 }), { items: [], total: 4 });
  assert.equal(calls, 2);
});
