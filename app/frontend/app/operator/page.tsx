"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import LiveMap from "@/components/live/LiveMap";
import { useGraph } from "@/components/live/useGraph";
import { useLivePhones } from "@/components/live/useLivePhones";
import SegmentPanel from "@/components/operator/SegmentPanel";
import { listPhones } from "@/lib/spatial/livePhones";
import { placeNamer, placesFor } from "@/lib/spatial/places";
import { supabaseBrowser } from "@/lib/spatial/supabaseBrowser";

const MAP_VERSION_ID = "b2000000-0000-4000-8000-000000000001";

// Operator screen: watch every phone live and change path segments (R8.1, R8.2, R17.1, R19).
export default function OperatorPage() {
  const { graph, graphError, lastChange } = useGraph(MAP_VERSION_ID);
  const { phones, nowMs, liveError } = useLivePhones(MAP_VERSION_ID);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let active = true;
    void supabaseBrowser.auth.getSession().then(({ data }) => {
      if (active) { setRole(null); setSession(data.session); setAuthReady(true); }
    });
    const { data: { subscription } } = supabaseBrowser.auth.onAuthStateChange((_event, current) => {
      if (active) { setRole(null); setSession(current); setAuthReady(true); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session) return;
    let active = true;
    void supabaseBrowser.from("site_memberships")
      .select("role").eq("site_id", "b1000000-0000-4000-8000-000000000001")
      .eq("user_id", session.user.id).eq("is_active", true).maybeSingle()
      .then(({ data }) => { if (active) setRole(data?.role ?? null); });
    return () => { active = false; };
  }, [session]);

  const mayChangeSegments = role === "operator" || role === "administrator";

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
            {authReady && !session && <p><Link href="/account" className="underline">Sign in</Link> to change segments.</p>}
            {authReady && session && !mayChangeSegments
              && <p>Your account does not have an operator or administrator role for this site.</p>}
            <h2 className="font-semibold">Path segments</h2>
            {graph && <SegmentPanel segments={graph.segments} nodeName={nodeName}
              accessToken={mayChangeSegments ? session?.access_token ?? "" : ""} />}
          </section>
        </div>
      </main>
    </div>
  );
}
