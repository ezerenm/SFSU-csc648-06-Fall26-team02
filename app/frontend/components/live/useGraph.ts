"use client";

// Loads the map graph and keeps it fresh, so routes react to closures (R9).
//
// Polls /api/graph every 3 s and only updates React state when the path state
// changes, so the page does not re-render for nothing. path_segments is not in the
// Supabase Realtime publication yet; when it is, this hook can listen instead and
// the page stays the same. Skips polls while the tab is hidden.
//
// Author: Sumit, Oct 31 2026

import { useEffect, useState } from "react";
import type { GraphResponse } from "@/lib/spatial/contracts";
import { describePathChange, pathStateKey } from "@/lib/spatial/pathState";

export const GRAPH_POLL_MS = 3000;

/** What changed in the last update, for the reroute banner. */
export type PathChange = { messages: string[]; at: number };

export function useGraph(mapVersionId: string) {
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [lastChange, setLastChange] = useState<PathChange | null>(null);

  useEffect(() => {
    let current: GraphResponse | null = null;
    let stopped = false;
    let controller: AbortController | null = null;

    async function load() {
      if (current && document.visibilityState === "hidden") return;
      controller = new AbortController();
      try {
        const response = await fetch(`/api/graph?map_version_id=${mapVersionId}`, { signal: controller.signal, cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error?.message ?? `Graph request failed (${response.status})`);
        const next = body as GraphResponse;
        if (stopped || (current && pathStateKey(current) === pathStateKey(next))) return;
        if (current) setLastChange({ messages: describePathChange(current.segments, next.segments), at: Date.now() });
        current = next;
        setGraph(next);
        setGraphError(null);
      } catch (error) {
        // A failed refresh keeps the last good graph; only the first load shows an error.
        if (!stopped && !current && (error as Error).name !== "AbortError") setGraphError((error as Error).message);
      }
    }

    load();
    const timer = setInterval(load, GRAPH_POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
      controller?.abort();
    };
  }, [mapVersionId]);

  return { graph, graphError, lastChange };
}
