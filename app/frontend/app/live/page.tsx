"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// M2: map version is hardcoded. M3: look it up from the site's active_map_version_id.
const MAP_VERSION_ID = "b2000000-0000-4000-8000-000000000001";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Pos = { x_m: number; y_m: number; z_m: number };
type GraphNode = { node_id: string; label: string; position: Pos };
type Segment = { segment_id: string; label: string; start_node_id: string; end_node_id: string };
type Pose = {
  sample_id: string;
  world_position: Pos;
  heading_deg: number | null;
  tracking_status: string;
  captured_at: string;
  device_id: string;
};

export default function LivePage() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [pose, setPose] = useState<Pose | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [n, s, p] = await Promise.all([
        supabase.from("graph_nodes").select("node_id,label,position")
          .eq("map_version_id", MAP_VERSION_ID),
        supabase.from("path_segments").select("segment_id,label,start_node_id,end_node_id")
          .eq("map_version_id", MAP_VERSION_ID),
        supabase.from("pose_samples")
          .select("sample_id,world_position,heading_deg,tracking_status,captured_at,device_id")
          .eq("map_version_id", MAP_VERSION_ID)
          .order("captured_at", { ascending: false }).limit(1),
      ]);
      if (cancelled) return;
      const err = n.error ?? s.error ?? p.error;
      if (err) { setError(err.message); return; }
      setNodes((n.data ?? []) as GraphNode[]);
      setSegments((s.data ?? []) as Segment[]);
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
      supabase.removeChannel(channel);
      clearInterval(tick);
    };
  }, []);

  const view = useMemo(() => {
    if (!nodes.length) return null;
    const pad = 3;
    const xs = nodes.map((n) => n.position.x_m);
    const zs = nodes.map((n) => n.position.z_m);
    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minZ = Math.min(...zs) - pad;
    const maxZ = Math.max(...zs) + pad;
    return { minX, maxZ, w: maxX - minX, h: maxZ - minZ };
  }, [nodes]);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.node_id, n])), [nodes]);

  const ageS = pose ? (now - new Date(pose.captured_at).getTime()) / 1000 : null;
  const live = !!pose && pose.tracking_status === "valid" && ageS !== null && ageS < 5;

  return (
    <main className="mx-auto max-w-3xl p-4">
      <h1 className="text-xl font-semibold">Live position (HSS 349)</h1>
      <p className="mb-3 text-sm text-gray-600">
        {error
          ? `Error: ${error}`
          : !pose
          ? "Waiting for the phone to send a position..."
          : live
          ? `Live, last update ${ageS!.toFixed(1)} s ago`
          : `Not live: status ${pose.tracking_status}, last update ${ageS!.toFixed(0)} s ago`}
      </p>

      {view && (
        <svg
          viewBox={`0 0 ${view.w} ${view.h}`}
          className="w-full rounded border bg-white"
          style={{ aspectRatio: `${view.w} / ${view.h}` }}
          overflow="visible"
        >
          {segments.map((s) => {
            const a = byId.get(s.start_node_id);
            const b = byId.get(s.end_node_id);
            if (!a || !b) return null;
            return (
              <line
                key={s.segment_id}
                x1={a.position.x_m - view.minX} y1={view.maxZ - a.position.z_m}
                x2={b.position.x_m - view.minX} y2={view.maxZ - b.position.z_m}
                stroke="#9ca3af" strokeWidth={0.12}
              />
            );
          })}

          {nodes.map((n) => (
            <g key={n.node_id}>
              <circle cx={n.position.x_m - view.minX} cy={view.maxZ - n.position.z_m} r={0.2} fill="#374151" />
              <text x={n.position.x_m - view.minX + 0.3} y={view.maxZ - n.position.z_m - 0.3}
                fontSize={0.4} fill="#374151">{n.label}</text>
            </g>
          ))}

          {pose && (
            <g opacity={live ? 1 : 0.4}>
              {pose.heading_deg !== null && (
                <line
                  x1={pose.world_position.x_m - view.minX}
                  y1={view.maxZ - pose.world_position.z_m}
                  x2={pose.world_position.x_m - view.minX + 0.9 * Math.sin((pose.heading_deg * Math.PI) / 180)}
                  y2={view.maxZ - pose.world_position.z_m - 0.9 * Math.cos((pose.heading_deg * Math.PI) / 180)}
                  stroke="#2563eb" strokeWidth={0.1}
                />
              )}
              <circle
                cx={pose.world_position.x_m - view.minX}
                cy={view.maxZ - pose.world_position.z_m}
                r={0.3} fill="#2563eb"
              />
            </g>
          )}
        </svg>
      )}
    </main>
  );
}
