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

import type { Destination, GraphNode, PathSegment, RouteStep } from '@/lib/spatial/contracts';
// the real API data types (what /api/graph and /api/route send back)

export type ModelStatus = 'none' | 'loading' | 'ready' | 'error';
// lets the control panel say if the scan is still loading or failed

// ---------------------------------------------------------------------------

// SCENE PROPS ---------------------------------------------------------------

type SceneViewerProps = {
    // list of all things that this viewer needs
    
    modelUrl: string | null;
    // .glb
    // if there is no model, a grid floor appears

    floorY: number;
    // height of the scanned floor in the VPS frame (meters)
    // the graph is drawn on this height

    onModelStatus?: (status: ModelStatus) => void;
    // tells the parent when the scan starts loading, finishes, or fails

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


export default function SceneViewer({ modelUrl, floorY, onModelStatus, nodes, segments, destinations, routeSteps, routeColor }: SceneViewerProps) {
    // The 3d viewer
    // React will run this 

    // Memory -----------------------------------------

    const containerRef = useRef<HTMLDivElement>(null);
    // <div> to hold the 3d view

    const sceneRef = useRef<THREE.Scene | null>(null);
    // the 3d scene

    const [sceneVersion, setSceneVersion] = useState(0);
    // increments each time a new scene is created

    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    // kept so the camera can be pointed at the graph once it loads

    const statusRef = useRef(onModelStatus);
    useEffect(() => { statusRef.current = onModelStatus; }, [onModelStatus]);
    // newest callback without rebuilding the 3d world

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

         camera.position.set(6, 12, 10);
         // setting the view camera somewhere high and at a angle to the side
         // the framing effect below moves it over the real graph

         cameraRef.current = camera;

         // ---------------------------------------

         // 3D view drawer ------------------------
         // draws what the camera sees

         const renderer = new THREE.WebGLRenderer({ antialias: true });
         // antialias provides smooth edges

         renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
         // sharp on phones / retina, capped so it stays fast

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

         controlsRef.current = controls;
         // the framing effect below sets the point the camera spins around
         // ---------------------------------------

         // LIGHTS --------------------------------

         scene.add(new THREE.AmbientLight('white', 1.5));
         // adding light everywhere so it isn't dark

         scene.add(new THREE.DirectionalLight('white', 1));
         // adding light to come from one direction to add shadows and shading to the model

         // ---------------------------------------

         // FLOOR ---------------------------------

         let disposed = false;
         // true once the viewer leaves the page, so a late scan isn't added

         let model: THREE.Object3D | null = null;
         // the loaded scan, kept so its memory can be freed

         if (modelUrl === null) {
            // if no model file is given, show a grid floor instead

            const grid = new THREE.GridHelper(40, 40, 'gray', '#333');
            // 40 x 40 meters, 1 meter squares

            grid.position.y = floorY;
            // on the floor height

            scene.add(grid);
            statusRef.current?.('none');

         } else {
            // there is a model file, so we load it

            statusRef.current?.('loading');

            new GLTFLoader().load(
                // loading the .glb file

                modelUrl,

                (gltf) => {
                    // the scan is in the same VPS frame as the graph, so no moving or scaling

                    if (disposed) { disposeObject(gltf.scene); return; }
                    // viewer was closed while loading

                    model = gltf.scene;
                    scene.add(model);
                    statusRef.current?.('ready');
                },

                undefined, 
                
                (error) => {
                    console.error('Model could not be loaded:', error);
                    // print error if loading fails

                    if (!disposed) statusRef.current?.('error');
                }
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

            disposed = true;

            if (model !== null) disposeObject(model);
            // frees the scan's meshes and textures from the GPU

            sceneRef.current = null;
            cameraRef.current = null;
            controlsRef.current = null;
            // clears all memory of the 3d world

         };

         // ---------------------------------------
    }, [modelUrl, floorY]);

    // DRAWING THE GRAPH --------------------------

    useEffect(() => {
        // run after world is created

        const scene = sceneRef.current;
        // taking the current 3d world from memory

        if (scene === null) return;
        // if there is no 3d world, then stop

        const graph = buildGraph(nodes, segments, destinations, floorY);
        // drawGraph.ts builds the spheres, lines, name tags

        scene.add(graph);
        // add to 3d world

        return () => {
            // clean up

            scene.remove(graph);
            
            graph.traverse((child) => {

                if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
                    child.geometry.dispose();
                    (child.material as THREE.Material).dispose();
                }
                // if its a sphere or line, free its memory

                if ('element' in child && child.element instanceof HTMLElement) child.element.remove();
                // if its a name tag, remove HTML <div>
            });
        };

    }, [nodes, segments, destinations, floorY, sceneVersion]);
    // run again when the dots, lines, or destinations update
    // run again when theres a new sceneVersion

    // -----------------------------------------

    // POINTING THE CAMERA AT THE GRAPH --------

    useEffect(() => {
        // runs when the graph loads

        const camera = cameraRef.current;
        const controls = controlsRef.current;

        if (camera === null || controls === null || nodes.length === 0) return;

        const xs = nodes.map((node) => node.position.x_m);
        const zs = nodes.map((node) => node.position.z_m);

        const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
        const centerZ = (Math.min(...zs) + Math.max(...zs)) / 2;
        // middle of the graph

        const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs), 4);
        // how big the graph is (at least 4 m so tiny graphs aren't too close)

        const halfV = THREE.MathUtils.degToRad(camera.fov / 2);
        const halfH = Math.atan(Math.tan(halfV) * camera.aspect);
        // the camera sees less side to side on a tall phone screen

        const distance = (size * 0.75) / Math.tan(Math.min(halfV, halfH));
        // far enough back that the whole graph (plus some room) fits on screen

        const direction = new THREE.Vector3(0.25, 1, 0.7).normalize();
        // high up and a little to the side, looking down at the room

        controls.target.set(centerX, floorY, centerZ);
        camera.position.set(centerX, floorY, centerZ).addScaledVector(direction, distance);

        controls.update();

    }, [nodes, floorY, sceneVersion]);

    // -----------------------------------------

    // DRAWING THE ROUTES ----------------------

    useEffect(() => {
        // runs when a new route is chosen 
        // runs if the route color changes

        const scene = sceneRef.current;
        // take the current 3d world

        if (scene === null || routeSteps.length === 0) return;
        // if there is no 3d wolrd or route picked, skip since theres nothing to draw

        const route = buildRoute(routeSteps, segments, routeColor, floorY);
        // drawRoute.ts builds the tube for the route

        if (route === null) return;
        // stop if buildRoute returned nothing

        scene.add(route);
        // add the tube to the 3d world

        return () => {
            // clean up

            scene.remove(route);
            // take the old tube out of the 3d world

            route.geometry.dispose();
            (route.material as THREE.Material).dispose();
            // free the shape memory

        };
    }, [routeSteps, segments, routeColor, floorY, sceneVersion]);
    // run again when the route, path, color, or world updates

    // -----------------------------------------

    return <div ref={containerRef} className="relative h-full w-full" />;
    // the <div> containerRef points to

}

// HELPERS -------------------------------------------------------------------

function disposeObject(root: THREE.Object3D) {
    // frees the GPU memory of a loaded model (meshes, materials, textures)

    root.traverse((child) => {

        if (!(child instanceof THREE.Mesh)) return;

        child.geometry.dispose();

        const materials: THREE.Material[] = Array.isArray(child.material) ? child.material : [child.material];

        for (const material of materials) {
            for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
            material.dispose();
        }
    });
}
