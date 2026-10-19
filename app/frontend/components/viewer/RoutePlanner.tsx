'use client';

// IMPORTS --------------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react';

import SceneViewer, { type ModelStatus } from './SceneViewer';
// 3d viewer

import type { GraphResponse, Profile, RouteRequest, RouteResponse } from '@/lib/spatial/contracts';
// the real API data types

import { formatMeters, placeNamer, placesFor } from '@/lib/spatial/places';
// same place names, order, and distance format as /live

// ----------------------------------------------------------------------------

// SETTINGS -------------------------------------------------------------------

const MAP_VERSION_ID = 'b2000000-0000-4000-8000-000000000001';
// HSS 349 map version (same one /live uses)
// M2: hardcoded. M3: look it up from the site's active_map_version_id

const MODEL_URL = '/models/hss349-v2.glb';
// HSS 349 v2 mesh exported from Scaniverse / Niantic
// textures resized 3072 -> 2048px WebP so it loads fast and phones don't run out of GPU memory (14.5 MB -> 4.9 MB)
// the mesh is already in the same VPS frame as the graph nodes, so no alignment transform

const FLOOR_Y = -1.29;
// floor height in the VPS frame, measured from the scan (median under all 4 nodes, spread +-3 cm)
// node y = 0 is the phone's height when the nodes were recorded

// ----------------------------------------------------------------------------

// CONTROLS -------------------------------------------------------------------

type RouteState = { key: string; route: RouteResponse | null; error: string | null };
// the last route answer, plus which start|destination|traveler it was for

export default function RoutePlanner() {
    // viewer screen is here

    // Memory -------------------------

    const [graph, setGraph] = useState<GraphResponse | null>(null);
    // the graph from the database, null while loading

    const [graphError, setGraphError] = useState<string | null>(null);

    const [modelStatus, setModelStatus] = useState<ModelStatus>('loading');
    // is the scan loading, ready, or broken

    const [startChoice, setStartChoice] = useState('');
    const [destinationChoice, setDestinationChoice] = useState('');
    // what the user picked, empty = use the first option

    const [profile, setProfile] = useState<Profile>('human');
    // picking human or robot

    const [routeState, setRouteState] = useState<RouteState | null>(null);
    // empty until a route is found

    const [loadingKey, setLoadingKey] = useState<string | null>(null);
    // which request is waiting for the server

    // --------------------------------

    // Loading the graph from the database ---

    useEffect(() => {
        const ctl = new AbortController();

        fetch(`/api/graph?map_version_id=${MAP_VERSION_ID}`, { signal: ctl.signal, cache: 'no-store' })
            .then(async (res) => {
                const body = await res.json();
                if (!res.ok) throw new Error(body?.error?.message ?? `Graph request failed (${res.status})`);
                setGraph(body as GraphResponse);
            })
            .catch((e: Error) => {
                if (e.name !== 'AbortError') setGraphError(e.message);
            });

        return () => ctl.abort();
    }, []);

    const nodes = useMemo(() => graph?.nodes ?? [], [graph]);
    const segments = useMemo(() => graph?.segments ?? [], [graph]);
    const destinations = useMemo(() => (graph?.destinations ?? []).filter((item) => item.is_active), [graph]);

    const places = useMemo(() => placesFor(nodes, destinations), [nodes, destinations]);
    // one entry per node, named after its destination (Door, Front of Room, ...)

    const destinationPlaces = places.filter((place) => place.destination_id !== null);
    // only places that are destinations can be picked as Destination

    const nameOf = placeNamer(places);

    const startNodeId = startChoice || places[0]?.node_id || '';
    const destinationId = destinationChoice || destinationPlaces[0]?.destination_id || '';
    const destination = destinations.find((item) => item.destination_id === destinationId);

    const routeKey = `${startNodeId}|${destinationId}|${profile}`;
    // changes whenever start, destination, or traveler changes

    const current = routeState?.key === routeKey ? routeState : null;
    // old routes are hidden as soon as anything changes (no stale human route on robot)

    const route = current?.route ?? null;

    // --------------------------------

    // Finding route button -----------

    function doFindRoute() {
        // runs when the user clicks Find Route

        if (!startNodeId || !destinationId) return;

        const key = routeKey;
        const request: RouteRequest = { map_version_id: MAP_VERSION_ID, start_node_id: startNodeId, destination_id: destinationId, profile };

        setLoadingKey(key);

        fetch('/api/route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
        })
            .then(async (res) => {
                const body = await res.json();
                if (!res.ok) throw new Error(body?.error?.message ?? `Route request failed (${res.status})`);
                setRouteState({ key, route: body as RouteResponse, error: null });
            })
            .catch((e: Error) => setRouteState({ key, route: null, error: e.message }))
            .finally(() => setLoadingKey((waiting) => (waiting === key ? null : waiting)));
        // the server runs the routing on the database graph
    }

    // VISUALS ----------------------------------------------------------------

    const routeColor = profile === 'human' ? 'deepskyblue' : 'orange';
    // blue for human. orange for the robot

    const [openMenu, setOpenMenu] = useState(false);
    // hamburger menu for phone users

    function segmentLength(segmentId: string) {
        // length of one path segment, for the step list
        return segments.find((segment) => segment.segment_id === segmentId)?.distance_m ?? 0;
    }

    const subtitle = graph ? `${graph.site.name} · ${graph.map_version.version_label}` : 'Loading map…';

    const scanNote =
        modelStatus === 'loading' ? 'Loading 3D scan…'
        : modelStatus === 'error' ? 'The 3D scan could not be loaded. Showing the route graph only.'
        : null;

    const destinationName = destination?.name ?? 'the destination';

    const isLoading = loadingKey === routeKey;

    return (
        <div className="relative h-full w-full overflow-hidden bg-black">
            {/* entire screen, relative lets the controls lay on top of it*/}

            <div className="absolute inset-0">
                {/*3d view fills entire screen*/}

                <SceneViewer

                modelUrl={MODEL_URL}

                floorY={FLOOR_Y}

                onModelStatus={setModelStatus}

                nodes={nodes}

                segments={segments}

                destinations={destinations}

                routeSteps={route?.steps ?? []}

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
                        <h1 className="text-lg font-semibold">Route Planner</h1>
                        <p className="text-xs text-purple-200">{subtitle}</p>
                        {scanNote && <p className="mt-1 text-xs text-yellow-200">{scanNote}</p>}
                    </div>
                    <button type="button" aria-label="Close route menu" onClick={() => setOpenMenu(false)} className="rounded p-1 text-2xl leading-none text-purple-100 hover:bg-white/10 md:hidden">
                        ×
                    </button>
                </div>

                {graphError ? (
                    <p role="alert" className="font-medium text-red-300">Could not load the map: {graphError}</p>
                ) : (
                    <>
                        <label className="flex flex-col gap-1 font-medium">
                            Start
                            <select className="rounded-md border border-white/20 bg-white/10 p-2 font-normal text-white" value={startNodeId} disabled={!graph} onChange={(event) => setStartChoice(event.target.value)}>
                                {/*dropdown*/}
                                {places.map((place) => <option key={place.node_id} value={place.node_id} className="text-gray-900">{place.name}</option>)}
                                {/*each place has one option*/}
                            </select>
                        </label>

                        <label className="flex flex-col gap-1 font-medium">
                            Destination
                            <select className="rounded-md border border-white/20 bg-white/10 p-2 font-normal text-white" value={destinationId} disabled={!graph} onChange={(event) => setDestinationChoice(event.target.value)}>
                                {/*dropdown for destination*/}
                                {destinationPlaces.map((place) => <option key={place.destination_id} value={place.destination_id!} className="text-gray-900">{place.name}</option>)}
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
                                <span className="rounded bg-orange-200 px-1.5 text-xs font-medium text-orange-900">Simulated</span>
                                {/*simulated tag*/}
                            </label>
                        </fieldset>

                        <button type="button" className="rounded-md bg-yellow-400 py-2 font-semibold text-gray-900 hover:bg-yellow-300 disabled:opacity-50" onClick={doFindRoute} disabled={!graph || isLoading}>
                            {/*yellow button with dark text for readability*/}
                            {/*SFSU colors btw*/}
                            {isLoading ? 'Finding route…' : 'Find route'}
                        </button>

                        <div aria-live="polite">
                            {/*result*/}
                            {current === null ? (
                                <p className="text-purple-200">Select a start and a destination, then choose Find route.</p>
                            ) : current.error !== null ? (
                                <p role="alert" className="font-medium text-red-300">Could not calculate a route: {current.error}</p>
                            ) : route?.status === 'unreachable' ? (
                                <p className="font-medium text-red-300">No permitted {profile === 'robot' ? 'robot ' : ''}route from {nameOf(startNodeId)} to {destinationName}.</p>
                            ) : route && route.steps.length === 0 ? (
                                <p className="font-medium text-yellow-300">Start and destination are the same ({destinationName}). No route needed.</p>
                                // start node = destination node, nothing to walk
                            ) : route ? (
                                <div>
                                    <p className="text-3xl font-semibold text-yellow-300">{formatMeters(route.total_distance_m)}</p>
                                    {/*Distance is now yellow as well*/}
                                    <p className="mt-1 font-medium">{nameOf(route.start_node_id)} → {destinationName}</p>
                                    <ol className="mt-2 list-decimal pl-5 text-purple-100">
                                        {route.steps.map((step) => <li key={step.segment_id}>{nameOf(step.from_node_id)} → {nameOf(step.to_node_id)} ({formatMeters(segmentLength(step.segment_id))})</li>)}
                                        {/*Step by step: "Door → Front of Room (5.1 m)"*/}
                                    </ol>
                                    <p className="mt-2 text-xs text-purple-300">Calculated by /api/route · graph revision {route.graph_revision}</p>
                                </div>
                            ) : null}
                        </div>
                    </>
                )}

                <div className="mt-auto space-y-1 border-t border-white/20 pt-3 text-xs text-purple-100">
                {/*The legend at the bottom of the panel*/}

                <p><span className="mr-2 inline-block h-2 w-4 rounded align-middle" style={{ backgroundColor: 'lime' }} />Open path segment</p>
                <p><span className="mr-2 inline-block h-2 w-4 rounded align-middle" style={{ backgroundColor: 'red' }} />Closed path segment</p>
                <p><span className="mr-2 inline-block h-2 w-4 rounded align-middle" style={{ backgroundColor: 'deepskyblue' }} />Person route</p>
                <p><span className="mr-2 inline-block h-2 w-4 rounded align-middle" style={{ backgroundColor: 'orange' }} />Robot route</p>
                {/*Matching legend colors with actual colors in 3d*/}

                </div>

            </aside>

        </div>
    );

}
