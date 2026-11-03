"use client";

import { useState } from "react";
import type { PathSegment } from "@/lib/spatial/contracts";
import { describeSegmentState, type SegmentAction } from "@/lib/spatial/segmentChange";

type Props = {
  segments: PathSegment[];
  nodeName: (nodeId: string) => string;
  token: string;
};

const button = "rounded-md px-2.5 py-1 text-xs font-semibold disabled:opacity-40";

// One row per path segment with the operator's buttons (R8.1, R8.2, R17.1).
// The list updates from the graph poll, so it shows what the database says, not what was clicked.
export default function SegmentPanel({ segments, nodeName, token }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function send(segment: PathSegment, action: SegmentAction) {
    setBusyId(segment.segment_id);
    setMessage(null);
    try {
      const response = await fetch("/api/segments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-operator-token": token },
        body: JSON.stringify({ segment_id: segment.segment_id, action }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.reason ?? `Request failed (${response.status})`);
      setMessage(body.changed ? `${segment.label} saved. Maps update within 3 s.` : `${segment.label} was already like that.`);
    } catch (error) {
      setMessage(`Could not change ${segment.label}: ${(error as Error).message}`);
    } finally {
      setBusyId(null);
    }
  }

  const sorted = [...segments].sort((a, b) => a.label.localeCompare(b.label));
  return (
    <div className="space-y-2">
      {message && <p className="rounded-md bg-white/10 px-3 py-2 text-sm" role="status">{message}</p>}
      {!token && <p className="text-sm text-yellow-300">Enter the operator token to make changes.</p>}
      <ul className="space-y-2">
        {sorted.map((segment) => {
          const busy = busyId === segment.segment_id || !token;
          const closed = segment.availability === "closed";
          const restricted = segment.robot_access === "restricted";
          return (
            <li key={segment.segment_id} className="rounded-md border border-white/15 bg-white/5 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">{segment.label}</span>
                <span className={"text-xs " + (closed ? "text-red-300" : restricted ? "text-pink-300" : "text-green-300")}>
                  {describeSegmentState(segment)}
                </span>
              </div>
              <p className="text-xs text-purple-200">
                {nodeName(segment.start_node_id)} to {nodeName(segment.end_node_id)} . {segment.distance_m.toFixed(1)} m
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {closed
                  ? <button type="button" disabled={busy} onClick={() => send(segment, "reopen")} className={button + " bg-green-500 text-gray-900"}>Reopen</button>
                  : <button type="button" disabled={busy} onClick={() => send(segment, "close")} className={button + " bg-red-500 text-white"}>Close</button>}
                {restricted
                  ? <button type="button" disabled={busy} onClick={() => send(segment, "allow_robots")} className={button + " bg-white/20 text-white"}>Allow robots</button>
                  : <button type="button" disabled={busy} onClick={() => send(segment, "humans_only")} className={button + " bg-pink-400 text-gray-900"}>Humans only</button>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
