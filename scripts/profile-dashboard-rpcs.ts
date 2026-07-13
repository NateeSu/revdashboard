import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const email = process.env.SUPABASE_TEST_EMAIL;
const password = process.env.SUPABASE_TEST_PASSWORD;
const filters = JSON.parse(process.env.SUPABASE_TEST_FILTERS ?? "{}") as Record<string, string[]>;

if (!url || !key || !email || !password) {
  throw new Error(
    "Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_TEST_EMAIL, and SUPABASE_TEST_PASSWORD"
  );
}

async function main() {
  const supabase = createClient(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: authError } = await supabase.auth.signInWithPassword({
    email: email!,
    password: password!,
  });
  if (authError) throw authError;

  const calls = [
    [
      "kpis",
      () => supabase.rpc("get_dashboard_kpis", { p_year: 2026, p_month: 5, p_filters: filters }),
    ],
    [
      "trend",
      () => supabase.rpc("get_monthly_trend", { p_year: 2026, p_month: 5, p_filters: filters }),
    ],
    ...["unit_name", "business_group", "service_group", "service_name"].map(
      (groupBy) =>
        [
          `group:${groupBy}`,
          () =>
            supabase.rpc("get_grouped_revenue", {
              p_year: 2026,
              p_month: 5,
              p_group_by: groupBy,
              p_filters: filters,
              p_limit: 20,
            }),
        ] as const
    ),
  ] as const;

  for (const [name, call] of calls) {
    const start = performance.now();
    const { data, error } = await call();
    const elapsed = Math.round(performance.now() - start);
    const count = Array.isArray(data) ? data.length : data ? 1 : 0;
    console.log(
      `${name.padEnd(24)} ${elapsed.toString().padStart(6)} ms  ${error?.message ?? `${count} result(s)`}`
    );
  }

  await supabase.auth.signOut({ scope: "local" });
}

void main();
