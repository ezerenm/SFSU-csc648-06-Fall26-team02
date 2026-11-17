// drawPhone tests

import assert from "node:assert/strict";

import { test } from "node:test";

import { DOT_LIFT, buildPhoneDots, headingDirection } from "../components/viewer/drawPhones";

import type { PhoneDot } from "../lib/spatial/phoneDots";

function makeDot(deviceId: string, headingDegrees: number | null): PhoneDot {
    // a fake dot

    return { deviceId: deviceId, xMeters: 2, zMeters: -3, headingDegrees: headingDegrees, color: "deepskyblue", opacity: 1 };

}

test ("each dot is a ball on the floor SpotLightHelper, plus a facing line where heading is known", () => {

    const group = buildPhoneDots([makeDot("iphone-sumit", 90), makeDot("iphone-daksh", null)], -1.5);

    assert.equal(group.children.length, 3);
    // sumits phone has a ball and line
    // dakshs phone is just the ball

    const ball = group.children[0];

    assert.equal(ball.position.x, 2);
    assert.equal(ball.position.y, -1.5 + DOT_LIFT);
    assert.equal(ball.position.z, -3);

});

test("heading 0 faces -z and heading 90 faces +x", () => {

    const facing0 = headingDirection(0);

    const facing90 = headingDirection(90);

    assert.ok(Math.abs(facing0.x) < 0.0001);
    assert.ok(Math.abs(facing0.z - -1) < 0.0001);
    assert.ok(Math.abs(facing90.x - 1) < 0.0001);
    assert.ok(Math.abs(facing90.z) < 0.0001);

});