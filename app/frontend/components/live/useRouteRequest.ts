"use client";

// R9.2: asks /api/route for one profile and asks again when the path state changes

import { useEffect, useState } from "react";

import type { Profile, RouteRequest, RouteResponse } from "@/lib/spatial/contracts";

type RouteResult = { key: string; route: RouteResponse | null; error: string | null };

export type RouteRequestState = { route: RouteResponse | null; error: string | null; loading: boolean };

export function useRouteRequest(
    mapVersionId: string,
    startNodeId: string | null,
    destinationId: string | null,
    profile: Profile,
    pathKey: string,
): RouteRequestState {

    const [result, setResult] = useState<RouteResult | null>(null);
    // the last answer and which start, destination and profile it was for

    const routeKey = startNodeId && destinationId ? startNodeId + "|" + destinationId + "|" + profile : null;
    // what the route is for

    const requestKey = routeKey ? routeKey + "#" + pathKey : null;
    // ask again when a path closes, reopens or changes robot access

    useEffect(() => {

        if (!requestKey) {

            return;
            // nothing to ask for

        }

        const key = requestKey.split("#")[0];
        // the old route stays on screen until the new one arrives

        const [start, destination] = key.split("|");

        const controller = new AbortController();
        // cancel if the start or destination changes again

        const request: RouteRequest = { map_version_id: mapVersionId, start_node_id: start, destination_id: destination, profile };

        fetch("/api/route", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request), signal: controller.signal,
        })
            .then(async (response) => {

                const body = await response.json();

                if (!response.ok) {

                    throw new Error(body?.error?.message ?? "Route request failed (" + response.status + ")");

                }

                setResult({ key, route: body as RouteResponse, error: null });
            })
            .catch((error: Error) => {

                if (error.name !== "AbortError") {

                    setResult({ key, route: null, error: error.message });

                }
            });

        return () => controller.abort();

    }, [requestKey, mapVersionId, profile]);

    const current = result && result.key === routeKey ? result : null;
    // only use an answer for the start and destination we have right now

    return { route: current?.route ?? null, error: current?.error ?? null, loading: routeKey !== null && current === null };
}
