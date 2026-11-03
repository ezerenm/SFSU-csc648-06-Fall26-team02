// R9.2 and R10: where the simulated robot starts its route on /live
// the robot proxy phone (device type "robot") walks robot-allowed paths only

import type { GraphNode, PathSegment } from "./contracts";
// node and segment shapes

import { getDeviceType } from "./deviceTypes";
// tells us which phone is the robot

import { isNewerMessage, listPhones, type PhonesByDevice, type PhoneState } from "./livePhones";
// every phone and their newest message

import { pickStartNode, type Xz } from "./liveRoute";
// nearest end node with the 0.75 m anti-flicker margin

import { findNearestSegment, MAX_START_DISTANCE_M, type SegmentAttachment } from "./segmentAttach";
// snapping onto the nearest path

import { canStartFromLivePosition, type TrackingColor } from "./trackingStatus";
// only a green chip can pick a new start

// Picking the robot phone ----------------------------------------------------

export function pickRobotPhone(phones: PhonesByDevice): PhoneState | null {
    // the newest robot proxy phone on this map
    // null when no robot phone has sent anything

    let newestRobot: PhoneState | null = null;

    for (const phone of listPhones(phones)) {

        if (getDeviceType(phone.deviceId) !== "robot") {

            continue;
            // visitors and unknown phones are not the robot

        }

        if (newestRobot === null || isNewerMessage(phone.latestMessage, newestRobot.latestMessage)) {

            newestRobot = phone;

        }
    }

    return newestRobot;
}

// Picking the robot phone end ------------------------------------------------

// Robot start ----------------------------------------------------------------

export type RobotStart = {
    startNodeId: string | null;
    // the node the robot route starts from

    attachment: SegmentAttachment | null;
    // where the robot snaps onto a robot-allowed path

    problem: string | null;
    // why there is no start, shown under the robot route

};

export function robotPosition(phone: PhoneState | null): Xz | null {
    // the robot's last real spot on the floor (x and z only)

    if (phone === null || phone.latestPosition === null || phone.latestPosition.world_position === null) {

        return null;

    }

    return { x_m: phone.latestPosition.world_position.x_m, z_m: phone.latestPosition.world_position.z_m };
}

export function planRobotStart(
    phone: PhoneState | null,
    trackingColor: TrackingColor,
    nodes: readonly GraphNode[],
    segments: readonly PathSegment[],
    currentStartId: string | null,
): RobotStart {
    // same rules as the visitor start (R6.2.2, R6.3, R6.4), but only robot-allowed paths count

    if (phone === null) {

        return { startNodeId: null, attachment: null, problem: "No simulated robot phone on this map yet." };

    }

    const position = robotPosition(phone);

    if (!canStartFromLivePosition(trackingColor) || position === null) {
        // R6.4: no green chip, so keep the old start and the route stays on screen

        if (currentStartId !== null) {

            return { startNodeId: currentStartId, attachment: null, problem: null };

        }

        const problem = position === null
            ? "Waiting for the robot's position."
            : "The robot needs an accurate position (green) to start a route.";

        return { startNodeId: null, attachment: null, problem };
    }

    const attachment = findNearestSegment(segments, position, "robot");
    // skips closed paths and paths restricted for robots

    if (attachment === null) {

        return { startNodeId: null, attachment: null, problem: "No open path allows the robot on this map." };

    }

    if (attachment.distanceToSegmentM > MAX_START_DISTANCE_M) {

        return {
            startNodeId: null,
            attachment,
            problem: "The robot is " + attachment.distanceToSegmentM.toFixed(1) + " m from the nearest robot path. Move the robot phone closer.",
        };
    }

    const segment = attachment.segment;

    const segmentEnds = nodes.filter((node) => node.node_id === segment.start_node_id || node.node_id === segment.end_node_id);
    // the two nodes at the ends of that path

    const startNode = pickStartNode(segmentEnds, attachment.attachPoint, currentStartId);

    return { startNodeId: startNode === null ? null : startNode.node_id, attachment, problem: null };
}

// Robot start end ------------------------------------------------------------
