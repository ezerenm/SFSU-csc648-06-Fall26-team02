"use client";

import { useMemo, useState } from "react";
import LiveMap from "@/components/live/LiveMap";
import { useGraph } from "@/components/live/useGraph";
import { useLivePhones } from "@/components/live/useLivePhones";
import SegmentPanel from "@/components/operator/SegmentPanel";
import { listPhones } from "@/lib/spatial/livePhones";
import { placeNamer, placesFor } from "@/lib/spatial/places";

const MAP_VERSION_ID = "b2000000-0000-4000-8000-000000000001";

// Operator screen: watch every phone live and change path segments (R8.1, R8.2, R17.1, R19).
// No accounts yet (R1), so changes need the operator token. It lives only in this page's memory.
export default function OperatorPage() {
  const { graph, graphError, lastChange } = useGraph(MAP_VERSION_ID);
  const { phones, nowMs, liveError } = useLivePhones(MAP_VERSION_ID);
  const [token, setToken] = useState("");

  const nodeName = useMemo(
    () => placeNamer(placesFor(graph?.nodes ?? [], (graph?.destinations ?? []).filter((d) => d.is_active))),
    [graph],
  );
  const change = lastChange && lastChange.messages.length > 0 && nowMs - lastChange.at < 20000
    ? lastChange.messages.join(", ") : null;

  return (
    <div className="min-h-screen w-full bg-purple-950 text-white">
      <main className="mx-auto w-full max-w-6xl p-4">
        <h1 className="text-xl font-semibold">Operator</h1>
        <p className="text-xs text-purple-200">
          {graph ? graph.site.name + " . " + graph.map_version.version_label
            : graphError ? "Couldn't load the map: " + graphError : "Loading map..."}
        </p>
        {liveError && <p className="mt-2 text-sm text-red-300">Could not read live data: {liveError}</p>}
        {change && <p className="mt-2 rounded-md bg-yellow-400 px-3 py-2 text-sm font-semibold text-gray-900">Changed: {change}</p>}

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_22rem]">
          <section aria-label="Live map" className="min-w-0">
            {graph && <LiveMap graph={graph} phones={listPhones(phones)} nowMs={nowMs} />}
          </section>

          <section aria-label="Path segments" className="space-y-3">
            <label className="block text-sm">
              Operator token
              <input type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off"
                className="mt-1 w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white" />
            </label>
            <h2 className="font-semibold">Path segments</h2>
            {graph && <SegmentPanel segments={graph.segments} nodeName={nodeName} token={token} />}
          </section>
        </div>
      </main>
    </div>
  );
}
