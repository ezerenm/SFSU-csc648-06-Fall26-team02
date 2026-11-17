import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const RUN_ROLES = ["developer", "operator", "administrator"];
type AuthError = { reason: string; status: number };

export function runClient(request: Request): { db: SupabaseClient; token: string } | AuthError {
  const token = /^Bearer ([^\s]+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return { reason: "sign in required", status: 401 } as const;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { reason: "server not configured", status: 500 } as const;
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  return { db, token };
}

export async function runIdentity(request: Request): Promise<{ db: SupabaseClient; userId: string } | AuthError> {
  const client = runClient(request);
  if ("reason" in client) return client;
  const { data, error } = await client.db.auth.getUser(client.token);
  if (error || !data.user) return { reason: "sign in required", status: 401 } as const;
  return { db: client.db, userId: data.user.id };
}

export async function hasRunRole(
  db: SupabaseClient,
  siteId: string,
  userId: string,
) {
  const { data, error } = await db.from("site_memberships")
    .select("role").eq("site_id", siteId).eq("user_id", userId)
    .eq("is_active", true).maybeSingle();
  if (error) return { reason: "could not check site role", status: 500 } as const;
  if (!data || !RUN_ROLES.includes(data.role)) {
    return { reason: "developer, operator or administrator role required", status: 403 } as const;
  }
  return null;
}
