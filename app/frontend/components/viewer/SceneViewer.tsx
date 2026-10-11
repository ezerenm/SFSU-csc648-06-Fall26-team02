'use client';
// file runs in browser

// IMPORTS --------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
// react tools

import * as THREE from 'three';
// three.js library

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// lets the users mouse spin and zoom in the camera

import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
// draws the HTML on the 3d view

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// loads the .glb files (the scaniverse scans)

import { buildGraph } from './drawGraph';
// makes the dots, lines, and labels

import { buildRoute } from './drawRoute';
// makes the route tubes

import type { Destination, GraphNode, PathSegment } from './temporaryGraph';
// the data shape maps from temporaryGraph (what the hallways and destinations will look like)

import type { RouteStep } from './temporaryRoute';
// the shape of one route step type

// ---------------------------------------------------------------------------

// SCENE PROPS ---------------------------------------------------------------

type SceneViewerProps = {
    // list of all things that this viewer needs
    
    modelUrl: string | null;
    // .glb
    // if there is no model, a gray floor appears

    nodes: GraphNode[];
    // all the dots to be drawn

    segments: PathSegment[];
    // all the lines (hallways) to be drawn

    destinations: Destination[];
    // graph labels or the places that get a special name like Room 102 or Resume Room

    routeSteps: RouteStep[];
    // the route to be highlighted
    // empty list = no routes found yet

    routeColor: string;
    // the color of the route tubes

};

// ---------------------------------------------------------------------------

// VIEWER --------------------------------------------------------------------


export default function SceneViewer({ modelUrl, nodes, segments, destinations, routeSteps, routeColor }: SceneViewerProps) {
    // The 3d viewer
    // React will run this 

    // Memory -----------------------------------------

    const containerRef = useRef<HTMLDivElement>(null);
    // <div> to hold the 3d view

    const sceneRef = useRef<THREE.Scene | null>(null);
    // the 3d scene

    const [sceneVersion, setSceneVersion] = useState(0);
    // increments each time a new scene is created

    // ------------------------------------------------

    // 3D WORLD CREATION ------------------------------


    useEffect(() => {
        // building the 3d scene

         const container = containerRef.current;
         // taking the <div> from the memory

         if (container === null) return;
         // checking if the <div> is there, if the <div> isn't, stop

         // 3D SCENE ------------------------------

         const scene = new THREE.Scene();
         // the 3d world

         scene.background = new THREE.Color('black');
         // black background

         sceneRef.current = scene;

         // ---------------------------------------

         // CAMERA --------------------------------
         
         const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);

         camera.position.set(14, 14, 12);
         // setting the view camera somewhere high and at a angle to the side

         // ---------------------------------------

         // 3D view drawer ------------------------
         // draws what the camera sees

         const renderer = new THREE.WebGLRenderer({ antialias: true });
         // antialias provides smooth edges

         renderer.setSize(container.clientWidth, container.clientHeight);
         // matching the div

         container.appendChild(renderer.domElement);
         // putting the canvas into the div

         // ---------------------------------------

         // 3D view name tag drawer ---------------

         const labelRenderer = new CSS2DRenderer();
         
         labelRenderer.setSize(container.clientWidth, container.clientHeight);
         
         labelRenderer.domElement.style.position = 'absolute';

         labelRenderer.domElement.style.top = '0';

         labelRenderer.domElement.style.pointerEvents = 'none';

         container.appendChild(labelRenderer.domElement);
         // 3D view drawer ------------------------

         

         

         


        

