// R8.3 and R17.1 segment color tests

import assert from "node:assert/strict";
// strict compare, red only equal to red

import { test } from "node:test";

import { CLOSED_SEGMENT_COLOR, HUMANS_ONLY_SEGMENT_COLOR, OPEN_SEGMENT_COLOR, segmentColor } from "../lib/spatial/segmentStyle";
// testing

test("an open segment for everyone is green", () => {

    assert.equal(segmentColor({ availability: "open", robot_access: "allowed"}), OPEN_SEGMENT_COLOR);
    // open and robots allowed is lime

});

test("an open segment restricted for robots is pink (humans only)", () => {

    assert.equal(segmentColor({ availability: "open", robot_access: "restricted" }), HUMANS_ONLY_SEGMENT_COLOR);
    // open and robot restricted is pink

});

test("a closed segment is red, even if its also robot restricted", () => {

    assert.equal(segmentColor({ availability: "closed", robot_access: "allowed" }), CLOSED_SEGMENT_COLOR);
    // closed = red

    assert.equal(segmentColor({ availability: "closed", robot_access: "restricted" }), CLOSED_SEGMENT_COLOR);
    // closed and restricted still red closed will win

});