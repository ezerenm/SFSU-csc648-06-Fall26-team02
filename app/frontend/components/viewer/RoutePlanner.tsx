'use client';

// IMPORTS --------------------------------------------------------------------

import { useState } from 'react';

import SceneViewer from './SceneViewer';
// 3d viewer

// Teomporary imports -----------------

import { temporaryGraphDestinations, temporaryGraphNodes, temporaryGraphSegments } from './temporaryGraph';
// n1 to n5 example data

import { temporaryFindRoute, type RouteResult } from './temporaryRoute';
// route finder

// ----------------------------------------------------------------------------

// SETTINGS -------------------------------------------------------------------

// Temporary settings -----------------

const placeholderModelUrl = '/models/placeholder-hallway.glb';
// temporary hallway model

// ----------------------------------------------------------------------------

// CONTROLS -------------------------------------------------------------------

export default function RoutePlanner() {
    // viewer screen is here

    // Memory -------------------------

    const [startNodeId, setStartNodeId] = useState('N1');
    // n1 is the entrance
    // starting point

    const [destinationId, setDestinationId] = useState('D1');
    // picking the destination

    const [profile, setProfile] = useState<'human' | 'robot'>('human');
    // picking human or robot

    const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
    // empty until a route is found
    
    // --------------------------------

    // Finding route button -----------

    function doFindRoute() {
        // runs when the user clicks Find Route

        const destination = temporaryGraphDestinations.find(item => item.destination_id === destinationId);
        // find out which node the destination is on

        if (destination === undefined) return;
        // if there is no destination found, stop

        setRouteResult(temporaryFindRoute(temporaryGraphSegments, startNodeId, destination.node_id, profile));
        // run route finder, save results
        // React draws and ScreenViewer displays the new route

    }

    // VISUALS ----------------------------------------------------------------

    const routeColor = profile === 'human' ? 'blue' : 'orange';
    // blue for human. orange for the robot

    const [openMenu, setOpenMenu] = useState(false);
    // hamburger menu for phone users

    function labelOf(nodeId: string) {
        // use node IDs, change their names to descriptive hints for the step by step route

        return temporaryGraphNodes.find((node) => node.node_id === nodeId)?.label ?? nodeId;
        // if not found, show id
        // fiding the node and using its label
    }

    return (
        <div className="relative h-full w-full overflow-hidden bg-black">
            {/* entire screen, relative lets the controls lay on top of it*/}

            <div className="absolute inset-0">
                {/*3d view fills entire screen*/}

                <SceneViewer

                modelUrl={placeholderModelUrl}

                nodes={temporaryGraphNodes}

                segments={temporaryGraphSegments}

                destinations={temporaryGraphDestinations}

                routeSteps={routeResult?.steps ?? []}

                routeColor={routeColor}

                />
            </div>

            <button
                type="button"

                aria-label="Open the route menu"

                aria-expanded={openMenu}

                onClick={() => setOpenMenu(true)}

                className={`absolute left-4 top-4 z-20 rounded-lg bg-purple-900/80 p-3 shadow-lg backdrop-blur md:hidden ${openMenu ? 'hidden' : ''}`}
            >

                {/*hamburger button for phone users*/}
                <span className="block h-0.5 w-6 bg-white" />
                <span className="mt-1.5 block h-0.5 w-6 bg-white" />
                <span className="mt-1.5 block h-0.5 w-6 bg-white" />
                {/*the three white bars for hamburger menu*/}
            </button>

            <aside className={`absolute inset-y-0 left-0 z-10 w-full max-w-xs flex-col gap-4 overflow-y-auto bg-purple-900/80 p-5 text-sm text-white shadow-2xl backdrop-blur-md md:flex ${openMenu ? 'flex' : 'hidden'}`}>
            {/*purple panel, opaciity set a little lower, blurs content behind it. Hidden on phones unless openMenu*/}

                <div className="flex items-start justify-between">
                    {/*close button on the right, title on the left*/}
                    <div>
                        <h1 className="text-lg font-semibold">Find a route</h1>
                        <p className="text-xs text-purple-200">SFSU 3D View · Placeholder Model</p>
                    </div>
                    <button type="button" aria-label="Close route menu" onClick={() => setOpenMenu(false)} className="rounded p-1 text-2xl leading-none text-purple-100 hover:bg-white/10 md:hidden">
                        ×
                    </button>        
                </div>

                <label className="flex flex-col gap-1 font-medium">
                    Start
                    <select className="rounded-md border border-white/20 bg-white/10 p-2 font-normal text-white" value={startNodeId} onChange={(event) => setStartNodeId(event.target.value)}>
                        {/*dropdown*/}
                        {temporaryGraphNodes.map((node) => <option key={node.node_id} value={node.node_id} className="text-gray-900">{node.label}</option>)}
                        {/*each node has one option*/}
                    </select>
                </label>

                <label className="flex flex-col gap-1 font-medium">
                    Destination
                    <select className="rounded-md border border-white/20 bg-white/10 p-2 font-normal text-white" value={destinationId} onChange={(event) => setDestinationId(event.target.value)}>
                        {/*dropdown for destination*/}
                        {temporaryGraphDestinations.map((item) => <option key={item.destination_id} value={item.destination_id} className="text-gray=900">{item.name}</option>)}
                        {/*each destiantion has one option*/}
                        </select>
                </label>

                <fieldset className="flex flex-col gap-1">
                    {/*groups both buttons together*/}
                    <legend className="mb-1 font-medium">Traveler</legend>
                    <label className="flex items-center gap-2">
                        <input type="radio" name="traveler" className="accent-yellow-400" checked={profile === 'human'} onChange={() => setProfile('human')} />
                        {/*yellow when selected*/}
                        Person
                    </label>
                    <label className="flex items-center gap-2">
                        <input type="radio" name="traveler" className="accent-yellow-400" checked={profile === 'robot'} onChange={() => setProfile('robot')} />
                        Robot
                        <span className="rounded bg-orange-200 px-1.5 text-xs font-medium text-orange-900">SIMULATED</span>
                        {/*simulated tag*/}
                
                    </label>
                    
                </fieldset>

                <button type="button" className="rounded-md bg-yellow-400 py-2 font-semibold text-gray-900 hover:bg-yellow-300" onClick={doFindRoute}>
                    {/*yellow button with dark text for readability*/}
                    {/*SFSU colors btw*/}
                    Find route
                </button>

                <div aria-live="polite">
                    {/*result*/}
                    {routeResult === null ? (
                        <p className="text-purple-200"> Pick a starting point and a destination</p>
                    ) : routeResult.status === 'unreachable' ? (
                        <p className="font-medium text-red-300">Unreachable: there is no permitted route available.</p>
                    ) : (
                        <div>
                            <p className="text-3xl font-semibold text-yellow-300">{routeResult.total_distance_m} m</p>
                            {/*Distance is now yellow as well*/}
                            <ol className="mt-2 list-decimal pl-5 text-purple-100">
                                {routeResult.steps.map((step) => <li key={step.segment_id}>{labelOf(step.from_node_id)} → {labelOf(step.to_node_id)}</li>)}
                                {/*Step by step instructions like "Corner" -> "Entrance"*/}
                            </ol>
                        </div>      
                    )}
                </div>

                <div className="mt-auto space-y-1 border-t border-white/20 pt-3 text-xs text-purple-100">
                {/*The legend at the bottom of the panel*/}

                <p><span className="mr-2 inline-block h-2 w-4 rounded align-middle" style={{ backgroundColor: 'green' }} />Open hallway</p>
                <p><span className="mr-2 inline-block h-2 w-4 rounded align-middle" style={{ backgroundColor: '#ef4444' }} />Closed hallway</p>
                <p><span className="mr-2 inline-block h-2 w-4 rounded align-middle" style={{ backgroundColor: 'blue' }} />Human route</p>
                <p><span className="mr-2 inline-block h-2 w-4 rounded align-middle" style={{ backgroundColor: 'orange' }} />Robot route</p>
                {/*Matching legend colors with actual colors in 3d*/}
                
                </div>

            </aside>
                        



                

        </div>
    );



}
