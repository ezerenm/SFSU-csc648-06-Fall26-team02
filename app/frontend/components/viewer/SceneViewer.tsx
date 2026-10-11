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

         // MOUSE CONTROLS ------------------------

         const controls = new OrbitControls(camera, renderer.domElement);
         // lets the user scroll to zoom, spin the view. Moves the camera.

         controls.target.set(2, 0, -1);
         // the middle of the n1 to n5 graph
         // the point the camera is going to spin around
         // ---------------------------------------

         // LIGHTS --------------------------------

         scene.add(new THREE.AmbientLight('white', 1.5));
         // adding light everywhere so it isn't dark

         scene.add(new THREE.DirectionalLight('white', 1));
         // adding light to come from one direction to add shadows and shading to the model

         // ---------------------------------------

         // FLOOR ---------------------------------

         if (modelUrl === null) {
            // if no model file is found, make the floor plain

            const floor = new THREE.Mesh(new THREE.BoxGeometry(12, 0.1, 18), new THREE.MeshStandardMaterial({ color: 'gray'}));
            // gray box
            // 12 meters wide, 0.1 meters thick, 18 meters long

            floor.position.set(2, -0.05, -1);
            // putting the floor under the graph
            // y = 0

            scene.add(floor);
            // adding the floor to the 3d world

         } else {
            // there is a model file found, so we load it

            new GLTFLoader().load(
                // loading the .glb file

                modelUrl,

                (gltf) => scene.add(gltf.scene),
                // when it finishes loading in, the model will be added to the 3d world
                // scan = world coordinates system

                undefined, 
                
                (error) => console.error('Model could not be loaded:', error)
                // print error if loading fails
            );
         }

         // ---------------------------------------

         setSceneVersion((version) => version + 1);
         // add 1 to the count
         // alerts that the scene is built and routes/dots can be added now

         // ANIMATION -----------------------------
         
         let frameId = 0;
         // holds ID number the browser assigns the animation
         // we can use this ID number to stop the loop

         function animate() {
            // makes one still of the 3D scene and repeats 60 times a second

            frameId = requestAnimationFrame(animate);
            // call animate again right before remaking the screen
            // gives us ID number we can save and use to cancel 

            controls.update();
            // match camera to users draggin / scrolling
            
            renderer.render(scene, camera);
            // takes 3D scene and remakes what the camera is currently seeing onto the screen

            labelRenderer.render(scene, camera);
            // does the same. but for HTML name tags of the dots
            // tag sticks to the dots

         }

         animate();
         // trigger animate

         // ---------------------------------------

         // WINDOW SIZING -------------------------

         function doResize() {
            // function triggers when the browser window changes size

            if (container === null) return;
            // checks to make sure there is a 3d picture before measuring
            // skip if theres nothing to measure

            camera.aspect = container.clientWidth / container.clientHeight;
            // aspect = width/height 
            // alerts camera about the new screen shape

            camera.updateProjectionMatrix();
            // redo math with the new screen shape

            renderer.setSize(container.clientWidth, container.clientHeight);
            // resizes the 3d view to the new width and height

            labelRenderer.setSize(container.clientWidth, container.clientHeight);
            // resizes the nametags as well

         }

         window.addEventListener('resize', doResize);
         // tells browser to run doResize everytime the screen changes shape

         // ---------------------------------------

         // CLEAN UP ------------------------------

         return () => {
            // wipes everything when viewer leaves the page

            cancelAnimationFrame(frameId);
            // stops the animation with the ID number saved

            window.removeEventListener('resize', doResize);
            // stops listening for window shape changes

            controls.dispose();
            // shuts off mouse controls

            renderer.dispose();
            // frees memory

            container.removeChild(renderer.domElement);
            // takes 3d canvas out of the container

            container.removeChild(labelRenderer.domElement);
            // takes nametags out of the box

            sceneRef.current = null;
            // clears all memory of the 3d world

         };

         // ---------------------------------------
    }, [modelUrl]);

    




         

         


        

