// Takes the route and turns it into one tube. Blue for human, orange for robot. 

// IMPORTS --------------------------------------------------------------------

import * as THREE from 'three';
// three js library

import type { PathSegment } from './temporaryGraph';
// segment type from temporary graph

import type { RouteStep } from './temporaryRoute';
// step type from temporary route

import { toVector } from './drawGraph';
// function to turn a position into a Three.js point

// ----------------------------------------------------------------------------

// BUILDING ROUTE TUBE --------------------------------------------------------

export function buildRoute(steps: RouteStep[], segments: PathSegment[], color: string): THREE.Mesh | null {
    // turning the route steps into a big line like a tube

    const segmentById = new Map(segments.map((segment) => [segment.segment_id, segment]));
    // quick lookup

    const points: THREE.Vector3[] = [];
    // every point in the route in order

    // Collecting the points from the hallways --------------------------------

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

    // ------------------------------------------------------------------------

    // Check to see if there is anything to draw ------------------------------

    if (points.length < 2) return null;
    // need at least two points to make a line

    // ------------------------------------------------------------------------

    // Turning points into a tube----------------------------------------------

    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0);
    // connecting points by making a path that goes through all points in order
    // if its false, don't go back to the start
    // 0 at the end so it bends like hallways do

    const tube = new THREE.TubeGeometry(curve, points.length * 16, 0.12, 8, false);
    // making a tube along the path by wrapping it. 
    // points.length * 16 = how many pieces the tube is constructed of, the more the smoother
    // 8 = how many sides around
    // false = making sure the tube doesn't close as a loop

    return new THREE.Mesh(tube, new THREE.MeshBasicMaterial({ color }));

    // ------------------------------------------------------------------------


}