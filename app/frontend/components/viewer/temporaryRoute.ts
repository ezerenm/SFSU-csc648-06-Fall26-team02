// THIS IS TEMPORARY FOR ROUTE API
// SAME FIELD NAMES AS API SO SWAPPING OUT LATER IS EASY

import type {PathSegment} from './temporaryGraph';

export type RouteStep = { segment_id: string; from_node_id: string; to_node_id: string };
// one stop, which segment walked in which direction

export type RouteResult = {
    // route API returns this
    steps: RouteStep[];

    total_distance_m: number | null;

    status: 'valid' | 'unreachable';
    // is there a valid route between the two nodes

};

export function temporaryFindRoute(segments: PathSegment[], startNodeId: string, endNodeId: string, profile: 'human' | 'robot'): RouteResult {

    const usable = segments.filter((segment) => segment.availability === 'open' && (profile === 'human' || segment.robot_access === 'allowed'));
    // keeps the segments the one moving might use

    const bestDistance = new Map<string, number>();
    // the shortest distance found so far to each of the nodes

    const cameFrom = new Map<string, RouteStep>();
    // the step that led to each node, so we can reconstruct the path

    const done = new Set<string>();
    // the nodes that have been fully explored

    bestDistance.set(startNodeId, 0);
    // the start is 0 meters away from itself

    while (true) {
        // keep going until we run out of nodes or we find the end

        let current: string | null = null;
        // closest unexplored node

        for (const [nodeId, distance] of bestDistance) {

            if (!done.has(nodeId) && (current === null || distance < (bestDistance.get(current) ?? Infinity))) {

                current = nodeId;
            }
        }

        if (current === null || current === endNodeId) break;

        done.add(current);

        for (const segment of usable) {
            // check if this segment connects to the current node

            const forward = segment.start_node_id === current;
            // walking start to end

            const backward = segment.end_node_id === current && segment.direction === 'bidirectional';
            // walking end to start if its only two way

            if (!forward && !backward) continue;

            const nextNodeId = forward ? segment.end_node_id : segment.start_node_id;

            const newDistance = (bestDistance.get(current) ?? 0) + segment.distance_m;

            if (newDistance < (bestDistance.get(nextNodeId) ?? Infinity)) {

                bestDistance.set(nextNodeId, newDistance);

                cameFrom.set(nextNodeId, { segment_id: segment.segment_id, from_node_id: current, to_node_id: nextNodeId });
            }
        }
    }

    if (!bestDistance.has(endNodeId)) {
        // it never reached the end

        return { steps: [], total_distance_m: null, status: 'unreachable' };
        // there was no route
    }

    const steps: RouteStep[] = [];

    let currentNodeId = endNodeId;

    while (currentNodeId !== startNodeId) {

        const step = cameFrom.get(currentNodeId)!;

        steps.unshift(step);

        currentNodeId = step.from_node_id;

    }

    return { steps, total_distance_m: bestDistance.get(endNodeId) ?? null, status: 'valid' };

}