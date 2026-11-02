"use client";

// Localization health (R14) per test point, plus the Gemini summary (R16.1) on request.
// Reads GET /api/health and POST /api/health/summary. Author: Sumit, Oct 31 2026

import { useEffect, useState } from "react";
import type { HealthStatus } from "@/lib/spatial/health";
import type { HealthPointView } from "@/lib/spatial/healthSummary";

// Same hand-listed maps as the home page. Real maps use live attempts, the demo map uses simulated ones.
const MAPS = [
  { id: "b2000000-0000-4000-8000-000000000001", label: "SFSU HSS 349 (real scan)", mode: "live" },
  { id: "20000000-0000-4000-8000-000000000001", label: "Synthetic demo (invented data)", mode: "simulation" },
] as const;

const DOT: Record<HealthStatus, string> = {
  green: "bg-emerald-500", yellow: "bg-amber-400", red: "bg-red-500", gray: "bg-zinc-400",
};
const SUMMARY_PROBLEM: Record<string, string> = {
  unavailable: "AI summary is not set up on this server (no Gemini key).",
  timed_out: "Gemini took longer than 15 seconds. Try again.",
  failed: "Gemini's answer could not be verified, so nothing is shown. Try again.",
};
const card = "rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950";

type Summary = {
  status: string;
  model_version: string | null;
  observations: { text: string }[];
  suggestions: string[];
  rejected_count: number;
  message?: string; // only for "error": the server's or browser's reason
};

/** A summary with nothing to show, used when the request itself fails. */
const failedSummary = (message: string): Summary =>
  ({ status: "error", message, model_version: null, observations: [], suggestions: [], rejected_count: 0 });

export default function HealthPanel() {
  const [map, setMap] = useState<(typeof MAPS)[number]>(MAPS[1]);
  const [points, setPoints] = useState<HealthPointView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [asking, setAsking] = useState(false);
  const query = `map_version_id=${map.id}&mode=${map.mode}`;

  useEffect(() => {
    const ctl = new AbortController();
    fetch(`/api/health?${query}`, { signal: ctl.signal, cache: "no-store" })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
        setPoints(body.points);
      })
      .catch((e: Error) => { if (e.name !== "AbortError") setError(e.message); });
    return () => ctl.abort();
  }, [query]);

  /** Clears the old map's data here (not in the effect), then the effect loads the new map. */
  function selectMap(id: string) {
    setPoints(null); setError(null); setSummary(null);
    setMap(MAPS.find((m) => m.id === id) ?? MAPS[1]);
  }

  async function explain() {
    setAsking(true); setSummary(null);
    try {
      const res = await fetch(`/api/health/summary?${query}`, { method: "POST" });
      const body = await res.json().catch(() => null);
      // Errors (400, 404, 503) come back as { error: { message } } with no status.
      if (!res.ok || typeof body?.status !== "string") {
        setSummary(failedSummary(body?.error?.message ?? `Request failed (${res.status}).`));
      } else setSummary(body);
    } catch {
      setSummary(failedSummary("Could not reach the server. Check your connection and try again."));
    } finally { setAsking(false); }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Localization health</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          How reliably phones find their position at each test point. Gray means not enough data yet.
        </p>
      </header>

      <select className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        value={map.id} onChange={(e) => selectMap(e.target.value)}>
        {MAPS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
      </select>
      {map.mode === "simulation" && <p className="text-sm font-medium text-amber-600">Simulated test data</p>}

      {error && <p className="text-red-600">{error}</p>}
      {!points && !error && <p className="text-zinc-500">Loading…</p>}
      {points?.length === 0 && <p className="text-zinc-500">No test points on this map yet.</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {points?.map((point) => {
          const results = point.results.length ? point.results : [null];
          return (
            <div key={point.test_point_id} className={card}>
              <h2 className="font-semibold">{point.label}</h2>
              {results.map((r, i) => (
                <div key={r?.device_id ?? i} className="mt-2 space-y-1 text-sm">
                  <p className="flex items-center gap-2">
                    <span className={`h-3 w-3 rounded-full ${DOT[r?.health_status ?? "gray"]}`} aria-hidden />
                    <span className="font-medium capitalize">{r?.health_status ?? "gray"}</span>
                    {r && <span className="text-zinc-500">· {r.device_id}</span>}
                  </p>
                  <p className="text-zinc-600 dark:text-zinc-400">{r?.reason ?? "No attempts yet"}</p>
                  {r && (
                    <p className="text-zinc-500">
                      {r.success_count}/{r.attempt_count} succeeded
                      {r.median_latency_ms !== null && ` · ${(r.median_latency_ms / 1000).toFixed(1)} s median`}
                      {` · ${r.valid_error_count} verified accuracy samples`}
                    </p>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {points && points.length > 0 && (
        <section className={`${card} space-y-3`}>
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-semibold">AI summary</h2>
            <button onClick={explain} disabled={asking}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
              {asking ? "Asking Gemini…" : "Explain with AI"}
            </button>
          </div>
          {summary && summary.status !== "completed" && (
            <p className="text-amber-700">{SUMMARY_PROBLEM[summary.status] ?? summary.message ?? "Something went wrong. Try again."}</p>
          )}
          {summary?.status === "completed" && (
            <>
              <ul className="list-disc space-y-1 pl-5">{summary.observations.map((o, i) => <li key={i}>{o.text}</li>)}</ul>
              {summary.suggestions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold">Suggested next steps</h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm">{summary.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
              <p className="text-xs text-zinc-500">
                Written by {summary.model_version}. Every number was checked against the data above
                {summary.rejected_count > 0 && `; ${summary.rejected_count} unverified sentence(s) removed`}.
              </p>
            </>
          )}
        </section>
      )}
    </div>
  );
}
