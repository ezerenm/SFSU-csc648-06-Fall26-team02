// R12.3 Capture status tests

// IMPORTS --------------------------------------------------------------------

import assert from "node:assert/strict";

import { test } from "node:test";

import { addPhoneMessage, type PhoneMessage, type PhonesByDevice } from "../lib/spatial/livePhones";

import { addSampleIfNew, EMPTY_COUNTS, getCaptureStatus } from "../lib/spatial/captureStatus";


// IMPORTS end ----------------------------------------------------------------

// TEST DATA ------------------------------------------------------------------

const robotMessage: PhoneMessage = {

    sample_id: "robot-1",
    device_id: "iphone-daksh",
    world_position: { x_m: 1, y_m: 0, z_m: 1 },
    heading_deg: null,
    tracking_status: "valid",
    captured_at: "2026-11-10T12:00:00Z",
    received_at: "2026-11-10T12:00:00Z",
    data_origin: "live_sdk"

};

const robotPhone = addPhoneMessage({} as PhonesByDevice, robotMessage)["iphone-daksh"];
// the robot phone after a message

// TEST DATA end --------------------------------------------------------------

// TESTING --------------------------------------------------------------------

test("Run isn't active, so it isn't capturing", () => {

    assert.deepEqual(getCaptureStatus(false, robotPhone, "green"), { isCapturing: false, label: "Run isn't active" });

});

test("Run is active, but there is no robot phone waiting", () => {

    assert.deepEqual(getCaptureStatus(true, null, "gray").label, "Waiting for the robot phone");

});

test("gray means not receiving data, any other color is capturing", () => {

    assert.equal(getCaptureStatus(true, robotPhone, "gray").isCapturing, false);

    assert.equal(getCaptureStatus(true, robotPhone, "green").isCapturing, true);

    assert.equal(getCaptureStatus(true, robotPhone, "red").isCapturing, true);

});

test("a sample is only counted once", () => {
    
const countedOnce = addSampleIfNew(EMPTY_COUNTS, "robot-1", null);
// first time seeing robot 1, so then the sample adds one

assert.equal(countedOnce.samples, 1);

const countedAgain = addSampleIfNew(countedOnce, "robot-1", "robot-1");
// the same message is here again, so the sample count shouldn't change

assert.equal(countedAgain.samples, 1);

});


// TESTING end ----------------------------------------------------------------




