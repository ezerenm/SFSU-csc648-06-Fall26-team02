// Phone dots test

import assert from "node:assert/strict";

import { test } from "node:test";

import type { PhoneMessage, PhonesByDevice } from "../lib/spatial/livePhones";

import { FADED_DOT_OPACITY, ROBOT_DOT_COLOR, VISITOR_DOT_COLOR, phoneDotsFor } from "../lib/spatial/phoneDots";

const NOW_MS = Date.parse("2026-11-17T10:00:10Z");
// now for all tests

function makeMessage(status: string, hasPosition: boolean): PhoneMessage {
    // fake pose_samples row, received a second before NOW_MS

    let position = null;

    if (hasPosition) {

        position = { x_m: 2, y_m: 0.5, z_m: -3 };

    }

    return {

        sample_id: "sample-" + status, device_id: "test-phone",
        world_position: position, heading_deg: 90,
        tracking_status: status, captured_at: "2026-11-17T10:00:09Z",
        received_at: "2026-11-17T10:00:09Z", data_origin: "real",

    };

}

function onePhone(deviceId: string, latest: PhoneMessage, lastWithPosition: PhoneMessage | null): PhonesByDevice {
    // phone lookup with only one phone

    return {
        
        [deviceId]: { deviceId: deviceId, latestMessage: latest, latestPosition: lastWithPosition, localizingSince: null },

    };

}

test("a tracking visitor phone is a blue dot", () => {

    const valid = makeMessage("valid", true);

    const dots = phoneDotsFor(onePhone("iphone-sumit", valid, valid), NOW_MS);

    assert.equal(dots.length, 1);

    assert.equal(dots[0].color, VISITOR_DOT_COLOR);

    assert.equal(dots[0].opacity, 1);

    assert.equal(dots[0].xMeters, 2);

    assert.equal(dots[0].zMeters, -3);
    // y ignored because the dot is on the floor

});

test("the robot is orange", () => {

    const valid = makeMessage("valid", true);

    const dots = phoneDotsFor(onePhone("iphone-daksh", valid, valid), NOW_MS);

    assert.equal(dots[0].color, ROBOT_DOT_COLOR);

});

test("lost phone keeps a transparent marker last time it was spotted", () => {

    const lastGood = makeMessage("valid", true);
    const lost = makeMessage("lost", false);
    const dots = phoneDotsFor(onePhone("iphone-sumit", lost, lastGood), NOW_MS);

    assert.equal(dots.length, 1);
    assert.equal(dots[0].opacity, FADED_DOT_OPACITY);
    assert.equal(dots[0].xMeters, 2);

});

test("a phone that never had a position does not get a dot", () => {

    const localizing = makeMessage("localizing", false);

    const dots = phoneDotsFor(onePhone("iphone-sumit", localizing, null), NOW_MS);

    assert.equal(dots.length, 0);

});
