import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client — anon key only (AD-14 environment contract).
 * All authorization is enforced by RLS server-side (AD-05); this client
 * carries no privileged capabilities.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill from your Supabase project.",
    );
  }

  return createBrowserClient(url, anonKey);
}
