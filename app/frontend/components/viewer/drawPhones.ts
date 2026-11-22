// turns the PhoneDots into small spheres on the floor

// IMPORTS --------------------------------------------------------------------

import * as THREE from 'three';
// three js library

import type { PhoneDot } from '../../lib/spatial/phoneDots';
// one dot for each phone
// created by phoneDotsFor

// IMPORTS end ----------------------------------------------------------------

// SIZE -----------------------------------------------------------------------

export const DOT_RADIUS = 0.18;
// how big the ball is in meters

export const DOT_LIFT = 0.2;
// how high above floor level the ball is

export const HEADING_LENGTH = 0.5;
// how long the facing line is in meters

// SIZE end -------------------------------------------------------------------

// HEADING HELPER FUNC --------------------------------------------------------

export function headingDirection(headingDegrees: number): THREE.Vector3 {
    // which way the phone is facing as a direction on the floor
    // 0 degrees faces -z

    const headingRadians = (headingDegrees * Math.PI) / 180;
    // three js uses radians

    const xPart = Math.sin(headingRadians);
    // how much it points to the side

    const zPart = -Math.cos(headingRadians);
    // how much it points forward
    // forward is -z

    return new THREE.Vector3(xPart, 0, zPart);
    // y = 0 because the line is always just on the floor

}

// HEADING HELPER FUNC end ----------------------------------------------------

// MAKING DOTS ----------------------------------------------------------------

export function buildPhoneDots(dots: PhoneDot[], floorY = 0): THREE.Group {
    // one group holding every phone's ball and facing direction line

    const group = new THREE.Group();
    // empty box to fill

    for (const dot of dots) {
        
        const center = new THREE.Vector3(dot.xMeters, floorY + DOT_LIFT, dot.zMeters);
        // where the ball goes
    
    // BALL -------------------------------------------------------------------

    const ballMaterial = new THREE.MeshBasicMaterial({

        color: dot.color, transparent: true, opacity: dot.opacity, depthTest: false,

    });
    // transparent 

    const ball = new THREE.Mesh(new THREE.SphereGeometry(DOT_RADIUS, 16, 12), ballMaterial);
    // the ball

    ball.position.copy(center);
    // moving the ball to the phone's spot

    ball.renderOrder = 20;
    // drawn on top of the graph and routes


    ball.name = dot.deviceId;

    group.add(ball);

    // BALL end ---------------------------------------------------------------

    // FACING DIRECTION LINE --------------------------------------------------

    if (dot.headingDegrees === null) {

        continue;
        // no line if we don't know which way it is facing

    }

    const lineEnd = headingDirection(dot.headingDegrees).multiplyScalar(HEADING_LENGTH).add(center);
    // starts at the ball and then HEADING_LENGTH meters to wherever its facing

    const lineGeometry = new THREE.BufferGeometry().setFromPoints([center, lineEnd]);
    // a line with two points
    // ball and tip

    const lineMaterial = new THREE.LineBasicMaterial({

        color: dot.color, transparent: true, opacity: dot.opacity, depthTest: false,

    });
    // the same color and look as the ball

    const line = new THREE.Line(lineGeometry, lineMaterial);

    line.renderOrder = 20;

    group.add(line);

    // FACING DIRECTION LINE end ----------------------------------------------

    }

return group;

}

// MAKING DOTS end ------------------------------------------------------------

// CAPTURE RING ---------------------------------------------------------------

export const RING_CYCLE_MS = 1500;
// one pulse for every 1.5 seconds

export function ringPulse(elapsedMs: number): { scale: number; opacity: number } {
    // how big and how see through the ring is

    const progress = (elapsedMs % RING_CYCLE_MS) / RING_CYCLE_MS;
    // 0 at the start of the pulse, and then almost 1 right before it restarts

    const scale = 1 + progress;
    // grows from normal size to double size

    const opacity = 1 - progress;
    // fades from solid to invisible

    return { scale: scale, opacity: opacity };

}

export function buildCaptureRing(dot: PhoneDot, floorY = 0): THREE.Mesh {
    // a flat ring on the floor under the phone that is capturing

    const ringMaterial = new THREE.MeshBasicMaterial({

        color: dot.color, transparent: true, opacity: 1, depthTest: false, side: THREE.DoubleSide,

    });
    // same color as the dot
    // orange for the robot
    // transparent so it can fade

    const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.4, 32), ringMaterial);
    // donut shape

    ring.rotation.x = -Math.PI / 2;
    // RingGeommetry stands like a wall, so we tip 90 degrees to lie flat on the floor

    ring.position.set(dot.xMeters, floorY + 0.05, dot.zMeters);
    // under the phone, just above the floor so it doesn't flicker into it

    ring.renderOrder = 15;

    return ring;
}

// CAPTURE RING end -----------------------------------------------------------


