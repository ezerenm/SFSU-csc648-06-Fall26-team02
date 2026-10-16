"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  OUTCOMES,
  type AttemptSearchResponse,
  type GraphResponse,
} from "@/lib/spatial/contracts";
import { buildAttemptQuery, EMPTY_FORM, PAGE_SIZE, type AttemptForm } from "@/lib/spatial/attemptQuery";

// M2: public maps are listed here by hand (there is no "list sites" endpoint yet).
const MAPS = [
  { id: "b2000000-0000-4000-8000-000000000001", label: "SFSU HSS 349 (real scan)" },
  { id: "20000000-0000-4000-8000-000000000001", label: "Synthetic demo (invented data)" },
] as const;
// Localization attempts are only public for the synthetic demo map.
const ATTEMPT_MAP = MAPS[1].id;

type Loaded<T> = { data: T | null; error: string | null };

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, cache: "no-store" });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
  return body as T;
}

const fmt = (n: number) => n.toFixed(2);
const label = (s: string) => s.replaceAll("_", " ");
const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400";
const td = "px-3 py-2 align-top text-sm";
const card = "rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950";
const field = "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

export default function HomeExplorer() {
  const [graphs, setGraphs] = useState<Record<string, Loaded<GraphResponse>>>({});
  const [mapId, setMapId] = useState<string>(MAPS[0].id);

  useEffect(() => {
    const ctl = new AbortController();
    for (const m of MAPS) {
      getJson<GraphResponse>(`/api/graph?map_version_id=${m.id}`, ctl.signal)
        .then((data) => setGraphs((g) => ({ ...g, [m.id]: { data, error: null } })))
        .catch((e: Error) => {
          if (e.name !== "AbortError") setGraphs((g) => ({ ...g, [m.id]: { data: null, error: e.message } }));
        });
    }
    return () => ctl.abort();
  }, []);

  const current = graphs[mapId];
  const graph = current?.data ?? null;
  const nodeLabel = (id: string) => graph?.nodes.find((n) => n.node_id === id)?.label ?? id.slice(0, 8);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">SpatialOS</h1>
        <p className="max-w-2xl text-zinc-600 dark:text-zinc-400">
          Test home page for the Milestone 2 vertical prototype. Everything below is read from the
          database through the app&apos;s API routes.
        </p>
        <nav aria-label="Pages" className="flex flex-wrap gap-4 text-sm font-medium">
          <Link className="underline underline-offset-2" href="/live">Live position</Link>
          <Link className="underline underline-offset-2" href="/viewer">3D viewer and routes</Link>
          <Link className="underline underline-offset-2" href="/about">About the team</Link>
        </nav>
      </header>

      <section aria-labelledby="places" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="places" className="text-xl font-semibold">Places and paths</h2>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Map</span>
            <select className={field} value={mapId} onChange={(e) => setMapId(e.target.value)}>
              {MAPS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>
        </div>

        {!current && <p role="status" className="text-sm text-zinc-500">Loading map data…</p>}
        {current?.error && <p role="alert" className="text-sm text-red-600">Could not load this map: {current.error}</p>}

        {graph && (
          <>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {graph.site.name} · {graph.map_version.version_label} · {graph.nodes.length} nodes ·{" "}
              {graph.segments.length} path segments · {graph.destinations.length} destinations
            </p>

            <div className={`${card} overflow-x-auto`}>
              <table className="w-full min-w-[32rem]">
                <caption className="px-3 pt-3 text-left text-sm font-semibold">Destinations</caption>
                <thead><tr><th className={th}>Name</th><th className={th}>Description</th><th className={th}>Node</th></tr></thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {graph.destinations.map((d) => (
                    <tr key={d.destination_id}>
                      <td className={`${td} font-medium`}>{d.name}</td>
                      <td className={td}>{d.description}</td>
                      <td className={td}>{nodeLabel(d.node_id)}</td>
                    </tr>
                  ))}
                  {graph.destinations.length === 0 && <tr><td className={td} colSpan={3}>No destinations.</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className={`${card} overflow-x-auto`}>
                <table className="w-full min-w-[20rem]">
                  <caption className="px-3 pt-3 text-left text-sm font-semibold">Nodes (meters)</caption>
                  <thead><tr><th className={th}>Label</th><th className={th}>x</th><th className={th}>z</th></tr></thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {graph.nodes.map((n) => (
                      <tr key={n.node_id}>
                        <td className={td}>{n.label}</td>
                        <td className={`${td} tabular-nums`}>{fmt(n.position.x_m)}</td>
                        <td className={`${td} tabular-nums`}>{fmt(n.position.z_m)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={`${card} overflow-x-auto`}>
                <table className="w-full min-w-[24rem]">
                  <caption className="px-3 pt-3 text-left text-sm font-semibold">Path segments</caption>
                  <thead><tr><th className={th}>Segment</th><th className={th}>Meters</th><th className={th}>Status</th></tr></thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {graph.segments.map((s) => (
                      <tr key={s.segment_id}>
                        <td className={td}>{s.label}</td>
                        <td className={`${td} tabular-nums`}>{s.distance_m.toFixed(2)}</td>
                        <td className={td}>{s.availability}, robots {s.robot_access}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>

      <AttemptSearch testPoints={graphs[ATTEMPT_MAP]?.data?.test_points ?? []} />
    </div>
  );
}

function AttemptSearch({ testPoints }: { testPoints: GraphResponse["test_points"] }) {
  const [draft, setDraft] = useState<AttemptForm>(EMPTY_FORM);
  const [applied, setApplied] = useState<AttemptForm>(EMPTY_FORM);
  const [result, setResult] = useState<Loaded<AttemptSearchResponse> | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    getJson<AttemptSearchResponse>(`/api/localization-attempts?${buildAttemptQuery(ATTEMPT_MAP, applied)}`, ctl.signal)
      .then((data) => setResult({ data, error: null }))
      .catch((e: Error) => { if (e.name !== "AbortError") setResult({ data: null, error: e.message }); });
    return () => ctl.abort();
  }, [applied]);

  const apply = useCallback((next: AttemptForm) => { setDraft(next); setApplied(next); setResult(null); }, []);
  const total = result?.data?.total ?? 0;
  const first = total === 0 ? 0 : applied.page * PAGE_SIZE + 1;
  const last = Math.min(total, (applied.page + 1) * PAGE_SIZE);

  return (
    <section aria-labelledby="attempts" className="space-y-4">
      <div>
        <h2 id="attempts" className="text-xl font-semibold">Search localization attempts</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Synthetic test records (invented for development; not real scan results).
        </p>
      </div>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => { e.preventDefault(); apply({ ...draft, page: 0 }); }}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Test point</span>
          <select className={field} value={draft.test_point_id}
            onChange={(e) => apply({ ...draft, test_point_id: e.target.value, page: 0 })}>
            <option value="">All</option>
            {testPoints.map((p) => <option key={p.test_point_id} value={p.test_point_id}>{p.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Outcome</span>
          <select className={field} value={draft.outcome}
            onChange={(e) => apply({ ...draft, outcome: e.target.value, page: 0 })}>
            <option value="">All</option>
            {OUTCOMES.map((o) => <option key={o} value={o}>{label(o)}</option>)}
          </select>
        </label>
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
          <span className="font-medium">Test point name contains</span>
          <input className={field} type="search" maxLength={120} placeholder="e.g. TP3"
            value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
        </label>
        <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">Search</button>
        <button type="button" className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
          onClick={() => apply(EMPTY_FORM)}>Reset</button>
      </form>

      <div aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-400">
        {!result && "Loading…"}
        {result?.error && <span role="alert" className="text-red-600">Could not load attempts: {result.error}</span>}
        {result?.data && (total === 0 ? "No results." : `Showing ${first}–${last} of ${total}`)}
      </div>

      {result?.data && total > 0 && (
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full min-w-[40rem]">
            <caption className="sr-only">Localization attempts</caption>
            <thead>
              <tr><th className={th}>Test point</th><th className={th}>Outcome</th><th className={th}>Latency</th>
                <th className={th}>Condition</th><th className={th}>Started</th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {result.data.items.map((a) => (
                <tr key={a.attempt_id}>
                  <td className={`${td} font-medium`}>{a.test_point.label}</td>
                  <td className={td}>
                    {label(a.outcome)}
                    {a.failure_reason && <span className="block text-xs text-zinc-500">{a.failure_reason}</span>}
                  </td>
                  <td className={`${td} tabular-nums`}>{a.latency_ms === null ? "—" : `${a.latency_ms} ms`}</td>
                  <td className={td}>{a.condition_label}, {a.camera_direction}</td>
                  <td className={td}>{new Date(a.started_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result?.data && total > PAGE_SIZE && (
        <div className="flex gap-3">
          <button type="button" className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-40 dark:border-zinc-700"
            disabled={applied.page === 0} onClick={() => apply({ ...applied, page: applied.page - 1 })}>Previous</button>
          <button type="button" className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-40 dark:border-zinc-700"
            disabled={last >= total} onClick={() => apply({ ...applied, page: applied.page + 1 })}>Next</button>
        </div>
      )}
    </section>
  );
}
