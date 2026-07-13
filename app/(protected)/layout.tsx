import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import { getCurrentUser } from "@/lib/auth/get-user";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <AppShell userEmail={user.email ?? "เจ้าของระบบ"}>{children}</AppShell>;
}
