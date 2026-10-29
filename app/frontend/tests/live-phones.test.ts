// live phone test file

import assert from "node:assert/strict";
// assert checks if our answers are correct

import { test } from "node:test";
// making each test

import { getDeviceType, KNOWN_DEVICES } from "../lib/spatial/deviceTypes";
// the hardcoded visitor and robot list

import { addPhoneMessage, listPhones, pickNavigationPhone, type PhoneMessage, type PhonesByDevice } from "../lib/spatial/livePhones";
// the functions to test

// Test Messages --------------------------------------------------------------

const makeMessage = (deviceId: string, secondsAfterNoon: number, trackingStatus: string, hasPosition: boolean): PhoneMessage => ({ 

    sample_id: deviceId + "-" + secondsAfterNoon, device_id: deviceId, world_position: hasPosition ? { x_m: secondsAfterNoon,
        y_m: 0, z_m: 0 } : null, heading_deg: null, tracking_status: trackingStatus, captured_at: new Date(Date.parse("2026-10-29T12:00:00Z") + secondsAfterNoon * 1000).toISOString(),
        data_origin: "synthetic",

});
// creates a fake message from a phone and secondsAfterNoon measurs how new the message is

// Test Messages end ----------------------------------------------------------

// Test -----------------------------------------------------------------------

test("status only messages update the status chip but we keep the last position for the dot", () => {

    let phones: PhonesByDevice = {};
    // no phones yet

    phones = addPhoneMessage(phones, makeMessage("phone1", 1, "valid", true));
    // phone1 sends valid position

    phones = addPhoneMessage(phones, makeMessage("phone1", 2, "lost", false));
    // then phone1 says its lost

    assert.equal(phones["phone1"].latestMessage.tracking_status, "lost");
    // the chip that should have a lost status

    assert.equal(phones["phone1"].latestPosition?.world_position?.x_m, 1);
    // the dot stays at the latest real position

})

test("an older message arrives late doesn't replace a newer message", () => {

    let phones: PhonesByDevice = {};
    // no phones yet

    phones = addPhoneMessage(phones, makeMessage("phone1", 5, "valid", true));
    // new message arrives first

    phones = addPhoneMessage(phones, makeMessage("phone1", 3, "localizing", true));
    // older message arrives lat

    assert.equal(phones["phone1"].latestMessage.tracking_status, "valid");
    // still showing newer message

    assert.equal(phones["phone1"].latestPosition?.world_position?.x_m, 5);
    // still using the newer position

    const samePhones = addPhoneMessage(phones, makeMessage("phone1", 5, "valid", true));
    // the same message again

    assert.equal(samePhones, phones);
    // no changes, so go back to the same object
    
})

test("pickNavigationPhone prefers the visitor phone, otherwise it picks the newest phone", () => {

    const visitorId = KNOWN_DEVICES[0].deviceId;
    // visitor phone id
    // from hardcoded list

    assert.equal(getDeviceType(visitorId), "visitor");
    // check if the list wokrs

    assert.equal(getDeviceType("some-random-phone"), "unknown");
    // the phone is not in the list
    // or the phone is unknown

    let phones: PhonesByDevice = {};
    // no phones yet

    phones = addPhoneMessage(phones, makeMessage("phone-a", 1, "valid", true));
    // unknown phone

    phones = addPhoneMessage(phones, makeMessage("phone-b", 2, "valid", true));
    // unknown phone but its newer

    assert.equal(pickNavigationPhone(phones)?.deviceId, "phone-b");
    // no visitor, so newest phone will win

    phones = addPhoneMessage(phones, makeMessage(visitorId, 0, "valid", true));
    // the visitor phone appears but with the oldest message

    assert.equal(pickNavigationPhone(phones)?.deviceId, visitorId);
    // the visitor wins even if its older

    assert.equal(listPhones(phones).length, 3);
    // all three phones are in the list

})

// Test end -------------------------------------------------------------------