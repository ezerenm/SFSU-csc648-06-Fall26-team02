import { OUTCOMES, type AttemptFilters, type Outcome } from "./contracts";

export const PAGE_SIZE = 5;

export type AttemptForm = { test_point_id: string; outcome: string; q: string; page: number };

export const EMPTY_FORM: AttemptForm = { test_point_id: "", outcome: "", q: "", page: 0 };

/** Builds the query string for GET /api/localization-attempts. Empty filters are omitted. */
export function buildAttemptQuery(map_version_id: string, form: AttemptForm, pageSize = PAGE_SIZE): string {
  const filters: AttemptFilters = {
    map_version_id,
    limit: pageSize,
    offset: Math.max(0, form.page) * pageSize,
  };
  if (form.test_point_id) filters.test_point_id = form.test_point_id;
  if ((OUTCOMES as readonly string[]).includes(form.outcome)) filters.outcome = form.outcome as Outcome;
  const q = form.q.trim();
  // The API rejects "*" and strings over 120 characters; keep the form from producing a 400.
  if (q) filters.q = q.replaceAll("*", "").slice(0, 120);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return params.toString();
}
