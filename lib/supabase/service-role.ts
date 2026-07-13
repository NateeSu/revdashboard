import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicEnv } from "@/lib/env/public";
import { getServerEnv } from "@/lib/env/server";
import type { Database } from "@/lib/supabase/database.types";

let serviceRoleClient: ReturnType<typeof createClient<Database>> | undefined;

export function getServiceRoleClient() {
  if (!serviceRoleClient) {
    const publicEnv = getPublicEnv();
    const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for this server-only operation.");
    }
    serviceRoleClient = createClient<Database>(
      publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );
  }
  return serviceRoleClient;
}
