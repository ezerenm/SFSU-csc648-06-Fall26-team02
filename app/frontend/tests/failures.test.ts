// R12.4 failure helper tests

import assert from "node:assert/strict";
import { test } from "node:test";
import { dayRange, isFailureType, trackingStatusBefore, type StatusSample } from "../lib/spatial/failures";

test("only the 6 failure types count as failures", () => {

    assert.equal(isFailureType("timeout"), true);
    assert.equal(isFailureType("other_failure"), true);
    assert.equal(isFailureType("success"), false);
    assert.equal(isFailureType("in_progress"), false);
    assert.equal(isFailureType("TIMEOUT"), false);

});

test("a date becomes one full day in PST", () => {

    assert.deepEqual(dayRange("2026-11-10"), { startIso: "2026-11-10T08:00:00.000Z", endIso: "2026-11-11T08:00:00.000Z" });

});

test("bad dates are not accepted", () => {

    assert.equal(dayRange("2026-11-31"), null);
    assert.equal(dayRange("2026-1-10"), null);
    assert.equal(dayRange("11/10/2026"), null);
    assert.equal(dayRange("tomorrow"), null);

});

test("tracking status before is the newest sample from the same phone in the last minute", () => {

    const samples: StatusSample[] = [

        { device_id: "iphone-daksh", tracking_status: "valid", captured_at: "2026-11-10T20:00:00Z" },
        { device_id: "iphone-daksh", tracking_status: "lost", captured_at: "2026-11-10T20:00:20Z" },
        { device_id: "iphone-sumit", tracking_status: "localizing", captured_at: "2026-11-10T20:00:25Z" },
        { device_id: "iphone-daksh", tracking_status: "valid", captured_at: "2026-11-10T20:00:40Z" },

    ];

    assert.equal(trackingStatusBefore(samples, "iphone-daksh", "2026-11-10T20:00:30Z"), "lost");
    // 20:00:20 lost is the newest Daksh sample before 20:00:30 and 20:00:40 is after
    assert.equal(trackingStatusBefore(samples, "iphone-sumit", "2026-11-10T20:00:30Z"), "localizing");
    assert.equal(trackingStatusBefore(samples, "iphone-daksh", "2026-11-10T20:05:00Z"), null);
    assert.equal(trackingStatusBefore([], "iphone-daksh", "2026-11-10T20:00:30Z"), null);


});