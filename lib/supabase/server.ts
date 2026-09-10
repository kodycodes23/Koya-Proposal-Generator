import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
}

// Server-only client using the service-role key. Never import this from a
// client component — it must only run in route handlers / server components.
export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
});
