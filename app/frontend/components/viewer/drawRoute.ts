import * as THREE from 'three';
// three js library

import type { PathSegment } from './temporaryGraph';
// segment type from temporary graph

import type { RouteStep } from './temporaryRoute';
// step type from temporary route

import { toVector } from './drawGraph';
// function to turn a position into a Three.js point

export function buildRoute(steps: RouteStep[], segments: PathSegment[], color: string): THREE.Mesh | null {
    // turning the route steps into a big line like a tube

    const segmentById = new Map(segments.map((segment) => [segment.segment_id, segment]));
    // quick lookup

    const points: THREE.Vector3[] = [];
    // every point in the route in order

    for (const step of steps) {
        // going through the route one step at a time
        
        const segment = segmentById.get(step.segment_id);
        // the segment for this step

        if (segment === undefined) continue;
        // skip if the data isn't right

        const stepPoints = segment.geometry.map((point) => toVector(point, 0.15));
        // the points for this segment 

        if (step.from_node_id === segment.end_node_id) stepPoints.reverse();
        // reverses the points if walking backwards

        if (points.length > 0) stepPoints.shift();
        // drops the first point if its the same as the last point of the previous segment

        points.push(...stepPoints);
        // add the points to the route

    }

    if (points.length < 2) return null;
    // need at least two points to make a line

    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0);
    // connecting points 

    const tube = new THREE.TubeGeometry(curve, points.length * 16, 0.12, 8, false);
    // making a tibe along the path

    return new THREE.Mesh(tube, new THREE.MeshBasicMaterial({ color }));


}