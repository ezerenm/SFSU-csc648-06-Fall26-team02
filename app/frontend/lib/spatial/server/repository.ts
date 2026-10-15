import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AttemptFilters, GraphResponse, LocalizationAttempt } from "../contracts";
import { ApiError } from "./errors";

export interface SpatialRepository {
  graph(mapVersionId: string): Promise<GraphResponse | null>;
  attempts(filters: AttemptFilters): Promise<{ items: LocalizationAttempt[]; total: number }>;
}

const ATTEMPT_COLUMNS = "attempt_id,map_version_id,test_point_id,device_id,sdk_version,mode,data_origin,condition_label,camera_direction,started_at,ended_at,outcome,latency_ms,failure_reason,horizontal_error_m,error_is_valid,received_at,test_point:test_points!inner(label)";

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
  };
}

function isPublishableKey(key: string): boolean {
  if (key.startsWith("sb_publishable_")) return true;
  try {
    return JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role === "anon";
  } catch { return false; }
}

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
