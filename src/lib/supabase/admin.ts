import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client. BYPASSES Row Level Security.
 *
 * Only ever imported by server code that guards access itself:
 *   - the Stripe webhook (verifies the event signature)
 *   - the member portal + checkout (verify the unit's portal token)
 *   - the cron route (verifies CRON_SECRET)
 *
 * Never import this from anything a browser renders.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
