// TRACKING STATUS TEST FILE

import assert from "node:assert/strict";

import { test } from "node:test";

import { canStartFromLivePosition, getChipLook, getTrackingColor, getTrackingLabel  } from "../lib/spatial/trackingStatus";

const currentMs = Date.parse("2026-10-28T12:00:10Z");

const messageSecondsAgo = (secondsAgo: number, trackingStatus: string) => ({

    tracking_status: trackingStatus, received_at: new Date(currentMs - secondsAgo * 1000).toISOString(),

});

test("new messages -> valid = green, localizing = yellow, and lost = red", () => {

    assert.equal(getTrackingColor(messageSecondsAgo(1, "valid"), currentMs), "green");

    assert.equal(getTrackingColor(messageSecondsAgo(1, "localizing"), currentMs), "yellow");

    assert.equal(getTrackingColor(messageSecondsAgo(1, "lost"), currentMs), "red");

})

test("no message, previous message, or unknown status = gray", () => {

    assert.equal(getTrackingColor(null, currentMs), "gray");

    assert.equal(getTrackingColor(messageSecondsAgo(5, "valid"), currentMs), "gray");

    assert.equal(getTrackingColor(messageSecondsAgo(4.9, "valid"), currentMs), "green");

    assert.equal(getTrackingColor(messageSecondsAgo(1, "something_new"), currentMs), "gray");

    assert.equal(getTrackingColor({ tracking_status: "valid", received_at: "not a real date" }, currentMs), "gray");

})

test("R6.4 labels + live start", () => {

    assert.equal(getTrackingLabel("green"), "Live");

    assert.equal(getTrackingLabel("gray"), "No data");

    assert.equal(canStartFromLivePosition("green"), true);

    assert.equal(canStartFromLivePosition("yellow"), false);

    assert.equal(canStartFromLivePosition("red"), false);

    assert.equal(canStartFromLivePosition("gray"), false);

})

test("R3.4 localizing for 30 seconds or more means red Time Out", () => {

    const freshLocalizing = { tracking_status: "localizing", received_at: new Date(currentMs - 1000).toISOString() };

    const since31 = new Date(currentMs - 31000).toISOString();

    const since10 = new Date(currentMs - 10000).toISOString();

    assert.deepEqual(getChipLook(freshLocalizing, since31, currentMs), { trackingColor: "red", label: "Timed out, try again" });

    assert.deepEqual(getChipLook(freshLocalizing, since10, currentMs), { trackingColor: "yellow", label: "Finding position..." });

})
