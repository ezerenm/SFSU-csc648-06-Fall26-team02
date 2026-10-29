// SEGMENT ATTACH TESTING FILE

import assert from "node:assert/strict";
// assert checks if our answers are correct

import { test } from "node:test";
// making each test

import type { GraphNode, PathSegment } from "../lib/spatial/contracts";
// the real node and segment shapes

import { checkLiveStart, closestPointOnLine, findNearestSegment, startNodeForAttachment } from "../lib/spatial/segmentAttach";
// 4 functions to test

// Testing Map ----------------------------------------------------------------

const makeNode = (nodeId: string, x: number, z: number): GraphNode => ({ node_id: nodeId, map_version_id: "m", graph_revision: 1,
     label: nodeId, position: { x_m: x, y_m: 0, z_m: z },

});
// makes fake node at x and z
// y is always 0 since we don't care about height

const nodeA = makeNode("A", 0, 0);
// node A in the corner

const nodeB = makeNode("B", 4, 0);
// nodeB 4 meters to the right of nodeA

const nodeC = makeNode("C", 4, 4);
// nodeC is 4 meters up from nodeB

const makeSegment = (segmentId: string, fromNode: GraphNode, toNode: GraphNode, availability: "open" | "closed" = "open"): PathSegment => ({
    segment_id: segmentId, map_version_id: "m", graph_revision: 1, label: segmentId, start_node_id: fromNode.node_id, end_node_id: toNode.node_id,
    direction: "bidirectional", distance_m: 4, availability, robot_access: "allowed", last_state_revision: 1, geometry: [fromNode.position, toNode.position],

});
// makes fake path between two nodes
// open will stay open until we close it

// Testing Map end ------------------------------------------------------------

// Testing --------------------------------------------------------------------

test("closestPointOnLine puts phone onto the line and stops at the ends", () => {

    assert.deepEqual(closestPointOnLine({ x_m: 1, z_m: 2 }, nodeA.position, nodeB.position), { x_m: 1, z_m: 0 });
    // phone is 2 meters above the line

    assert.deepEqual(closestPointOnLine({ x_m: -3, z_m: 1 }, nodeA.position, nodeB.position), { x_m: 0, z_m: 0 });

    assert.deepEqual(closestPointOnLine({ x_m: 9, z_m: 1 }, nodeA.position, nodeB.position), { x_m: 4, z_m: 0 });

})

test("findNearestSegment picks the closest open segment, skipping over the closed ones", () => {

    const segmentAB = makeSegment("AB", nodeA, nodeB);

    const segmentBC = makeSegment("BC", nodeB, nodeC);

    const nearest = findNearestSegment([segmentAB, segmentBC], { x_m: 3.5, z_m: 2 });

    assert.equal(nearest?.segment.segment_id, "BC");
    // bc should win

    assert.equal(nearest?.distanceToSegmentM, 0.5);

    const closedBC = makeSegment("BC", nodeB, nodeC, "closed");

    assert.equal(findNearestSegment([segmentAB, closedBC], { x_m: 3.5, z_m: 2 })?.segment.segment_id, "AB");
    // ab wins even if its farther 
    // closed bc is skipped

    assert.equal(findNearestSegment([], { x_m: 0, z_m: 0 }), null);

})

test("checkLiveStart blocks far start and startNodeForAttachment picks closer end", () => {

    const segmentAB = makeSegment("AB", nodeA, nodeB);

    const nearAttachment = findNearestSegment([segmentAB], { x_m: 1, z_m: 0.5 });

    assert.equal(checkLiveStart(nearAttachment), null);

    assert.equal(startNodeForAttachment(nearAttachment!, [nodeA, nodeB])?.node_id, "A");
    // spot snapped to is (1, 0) which is closer to A

    const farAttachment = findNearestSegment([segmentAB], { x_m: 1, z_m: 5});

    const farMessage = checkLiveStart(farAttachment);

    assert.equal(farMessage !== null && farMessage.includes("5.0 m from the nearest path"), true);

    const noPathMessage = checkLiveStart(null);

    assert.equal(noPathMessage !== null && noPathMessage.includes("no open path segment"), true);

})

// Testing end ----------------------------------------------------------------

