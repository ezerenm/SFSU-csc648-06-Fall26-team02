import { createClient } from "@supabase/supabase-js";

// The publishable key is safe in the browser; database writes still require RLS.
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
