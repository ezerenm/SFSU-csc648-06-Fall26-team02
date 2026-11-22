import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AttemptFilters, GraphResponse, LocalizationAttempt } from "../contracts";
import type { HealthAttempt, HealthMode } from "../health";
import { ApiError } from "./errors";

import { FAILURE_TYPES, STATUS_LOOKBACK_SECONDS, dayRange, trackingStatusBefore, type FailureFilters, type FailureRow, type StatusSample } from "../failures";

export interface SpatialRepository {
  /** The navigation graph of one map version, or null when the map is not visible. RLS decides what is visible. */
  graph(mapVersionId: string): Promise<GraphResponse | null>;
  /** R15.1 One page of localization attempts that match the filters, with the total count. */
  attempts(filters: AttemptFilters): Promise<{ items: LocalizationAttempt[]; total: number }>;
  /** Completed attempts of one mode on one map, for health (R14). RLS decides what is visible. */
  healthAttempts(mapVersionId: string, mode: HealthMode): Promise<HealthAttempt[]>;

  // R12.4 
  failures(filters: FailureFilters): Promise<{ items: FailureRow[]; total: number}>;
}

const ATTEMPT_COLUMNS = "attempt_id,map_version_id,test_point_id,device_id,sdk_version,mode,data_origin,condition_label,camera_direction,started_at,ended_at,outcome,latency_ms,failure_reason,horizontal_error_m,error_is_valid,received_at,test_point:test_points!inner(label)";

const HEALTH_COLUMNS = "attempt_id,test_point_id,map_version_id,device_id,mode,outcome,latency_ms,horizontal_error_m,error_is_valid";
/** PostgREST's default max rows. Plenty for one map in this course; raise with a DB-side aggregate if it ever binds. */
export const HEALTH_ATTEMPT_LIMIT = 1000;

const FAILURE_COLUMNS = "attempt_id,outcome,failure_reason,test_point_id,device_id,started_at,ended_at,mode,data_origin,test_point:test_points!inner(label)";
// the columns we need and the test point's label from the test_points table

type FailureDatabaseRow = {

  attempt_id: string; outcome: string; failure_reason: string | null; test_point_id: string; device_id: string;
  // the columns and test point's label from the test_points table

  started_at: string; ended_at: string | null; mode: string; data_origin: string; test_point: { label: string };
}

function databaseUnavailable(): never {
  throw new ApiError(503, "DATABASE_UNAVAILABLE", "Demo data is temporarily unavailable. Please try again.");
}

/** Uses only the publishable/anon key, so both API requests and direct REST reads obey RLS. */
export function supabaseRepository(client: SupabaseClient): SpatialRepository {
  return {
    async graph(mapVersionId) {
      try {
        const { data, error } = await client.rpc("m2_get_graph", { requested_map_version_id: mapVersionId })
          .abortSignal(AbortSignal.timeout(5000));
        if (error) databaseUnavailable();
        return data as GraphResponse | null;
      } catch { databaseUnavailable(); }
    },
    async attempts(filters) {
      try {
        let request = client.from("localization_attempts")
          .select(ATTEMPT_COLUMNS, { count: "exact" })
          .eq("map_version_id", filters.map_version_id)
          .eq("data_origin", "synthetic")
          .order("started_at", { ascending: false })
          .order("attempt_id", { ascending: true });
        if (filters.test_point_id) request = request.eq("test_point_id", filters.test_point_id);
        if (filters.outcome) request = request.eq("outcome", filters.outcome);
        if (filters.q) {
          const literal = filters.q.replace(/[\\%_]/g, "\\$&");
          request = request.ilike("test_point.label", `%${literal}%`);
        }
        const { data, error, count, status } = await request.range(filters.offset, filters.offset + filters.limit - 1)
          .abortSignal(AbortSignal.timeout(5000));
        // PostgREST reports out-of-range pages as 416 when exact count is requested.
        // Recount from the first page, keeping every filter, then return a clean empty page.
        if (status === 416 && error?.code === "PGRST103" && filters.offset > 0) {
          const first = await request.range(0, 0).abortSignal(AbortSignal.timeout(5000));
          if (first.error || first.count === null) databaseUnavailable();
          return { items: [], total: first.count };
        }
        if (error || count === null) databaseUnavailable();
        return { items: (data ?? []) as unknown as LocalizationAttempt[], total: count };
      } catch { databaseUnavailable(); }
    },
    async healthAttempts(mapVersionId, mode) {
      try {
        const { data, error } = await client.from("localization_attempts")
          .select(HEALTH_COLUMNS)
          .eq("map_version_id", mapVersionId)
          .eq("mode", mode)
          .neq("outcome", "in_progress")
          .order("started_at", { ascending: false })
          .order("attempt_id", { ascending: true })
          .range(0, HEALTH_ATTEMPT_LIMIT - 1)
          .abortSignal(AbortSignal.timeout(5000));
        if (error) databaseUnavailable();
        return (data ?? []) as HealthAttempt[];
      } catch { databaseUnavailable(); }
    },
    async failures(filters) {

      try {

        let request = client.from("localization_attempts")

        .select(FAILURE_COLUMNS, { count: "exact" })
        .eq("map_version_id", filters.map_version_id)
        .order("started_at", { ascending: false })
        .order("attempt_id", { ascending: true })

        // newest first

        if (filters.failure_type) request = request.eq("outcome", filters.failure_type);
        else request = request.in("outcome", FAILURE_TYPES);
        // one type or all 6 failure types

        if (filters.test_point_id) request = request.eq("test_point_id", filters.test_point_id);
        if (filters.device_id) request = request.eq("device_id", filters.device_id);
        
        if (filters.date) {

          const range = dayRange(filters.date)!;

          request = request.gte("started_at", range.startIso).lt("started_at", range.endIso);
          // midnight to midnight pst
        }

        const { data, error, count, status } = await request.range(filters.offset, filters.offset + filters.limit - 1)
          .abortSignal(AbortSignal.timeout(5000));

        if (status === 416 && error?.code === "PGRST103" && filters.offset > 0) {
          // 416 is for when the page doesn't exist

          const firstPage = await request.range(0, 0).abortSignal(AbortSignal.timeout(5000));
          // ask for just the first row to get the real total

          if (firstPage.error || firstPage.count === null) databaseUnavailable();

          return { items: [], total: firstPage.count };
          // empty page but the operator will still see how many failures there are
          
        }

        if (error || count === null) databaseUnavailable();

        const rows = (data ?? []) as unknown as FailureDatabaseRow[];
        if (rows.length === 0) return { items: [], total: count };

        // here?
        async function statusBefore(row: FailureDatabaseRow): Promise<string | null> {
          // the phones newesst status in the 60 seconds befoer this one fialure

          const lookbackStart = new Date(new Date(row.started_at).getTime() - STATUS_LOOKBACK_SECONDS * 1000).toISOString();
          // one minute before the failure started

          const result = await client.from("pose_samples")
          .select("device_id,tracking_status,captured_at")
          .eq("map_version_id", filters.map_version_id)
          .eq("device_id", row.device_id)
          .gte("captured_at", lookbackStart)
          .lte("captured_at", row.started_at)
          .order("captured_at", { ascending: false })
          .limit(1)
          .abortSignal(AbortSignal.timeout(5000));
          // only this phone, only this minute, the newest first, so just 1 row

          if (result.error) return null;
          // if this one read fails, only this one row's status is empty

          return trackingStatusBefore((result.data ?? []) as StatusSample[], row.device_id, row.started_at);
          // same helper as before
          // given the rigt samples 

        }

        const statusRequests: Promise<string | null>[] = [];
        // one status ;pplup per failure on this page 

        for (const row of rows) {

          statusRequests.push(statusBefore(row));
          // start every lookup now, without waiting

        }

        const statuses = await Promise.all(statusRequests);
        // wait for all of them together

        const items: FailureRow[] = [];

        for (let index = 0; index < rows.length; index++) {

          const row = rows[index];

          items.push({

            attempt_id: row.attempt_id,
            failure_type: row.outcome,
            failure_reason: row.failure_reason,
            test_point_id: row.test_point_id,
            test_point_label: row.test_point.label,
            device_id: row.device_id,
            started_at: row.started_at,
            ended_at: row.ended_at,
            mode: row.mode,
            data_origin: row.data_origin,
            tracking_status_before: statuses[index],

          });

        }

        return { items, total: count };
        
      } catch (error) {

        if (error instanceof ApiError) throw error;
        databaseUnavailable();
      }
    },
  };
}

function isPublishableKey(key: string): boolean {
  if (key.startsWith("sb_publishable_")) return true;
  try {
    return JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role === "anon";
  } catch { return false; }
}

/** The Supabase repository used by the API routes; 503 when the database connection is not configured. */
export function createSpatialRepository(): SpatialRepository {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !isPublishableKey(key)) {
    throw new ApiError(503, "CONFIGURATION_ERROR", "The demo database connection is not configured.");
  }
  try {
    return supabaseRepository(createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
    }));
  } catch {
    throw new ApiError(503, "CONFIGURATION_ERROR", "The demo database connection is not configured.");
  }
}
