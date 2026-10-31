// R16.1 AI health summary: turns R14 health results into facts for Gemini and checks its answer.
//
// Flow
//   1. buildHealthFacts()   health results -> small JSON of numbers the server computed
//   2. buildSummaryPrompt() facts -> prompt text (Gemini never sees attempts or camera data)
//   3. parseSummary()       Gemini's JSON -> observations + suggestions, keeping only
//                           sentences whose numbers all appear in the facts
//
// Why the number check: the doc (Data Definitions 1.15) says generated numbers that do not
// match the snapshot are rejected. Gemini explains the numbers; it must never invent them.
//
// Pure functions: no network, no DB. The Gemini call lives in server/gemini.ts.
//
// Author: Sumit, Oct 31 2026

import { HEALTH_RULES, type HealthResult, type HealthStatus } from "./health";

/** Bump when the prompt wording changes, so stored summaries can be traced to a prompt. */
export const PROMPT_VERSION = "health-summary-v1";

const MAX_OBSERVATIONS = 6;
const MAX_SUGGESTIONS = 3;
const MAX_TEXT_LENGTH = 300;

/** One test point as GET /api/health returns it. */
export type HealthPointView = {
  test_point_id: string;
  label: string;
  is_synthetic: boolean;
  results: HealthResult[];
};

/** One row of facts: a test point on one device, or a point with no attempts yet. */
export type HealthFactRow = {
  test_point: string;
  device: string | null;
  status: HealthStatus;
  reason: string;
  attempts: number;
  successes: number;
  success_percent: number | null;
  median_seconds_to_localize: number | null;
  verified_accuracy_samples: number;
  median_error_m: number | null;
};

export type HealthFacts = {
  mode: "live" | "simulation";
  rules: typeof HEALTH_RULES;
  totals: { test_points: number } & Record<HealthStatus, number>;
  rows: HealthFactRow[];
};

export type SummaryObservation = { text: string; test_points: string[] };
export type ParsedSummary = {
  observations: SummaryObservation[];
  suggestions: string[];
  rejected_count: number; // items dropped because a number or label was not in the facts
};

/** Rounds to a fixed number of decimals, e.g. round(3.46, 1) = 3.5. */
function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Builds the facts Gemini is allowed to talk about.
 * @param points test points as GET /api/health returns them
 * @param mode which attempts the health used
 * @returns rounded, human-friendly numbers plus color totals
 */
export function buildHealthFacts(points: HealthPointView[], mode: "live" | "simulation"): HealthFacts {
  const rows: HealthFactRow[] = [];
  for (const point of points) {
    if (point.results.length === 0) {
      rows.push({
        test_point: point.label, device: null, status: "gray", reason: "No attempts yet",
        attempts: 0, successes: 0, success_percent: null, median_seconds_to_localize: null,
        verified_accuracy_samples: 0, median_error_m: null,
      });
      continue;
    }
    for (const result of point.results) {
      rows.push({
        test_point: point.label,
        device: result.device_id,
        status: result.health_status,
        reason: result.reason,
        attempts: result.attempt_count,
        successes: result.success_count,
        success_percent: result.success_rate === null ? null : round(result.success_rate * 100, 0),
        median_seconds_to_localize: result.median_latency_ms === null ? null : round(result.median_latency_ms / 1000, 1),
        verified_accuracy_samples: result.valid_error_count,
        median_error_m: result.median_horizontal_error_m === null ? null : round(result.median_horizontal_error_m, 2),
      });
    }
  }
  const totals = { test_points: points.length, gray: 0, red: 0, yellow: 0, green: 0 };
  for (const row of rows) totals[row.status] += 1;
  return { mode, rules: HEALTH_RULES, totals, rows };
}

/**
 * Writes the prompt. Gemini only gets the facts JSON, never raw attempts.
 * @param facts output of buildHealthFacts()
 * @returns prompt text that asks for JSON with observations and suggestions
 */
export function buildSummaryPrompt(facts: HealthFacts): string {
  return [
    "You explain indoor localization health to a facilities operator running a campus robot pilot.",
    "Each test point is a spot where a phone tried to find its position (VPS localization).",
    "Colors: green = reliable, yellow = works but below target, red = unreliable, gray = not enough data yet.",
    "",
    "Rules:",
    "- Use ONLY numbers that appear in FACTS. Do not calculate new numbers or percentages.",
    "- Refer to test points by their exact test_point name from FACTS.",
    "- Observations state what the facts show. Suggestions are next steps, clearly separate.",
    "- Plain words, no jargon. Each item is one sentence under 40 words.",
    `- At most ${MAX_OBSERVATIONS} observations and ${MAX_SUGGESTIONS} suggestions.`,
    facts.mode === "simulation"
      ? "- This is SIMULATED test data. Say so in the first observation."
      : "- This is live data from real phones.",
    "",
    'Reply as JSON: {"observations":[{"text":"...","test_points":["..."]}],"suggestions":["..."]}',
    "",
    "FACTS:",
    JSON.stringify(facts),
  ].join("\n");
}

/** Every number found anywhere in the facts, so the check can accept the same values. */
function factNumbers(facts: HealthFacts): number[] {
  const numbers: number[] = [];
  const walk = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      numbers.push(value);
      if (value > 0 && value <= 1) numbers.push(value * 100); // 0.6 may be written as 60%
    } else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk({ rules: facts.rules, totals: facts.totals, rows: facts.rows.map((row) => ({ ...row, reason: null })) });
  return numbers;
}

/**
 * Finds numbers in a sentence that are not in the facts.
 * Test point and device names are removed first, so "TP1" or "iphone-15" never count as numbers.
 * A number matches if a fact rounds to it at the same number of decimals ("86" matches 85.7).
 * @param text one observation or suggestion from Gemini
 * @param facts the facts the prompt used
 * @returns the unsupported numbers as written, empty when the sentence is safe
 */
export function unsupportedNumbers(text: string, facts: HealthFacts): string[] {
  const names = new Set<string>();
  for (const row of facts.rows) {
    names.add(row.test_point);
    if (row.device) names.add(row.device);
  }
  let cleaned = text;
  for (const name of [...names].sort((a, b) => b.length - a.length)) cleaned = cleaned.split(name).join(" ");

  const allowed = factNumbers(facts);
  const found = cleaned.match(/\d+(?:\.\d+)?/g) ?? [];
  return found.filter((written) => {
    const value = Number(written);
    const decimals = written.includes(".") ? written.split(".")[1].length : 0;
    return !allowed.some((fact) => round(fact, decimals) === value);
  });
}

/**
 * Reads Gemini's JSON answer and keeps only safe items.
 * @param raw the text Gemini returned (expected to be JSON)
 * @param facts the facts the prompt used
 * @returns observations and suggestions that passed the checks, plus how many were dropped
 * @throws Error when the answer is not the expected JSON shape at all
 */
export function parseSummary(raw: string, facts: HealthFacts): ParsedSummary {
  const data = JSON.parse(raw) as { observations?: unknown; suggestions?: unknown };
  if (!Array.isArray(data.observations) || !Array.isArray(data.suggestions)) {
    throw new Error("Summary JSON must have observations and suggestions arrays");
  }
  const labels = new Set(facts.rows.map((row) => row.test_point));
  const isSafeText = (text: unknown): text is string =>
    typeof text === "string" && text.trim().length > 0 && text.length <= MAX_TEXT_LENGTH
    && unsupportedNumbers(text, facts).length === 0;

  let rejected = 0;
  const observations: SummaryObservation[] = [];
  for (const item of data.observations.slice(0, MAX_OBSERVATIONS)) {
    const text = (item as { text?: unknown })?.text;
    const points = (item as { test_points?: unknown })?.test_points;
    const pointList = Array.isArray(points) ? points.filter((p): p is string => typeof p === "string") : [];
    if (isSafeText(text) && pointList.every((label) => labels.has(label))) {
      observations.push({ text: text.trim(), test_points: pointList });
    } else rejected += 1;
  }
  const suggestions: string[] = [];
  for (const item of data.suggestions.slice(0, MAX_SUGGESTIONS)) {
    if (isSafeText(item)) suggestions.push(item.trim());
    else rejected += 1;
  }
  rejected += Math.max(0, data.observations.length - MAX_OBSERVATIONS) + Math.max(0, data.suggestions.length - MAX_SUGGESTIONS);
  return { observations, suggestions, rejected_count: rejected };
}
