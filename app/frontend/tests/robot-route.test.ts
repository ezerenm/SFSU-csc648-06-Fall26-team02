// robot route test file (R9.2, R10)

import assert from "node:assert/strict";

import { test } from "node:test";

import type { GraphNode, PathSegment } from "../lib/spatial/contracts";

import { addPhoneMessage, type PhoneMessage, type PhonesByDevice } from "../lib/spatial/livePhones";

import { pickRobotPhone, planRobotStart, robotPosition } from "../lib/spatial/robotRoute";

// Test map -------------------------------------------------------------------
// A (0,0) to B (4,0) to C (4,4), and A to C straight across

const makeNode = (nodeId: string, x: number, z: number): GraphNode => ({
    node_id: nodeId, map_version_id: "m", graph_revision: 1, label: nodeId, position: { x_m: x, y_m: 0, z_m: z },
});

const nodeA = makeNode("A", 0, 0);
const nodeB = makeNode("B", 4, 0);
const nodeC = makeNode("C", 4, 4);
const nodes = [nodeA, nodeB, nodeC];

const makeSegment = (segmentId: string, from: GraphNode, to: GraphNode, robotAccess: "allowed" | "restricted" = "allowed", availability: "open" | "closed" = "open"): PathSegment => ({
    segment_id: segmentId, map_version_id: "m", graph_revision: 1, label: segmentId, start_node_id: from.node_id, end_node_id: to.node_id,
    direction: "bidirectional", distance_m: 4, availability, robot_access: robotAccess, last_state_revision: 1, geometry: [from.position, to.position],
});

// Test messages --------------------------------------------------------------

const makeMessage = (deviceId: string, seconds: number, x: number | null, z = 0): PhoneMessage => ({
    sample_id: deviceId + "-" + seconds,
    device_id: deviceId,
    world_position: x === null ? null : { x_m: x, y_m: 0, z_m: z },
    heading_deg: null,
    tracking_status: x === null ? "lost" : "valid",
    captured_at: new Date(Date.parse("2026-11-02T12:00:00Z") + seconds * 1000).toISOString(),
    received_at: new Date(Date.parse("2026-11-02T12:00:00Z") + seconds * 1000).toISOString(),
    data_origin: "live_sdk",
});

const phonesWith = (...messages: PhoneMessage[]): PhonesByDevice =>
    messages.reduce((phones, message) => addPhoneMessage(phones, message), {} as PhonesByDevice);

// Testing --------------------------------------------------------------------

test("pickRobotPhone returns the robot phone and ignores visitors and unknown phones", () => {

    const phones = phonesWith(makeMessage("iphone-sumit", 5, 1), makeMessage("iphone-daksh", 1, 2), makeMessage("someone-else", 9, 3));

    assert.equal(pickRobotPhone(phones)?.deviceId, "iphone-daksh");

    assert.equal(pickRobotPhone(phonesWith(makeMessage("iphone-sumit", 5, 1))), null);

});

test("robotPosition keeps the last real spot when the newest message has no position", () => {

    const phones = phonesWith(makeMessage("iphone-daksh", 1, 2), makeMessage("iphone-daksh", 2, null));

    assert.deepEqual(robotPosition(pickRobotPhone(phones)), { x_m: 2, z_m: 0 });

    assert.equal(robotPosition(null), null);

});

test("planRobotStart snaps onto a robot path and picks the nearer end", () => {

    const robot = pickRobotPhone(phonesWith(makeMessage("iphone-daksh", 1, 3, 0.5)));

    const start = planRobotStart(robot, "green", nodes, [makeSegment("AB", nodeA, nodeB)], null);

    assert.equal(start.startNodeId, "B");

    assert.equal(start.problem, null);

});

test("planRobotStart skips paths restricted for robots and closed paths", () => {

    const robot = pickRobotPhone(phonesWith(makeMessage("iphone-daksh", 1, 1, 0.2)));
    // standing right on AB

    const segments = [makeSegment("AB", nodeA, nodeB, "restricted"), makeSegment("BC", nodeB, nodeC), makeSegment("AC", nodeA, nodeC, "allowed", "closed")];

    const start = planRobotStart(robot, "green", nodes, segments, null);

    assert.equal(start.startNodeId, null);
    // BC is the only robot path, and it is about 3 m away

    assert.match(start.problem ?? "", /from the nearest robot path/);

    const noRobotPath = planRobotStart(robot, "green", nodes, [makeSegment("AB", nodeA, nodeB, "restricted")], null);

    assert.match(noRobotPath.problem ?? "", /No open path allows the robot/);

});

test("planRobotStart keeps the previous start when the chip is not green", () => {

    const robot = pickRobotPhone(phonesWith(makeMessage("iphone-daksh", 1, 3)));

    const segments = [makeSegment("AB", nodeA, nodeB)];

    assert.deepEqual(planRobotStart(robot, "yellow", nodes, segments, "A"), { startNodeId: "A", attachment: null, problem: null });

    assert.match(planRobotStart(robot, "red", nodes, segments, null).problem ?? "", /accurate position/);

    assert.match(planRobotStart(null, "green", nodes, segments, null).problem ?? "", /No simulated robot phone/);

});
