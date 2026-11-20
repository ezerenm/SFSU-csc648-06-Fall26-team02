// R12.4 GET /api/failures test

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { GraphResponse } from "../lib/spatial/contracts";
import type { FailureFilters, FailureRow } from "../lib/spatial/failures";
import { createHandlers } from "../lib/spatial/server/handlers";
import type { SpatialRepository } from "../lib/spatial/server/repository";

// TEST DATA ------------------------------------------------------------------

const graph = JSON.parse(readFileSync("../../milestones/M2/examples/graph-response.json", "utf8")) as GraphResponse;

const map = graph.map_version.map_version_id;
const testPointId = graph.test_points[0].test_point_id;
const get = (path: string) => new Request("http://localhost" + path);

const failureRow: FailureRow = {

    attempt_id: "70000000-0000-4000-8000-000000000001",
    failure_type: "timeout",
    failure_reason: "No pose after 30 seconds",
    test_point_id: testPointId,
    test_point_label: "TP1",
    device_id: "iphone-daksh",
    started_at: "2026-11-10T20:00:00Z",
    ended_at: "2026-11-10T20:00:30Z",
    mode: "live",
    data_origin: "live_sdk",
    tracking_status_before: "lost",

};

function api(seenFilters: FailureFilters[] = []) {
    const repository: SpatialRepository = {
        graph: async (id) => (id === map ? structuredClone(graph) : null),
        attempts: async () => ({ items: [], total: 0 }),
        healthAttempts: async () => [],
        failures: async (filters) => {
            seenFilters.push(filters);
        // remembering what the handler has asked for
        return { items: [failureRow], total: 1};

    },
};

return createHandlers(() => repository);

}

// TEST DATA end --------------------------------------------------------------

// TESTING --------------------------------------------------------------------

for (const [label, path] of [

    ["missing map", "/api/failures"],
    ["invalid UUID", "/api/failures?map_version_id=bad"],
    ["unknown failure type", "/api/failures?map_version_id=" + map + "&failure_type=success"],
    ["bad date", "/api/failures?map_version_id=" + map + "&date=2026-11-31"],
    ["unknown parameter", "/api/failures?map_version_id=" + map + "&typo=1"],

]) {

    test("failures rejects " + label + " before opening a database connection", async () => {

        const handlers = createHandlers(() => { throw new Error("must not open"); });
        assert.equal((await handlers.failures(get(path))).status, 400);

    });

}

test("failures returns 404 for a map that is not visible", async () => {

    const response = await api().failures(get("/api/failures?map_version_id=20000000-0000-4000-8000-000000000099"));
    assert.equal(response.status, 404);

});

test("failures passes every filter to the database and returns the page", async () => {

    const seenFilters: FailureFilters[] = [];

    const path = "/api/failures?map_version_id=" + map + "&failure_type=timeout&test_point_id=" + testPointId +
    "&device_id=iphone-daksh&date=2026-11-10&limit=10&offset=20";

    const response = await api(seenFilters).failures(get(path));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(seenFilters[0], {

        map_version_id: map, failure_type: "timeout", test_point_id: testPointId,
        device_id: "iphone-daksh", date: "2026-11-10", limit: 10, offset: 20,

    });

    const body = await response.json();
    assert.equal(body.total, 1);
    assert.equal(body.items[0].failure_type, "timeout");
    assert.equal(body.items[0].tracking_status_before, "lost");

});

// TESTING end ----------------------------------------------------------------



