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
    // n1 is the enterance
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

    const routeColor = profile === 'human' ? 'blue' : 'orange';

    return null;
    // show nothing for now
    // BOOKMARK, waiting for Calvin ui decision

}
