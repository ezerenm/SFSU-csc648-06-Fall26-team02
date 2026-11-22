// R12.4 tests for the review fixes

import assert from "node:assert/strict";

import { test } from "node:test";

import { createClient } from "@supabase/supabase-js";

import { FAILURE_TYPES, dayRange, pacificOffset } from "../lib/spatial/failures";

import { supabaseRepository } from "../lib/spatial/server/repository";

const MAP = "b2000000-0000-4000-8000-000000000001";

function fakeClient(fetcher: typeof fetch) {
    
    return createClient("https://example.supabase.co", "test-only-publishable-key", {
        auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetcher },

    });

}

test("failure types are every outcome except success and in_progress", () => {

    assert.deepEqual(FAILURE_TYPES, ["timeout", "tracking_loss", "network_error", "map_mismatch", "cancelled", "other_failure"]);

});

test("an October date uses daylight time and a November date uses standard time", () => {

    assert.equal(pacificOffset("2026-10-10"), "-07:00");
    assert.equal(pacificOffset("2026-11-10"), "-08:00");
    assert.deepEqual(dayRange("2026-10-10"), { startIso: "2026-10-10T07:00:00.000Z", endIso: "2026-10-11T07:00:00.000Z" });
    assert.deepEqual(dayRange("2026-11-10"), { startIso: "2026-11-10T08:00:00.000Z", endIso: "2026-11-11T08:00:00.000Z" });

});

test("the day clocks fall back is 25 hours long", () => {
    assert.deepEqual(dayRange("2026-11-01"), { startIso: "2026-11-01T07:00:00.000Z", endIso: "2026-11-02T08:00:00.000Z" });

});

test("days that don't exist are rejected", () => {

    assert.equal(dayRange("2026-11-31"), null);
    assert.equal(dayRange("2026-02-29"), null);

});

test("a failures page past the end is empty but keeps the total", async () => {

    let calls = 0;

    const store = supabaseRepository(fakeClient(async () => {

        calls++;

        if (calls === 1) {

            return Response.json({ code: "PGRST103", message: "requested range not satisfiable" }, { status: 416 });
            // first ask: the page doesn't exist

        }

        return Response.json([], { headers: { "Content-Range": "0-0/4" }});
        // second ask, the total is 4

    }));

    assert.deepEqual(await store.failures({ map_version_id: MAP, limit: 50, offset: 100 }), { items: [], total: 4 });

    assert.equal(calls, 2);

});

test("the status before a failure comes from one small, newest first pose query per failure", async () => {

    const store = supabaseRepository(fakeClient(async (input) => {

        const url = new URL(String(input));

        if (url.pathname.endsWith("/localization_attempts")) {

            return Response.json([{

                attempt_id: "70000000-0000-4000-8000-000000000001", outcome: "timeout", failure_reason: "No pose",

                test_point_id: "40000000-0000-4000-8000-000000000001", device_id: "iphone-daksh",

                started_at: "2026-11-10T20:00:00Z", ended_at: null, mode: "live", data_origin: "live_sdk",

                test_point: { label: "TP1" },

            }], { headers: { "Content-Range": "0-0/1" } });
            // one failure on the page

        }

        assert.equal(url.searchParams.get("device_id"), "eq.iphone-daksh");
        assert.equal(url.searchParams.get("order"), "captured_at.desc");
        assert.equal(url.searchParams.get("limit"), "1");
        // the pose read is small
        // one phone, newest first, and only one row

        return Response.json([{ device_id: "iphone-daksh", tracking_status: "lost", captured_at: "2026-11-10T19:59:58Z" }]);

    }));

    const page = await store.failures({ map_version_id: MAP, limit: 50, offset: 0 });
    assert.equal(page.items[0].tracking_status_before, "lost");

});

