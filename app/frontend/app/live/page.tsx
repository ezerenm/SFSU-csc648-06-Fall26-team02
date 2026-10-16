"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { GraphResponse, RouteRequest, RouteResponse } from "@/lib/spatial/contracts";
import { ARRIVED_M, distance, pickStartNode, routePolyline } from "@/lib/spatial/liveRoute";

// M2: map version is hardcoded. M3: look it up from the site's active_map_version_id.
const MAP_VERSION_ID = "b2000000-0000-4000-8000-000000000001";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Pos = { x_m: number; y_m: number; z_m: number };
type Pose = {
  sample_id: string;
  world_position: Pos;
  heading_deg: number | null;
  tracking_status: string;
  captured_at: string;
  device_id: string;
};
type RouteState = { key: string; route: RouteResponse | null; error: string | null };

const AUTO = "auto";
const select = "rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900";

export default function LivePage() {
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [pose, setPose] = useState<Pose | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [destinationId, setDestinationId] = useState("");
  const [startChoice, setStartChoice] = useState(AUTO);
  const [autoStartId, setAutoStartId] = useState<string | null>(null);
  const [routeState, setRouteState] = useState<RouteState | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ctl = new AbortController();

    (async () => {
      try {
        const res = await fetch(`/api/graph?map_version_id=${MAP_VERSION_ID}`, { signal: ctl.signal, cache: "no-store" });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? `Graph request failed (${res.status})`);
        if (!cancelled) setGraph(body as GraphResponse);
      } catch (e) {
        if (!cancelled && (e as Error).name !== "AbortError") setError((e as Error).message);
      }
      const p = await supabase.from("pose_samples")
        .select("sample_id,world_position,heading_deg,tracking_status,captured_at,device_id")
        .eq("map_version_id", MAP_VERSION_ID)
        .order("captured_at", { ascending: false }).limit(1);
      if (cancelled) return;
      if (p.error) { setError(p.error.message); return; }
      if (p.data?.length) setPose(p.data[0] as Pose);
    })();

    const channel = supabase
      .channel("live-poses")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "pose_samples",
          filter: `map_version_id=eq.${MAP_VERSION_ID}`,
        },
        (payload) => {
          const next = payload.new as Pose;
          setPose((prev) => (!prev || next.captured_at >= prev.captured_at ? next : prev));
        }
      )
      .subscribe();

    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => {
      cancelled = true;
      ctl.abort();
      supabase.removeChannel(channel);
      clearInterval(tick);
    };
  }, []);

  const nodes = useMemo(() => graph?.nodes ?? [], [graph]);
  const segments = useMemo(() => graph?.segments ?? [], [graph]);
  const destinations = useMemo(() => (graph?.destinations ?? []).filter((d) => d.is_active), [graph]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.node_id, n])), [nodes]);

  // Auto start = node nearest the phone, with hysteresis. Derived during render (no effect needed).
  const wantedAuto = pose && nodes.length
    ? pickStartNode(nodes, { x_m: pose.world_position.x_m, z_m: pose.world_position.z_m }, autoStartId)?.node_id ?? null
    : null;
  if (wantedAuto !== autoStartId) setAutoStartId(wantedAuto);

  const startId = startChoice === AUTO ? autoStartId : startChoice;
  const routeKey = startId && destinationId ? `${startId}|${destinationId}` : null;

  useEffect(() => {
    if (!routeKey) return;
    const [start_node_id, destination_id] = routeKey.split("|");
    const ctl = new AbortController();
    const request: RouteRequest = { map_version_id: MAP_VERSION_ID, start_node_id, destination_id, profile: "human" };
    fetch("/api/route", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request), signal: ctl.signal,
    })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? `Route request failed (${res.status})`);
        setRouteState({ key: routeKey, route: body as RouteResponse, error: null });
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setRouteState({ key: routeKey, route: null, error: e.message });
      });
    return () => ctl.abort();
  }, [routeKey]);

  const routeResult = routeState && routeState.key === routeKey ? routeState : null;
  const route = routeResult?.route ?? null;
  const polyline = useMemo(() => (route ? routePolyline(segments, route.steps) : []), [route, segments]);

  const view = useMemo(() => {
    if (!nodes.length) return null;
    const xs = nodes.map((n) => n.position.x_m);
    const zs = nodes.map((n) => n.position.z_m);
    // Extra room on the right so node labels are not clipped.
    const minX = Math.min(...xs) - 3;
    const maxX = Math.max(...xs) + 7;
    const minZ = Math.min(...zs) - 3;
    const maxZ = Math.max(...zs) + 3;
    return { minX, maxZ, w: maxX - minX, h: maxZ - minZ };
  }, [nodes]);

  const ageS = pose ? (now - new Date(pose.captured_at).getTime()) / 1000 : null;
  const live = !!pose && pose.tracking_status === "valid" && ageS !== null && ageS < 5;

  const destination = destinations.find((d) => d.destination_id === destinationId) ?? null;
  const destNode = destination ? byId.get(destination.node_id) ?? null : null;
  const arrived = live && !!pose && !!destNode &&
    distance(destNode.position, { x_m: pose.world_position.x_m, z_m: pose.world_position.z_m }) <= ARRIVED_M;
  const nodeLabel = (id: string) => byId.get(id)?.label ?? id.slice(0, 8);
  const segLength = (id: string) => segments.find((s) => s.segment_id === id)?.distance_m ?? 0;

  const sx = (x: number) => x - view!.minX;
  const sy = (z: number) => view!.maxZ - z;

  return (
    <main className="mx-auto max-w-3xl p-4">
      <h1 className="text-xl font-semibold">Live position (HSS 349)</h1>
      <p className="mb-3 text-sm text-gray-600 dark:text-gray-400" aria-live="polite">
        {error
          ? `Error: ${error}`
          : !pose
          ? "Waiting for the phone to send a position..."
          : live
          ? `Live, last update ${ageS!.toFixed(1)} s ago`
          : `Not live: status ${pose.tracking_status}, last update ${ageS!.toFixed(0)} s ago`}
      </p>

      <div className="mb-3 flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Start from</span>
          <select className={select} value={startChoice} onChange={(e) => setStartChoice(e.target.value)}>
            <option value={AUTO}>Nearest to my position</option>
            {nodes.map((n) => <option key={n.node_id} value={n.node_id}>{n.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Go to</span>
          <select className={select} value={destinationId} onChange={(e) => setDestinationId(e.target.value)}>
            <option value="">Choose a destination</option>
            {destinations.map((d) => <option key={d.destination_id} value={d.destination_id}>{d.name}</option>)}
          </select>
        </label>
      </div>

      {view && (
        <svg
          viewBox={`0 0 ${view.w} ${view.h}`}
          className="w-full rounded border bg-white"
          style={{ aspectRatio: `${view.w} / ${view.h}` }}
          overflow="visible"
          role="img"
          aria-label="Top-down map of HSS 349 with your live position and the selected route"
        >
          {segments.map((s) => {
            const a = byId.get(s.start_node_id);
            const b = byId.get(s.end_node_id);
            if (!a || !b) return null;
            return (
              <line
                key={s.segment_id}
                x1={sx(a.position.x_m)} y1={sy(a.position.z_m)}
                x2={sx(b.position.x_m)} y2={sy(b.position.z_m)}
                stroke="#9ca3af" strokeWidth={0.12}
              />
            );
          })}

          {polyline.length > 1 && (
            <polyline
              points={polyline.map((p) => `${sx(p.x_m)},${sy(p.z_m)}`).join(" ")}
              fill="none" stroke="#f97316" strokeWidth={0.25} strokeLinecap="round" strokeLinejoin="round"
            />
          )}

          {nodes.map((n) => (
            <g key={n.node_id}>
              <circle cx={sx(n.position.x_m)} cy={sy(n.position.z_m)} r={0.2} fill="#374151" />
              <text x={sx(n.position.x_m) + 0.3} y={sy(n.position.z_m) - 0.3}
                fontSize={0.4} fill="#374151">{n.label}</text>
            </g>
          ))}

          {destNode && (
            <circle cx={sx(destNode.position.x_m)} cy={sy(destNode.position.z_m)} r={0.45}
              fill="none" stroke="#16a34a" strokeWidth={0.12} />
          )}

          {pose && (
            <g opacity={live ? 1 : 0.4}>
              {pose.heading_deg !== null && (
                <line
                  x1={sx(pose.world_position.x_m)}
                  y1={sy(pose.world_position.z_m)}
                  x2={sx(pose.world_position.x_m) + 0.9 * Math.sin((pose.heading_deg * Math.PI) / 180)}
                  y2={sy(pose.world_position.z_m) - 0.9 * Math.cos((pose.heading_deg * Math.PI) / 180)}
                  stroke="#2563eb" strokeWidth={0.1}
                />
              )}
              <circle
                cx={sx(pose.world_position.x_m)}
                cy={sy(pose.world_position.z_m)}
                r={0.3} fill="#2563eb"
              />
            </g>
          )}
        </svg>
      )}

      <section className="mt-3 text-sm" aria-live="polite">
        {!destination && <p className="text-gray-600 dark:text-gray-400">Choose a destination to see the shortest route.</p>}
        {destination && !startId && <p className="text-gray-600 dark:text-gray-400">Waiting for a position to start from. You can also pick a start node.</p>}
        {destination && startId && !routeResult && <p className="text-gray-600 dark:text-gray-400">Finding route…</p>}
        {routeResult?.error && <p role="alert" className="text-red-600 dark:text-red-400">Could not get a route: {routeResult.error}</p>}
        {arrived && <p className="font-semibold text-green-700 dark:text-green-400">You have arrived at {destination!.name}.</p>}
        {route?.status === "unreachable" && <p className="text-red-600 dark:text-red-400">No route from {nodeLabel(route.start_node_id)} to {destination!.name}.</p>}
        {route?.status === "valid" && !arrived && (
          route.steps.length === 0
            ? <p className="text-gray-600 dark:text-gray-400">You are at {destination!.name}.</p>
            : (
              <>
                <p className="font-medium">
                  {nodeLabel(route.start_node_id)} → {destination!.name} · {route.total_distance_m.toFixed(1)} m
                </p>
                <ol className="mt-1 list-decimal pl-5 text-gray-700 dark:text-gray-300">
                  {route.steps.map((s) => (
                    <li key={s.segment_id}>
                      {nodeLabel(s.from_node_id)} → {nodeLabel(s.to_node_id)} ({segLength(s.segment_id).toFixed(1)} m)
                    </li>
                  ))}
                </ol>
              </>
            )
        )}
      </section>
    </main>
  );
}
