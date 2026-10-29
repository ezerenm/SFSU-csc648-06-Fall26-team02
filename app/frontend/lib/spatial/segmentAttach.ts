

import type { GraphNode, PathSegment } from "./contracts";
import { distance, type Xz } from "./liveRoute";
// getting the node and segment shapes from contracts
// distance() is meters between two points

// The Data -------------------------------------------------------------------

// R6 
export const MAX_START_DISTANCE_M = 2.0


export type SegmentAttachment = {

    segment: PathSegment;

    attachPoint: Xz;

    distanceToSegmentM: number;

};

// The Data end ---------------------------------------------------------------

// The closest point on a line

export function closestPointOnLine(position: Xz, pointA: Xz, pointB: Xz): Xz {
    // finds a spot on the line thats closest to the phone from pointA and pointB
    // using only the floor (x and z)

    const lineX = pointB.x_m - pointA.x_m;
    // how far the line goes x

    const lineZ = pointB.z_m - pointA.z_m;
    // how far the line goes z

    const lineLengthSquared = lineX * lineX + lineZ * lineZ;
    // the lines length squared

    if (lineLengthSquared === 0) {
        // if the points are in the same spot

        return { x_m: pointA.x_m, z_m: pointA.z_m };
        // make the closest point pointA

    }

    let fractionAlongTheLine = ((position.x_m - pointA.x_m) * lineX + (position.z_m - pointA.z_m) * lineZ) / lineLengthSquared;
    // how far along the line the phone is
    // 0 = pointA 
    // 0.5 = halfway to pointB
    // 1 = pointB

    if (fractionAlongTheLine < 0) {
        // the phone has gone past pointA's end line

        fractionAlongTheLine = 0;
        // stop at pointA

    }

    if (fractionAlongTheLine > 1) {
        // the phone has gone past pointB's end line

        fractionAlongTheLine = 1;
        // stop at pointB

    }

    return {
        // making the closest point

        x_m: pointA.x_m + fractionAlongTheLine * lineX,
        // starting at pointA and go to the fraction of the way in x

        z_m: pointA.z_m + fractionAlongTheLine * lineZ,
        // starting at pointA and go to the fraction of the way in z

    };

}

// Finding the nearest path ---------------------------------------------------

export function findNearestSegment(segments: readonly PathSegment[], position: Xz): SegmentAttachment | null {
    // R6.2.2 checks every open path and returns the one closest to the phone
    // readonly so we don't change the list
    // return null if there are no open paths

    let bestAttachment: SegmentAttachment | null = null;
    // the closest path so far

    for (const segment of segments) {
        // going through every segment

        if (segment.availability !== "open") {
            // close segments wouldn't count 
            // closed segments = wet floor, construction, power outage

            continue;
            // skip bad segment and move onto next segment
        }

        for (let pointIndex = 0; pointIndex < segment.geometry.length - 1; pointIndex++) {
            // because segments bend, we check for straight pieces between point i and indexed

            const pointA = segment.geometry[pointIndex];
            // start of this straight piece

            const pointB = segment.geometry[pointIndex + 1];
            // end of this straight piece

            const attachPoint = closestPointOnLine(position, pointA, pointB);
            // the closest spot on this piece to the phone

            const distanceToSegmentM = distance(position, attachPoint);
            // how far the phone is from that spot

            if (bestAttachment === null || distanceToSegmentM < bestAttachment.distanceToSegmentM) {
                // if this is the first one checked, or it is better/closer to our best so far

                bestAttachment = { segment, attachPoint, distanceToSegmentM };
                // save this as the new best so far
            }
        }
    }

    return bestAttachment;
    // the closest open segment
    // or null if there is no open segment at all
}

// Finding the nearest path end -----------------------------------------------

// Live start check -----------------------------------------------------------

export function checkLiveStart(attachment: SegmentAttachment | null): string | null {
    // r6.3 returning null if the start is okay / returning an error if there is something wrong

    if (attachment === null) {
        // no attachment

        return "There is no open path segment on this map!";
        // There is no open path segments / all segments are closed

    }

    if (attachment.distanceToSegmentM > MAX_START_DISTANCE_M) {
        // the phone is not in reach from the nearest path

        return `You are ${attachment.distanceToSegmentM.toFixed(1)} m from the nearest path. Please move closer to the path to begin a route.`;
        // message to user 

    }

    return null;

}

// Live start check end -------------------------------------------------------

// Choosing the start node ----------------------------------------------------

export function startNodeForAttachment(attachment: SegmentAttachment, nodes: readonly GraphNode[]): GraphNode | null {
    // api/rooute can only start from a node, so we pick the closest end of a segment

    const startNode = nodes.find((node) => node.node_id === attachment.segment.start_node_id) ?? null;
    // look through all the nodes in this segments start node
    // if we didn't find, use null

    const endNode = nodes.find((node) => node.node_id === attachment.segment.end_node_id) ?? null;
    // look through all the nodes in this segments end node
    // if we didn't find, use null

    if (startNode === null) {
        // if we couldn't find the start node

        return endNode;
        // use the end node
        // this can also be null

    }

    if (endNode === null) {
        // if we couldn't find the end node

        return startNode;
        // use the start node
    }

    const distanceToStartNode = distance(attachment.attachPoint, startNode.position);
    // how far the snapped spot is from the start node

    const distanceToEndNode = distance(attachment.attachPoint, endNode.position);
    // how far the snapped spot is from the end node

    if (distanceToStartNode <= distanceToEndNode) {
        // if the start node is closer
        // if it's a tie

        return startNode;
        // start there

    } else {
        // if end node is closer

        return endNode;
        // start here instead
    }


}
// Choosing the start node end ------------------------------------------------




