import { NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { CRON_SECRET } = getServerEnv();
  if (!CRON_SECRET || request.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const timestamp = new Date().toISOString();
  const { error } = await getServiceRoleClient()
    .from("app_health")
    .update({ last_ping_at: timestamp })
    .eq("id", 1);
  if (error) {
    console.error({
      operation: "keep_alive",
      code: "KEEP_ALIVE_UPDATE_FAILED",
      message: error.message,
    });
    return NextResponse.json({ ok: false, error: "update_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, timestamp });
}
