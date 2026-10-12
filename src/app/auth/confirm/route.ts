import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Email-confirmation callback (Supabase OTP link lands here).
 * Exchanges the code for a session, then continues to `next`.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/verify-email?e=invalid_code`);
}
