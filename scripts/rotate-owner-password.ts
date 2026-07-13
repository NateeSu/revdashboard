import { createClient } from "@supabase/supabase-js";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  const url = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const publishableKey = requireEnv("SUPABASE_PUBLISHABLE_KEY");
  const userId = requireEnv("OWNER_USER_ID");
  const email = requireEnv("OWNER_EMAIL");
  const password = requireEnv("OWNER_NEW_PASSWORD");

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(userId, {
    password,
  });
  if (updateError) throw updateError;

  const publicClient = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signedIn, error: signInError } = await publicClient.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw signInError;
  await publicClient.auth.signOut();

  console.log(
    JSON.stringify({
      updated: updated.user?.id === userId,
      loginVerified: signedIn.user?.id === userId,
      userId,
    })
  );
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Owner password rotation failed");
  process.exitCode = 1;
});
