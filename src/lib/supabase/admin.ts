import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — SERVER ONLY.
 *
 * `import "server-only"` makes any accidental client-bundle import a build
 * error, mechanically enforcing AD-14's secret-boundary rule and the
 * import-lint requirement from DATABASE_DESIGN.md §6.
 *
 * Bypasses RLS by design. Every privileged mutation performed through this
 * client MUST be validated server-side and recorded in `admin_actions`
 * (DATABASE_DESIGN.md §3.18, AD-05).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY (server-only env var). This client must never run in the browser.",
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
