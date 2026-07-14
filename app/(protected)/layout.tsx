import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import { getCurrentUser } from "@/lib/auth/get-user";
import { isReadOnlyUser } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const username =
    typeof user.user_metadata?.username === "string" ? user.user_metadata.username : null;

  return (
    <AppShell userLabel={username ?? user.email ?? "เจ้าของระบบ"} readOnly={isReadOnlyUser(user)}>
      {children}
    </AppShell>
  );
}
