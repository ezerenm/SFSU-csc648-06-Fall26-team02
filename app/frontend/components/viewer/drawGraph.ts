// turns the graph data like nodes, halways, and destinations into 3d objects that viewers can show


// IMPORTS --------------------------------------------------------------------
import * as THREE from 'three';
// three.js library

import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
// allows us to attatch normal HTML labels to the 3d points
// the tag will be attatched to the 3d point when you move the cmaera

import type { Destination, GraphNode, PathSegment, Position } from '@/lib/spatial/contracts';
// the real API data types (same field names the database uses)

// ======--------------------------------------------------------------------


// HELPER FOR POSITION -> ThreeJS point --------------------------------------

export function toVector(position: Position, lift = 0.1, floorY = 0): THREE.Vector3 {
    // turning x_m, y_m, and z_m, into Vector3
    // floorY moves the graph down onto the scanned floor
    // (node y = 0 is phone height in the VPS frame, the floor in the scan is lower)

    return new THREE.Vector3(position.x_m, position.y_m + floorY + lift, position.z_m);
    // Y is up so lift is on Y

}

// ---------------------------------------------------------------------------

// BUILDING GRAPH ------------------------------------------------------------

export function buildGraph(nodes: GraphNode[], segments: PathSegment[], destinations: Destination[], floorY = 0): THREE.Group {
    // builds the dots, lines, and labels

    const group = new THREE.Group();
    // empty box to hold everything
    // makes redrawing easy since adding or removing bag removes or adds all

    group.renderOrder = 5;
    // drawn after the scan

    const nodesById = new Map(nodes.map((node) => [node.node_id, node]));
    // so we can look up nodes by their id

    // Putting a white ball on every node ------------------------------------

    for (const node of nodes) {

        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.18), new THREE.MeshBasicMaterial({ color: 'white', depthTest: false }));
        // depthTest false = desks and chairs in the scan can't hide the dots

        ball.position.copy(toVector(node.position, 0.3, floorY));
        // the ball is at the node's position

        ball.renderOrder = 5;

        group.add(ball);
        // add the ball to the group

    }

    // ---------------------------------------------------------------------------

    // Drawing a line for each hallway -------------------------------------------

    for (const segment of segments) {
        // one line for each segment

        const points = segment.geometry.map((point) => toVector(point, 0.1, floorY));
        // path points

        const lineColor = segment.availability === 'closed' ? 'red' : 'lime';
        // red if closed, green if open

        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: lineColor, depthTest: false }));
        // the line

        line.renderOrder = 5;

        group.add(line);
        // add the line to the group

    }

    // ---------------------------------------------------------------------------

    // Adding a name tag for each destination ------------------------------------

    for (const destination of destinations) {
        // one label for each destination

        const node = nodesById.get(destination.node_id);
        // the node that this destination is at

        if (node === undefined) continue;
        // skip if the data isn't right

        const labelElement = document.createElement('div');
        // the HTML element for the label

        labelElement.textContent = destination.name;
        // the text of the label

        labelElement.style.cssText = 'background:rgba(0,0,0,0.7);color:white;padding:2px 6px;border-radius:4px;font:12px sans-serif;';
        // small tag

        const label = new CSS2DObject(labelElement);
        // wrap so Three.js can place it

        label.position.copy(toVector(node.position, 0.8, floorY));

        group.add(label);
        // add the label to the group

    }

    // ---------------------------------------------------------------------------

    return group;
    // the whole graph
}
