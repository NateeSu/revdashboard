import { redirect } from "next/navigation";

import { RevenueTargetsManager } from "@/components/targets/revenue-targets-manager";
import { getCurrentUser } from "@/lib/auth/get-user";
import { isReadOnlyUser } from "@/lib/auth/roles";

function currentBangkokYear(): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      timeZone: "Asia/Bangkok",
    }).format(new Date())
  );
}

export default async function RevenueTargetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (isReadOnlyUser(user)) redirect("/dashboard");

  const params = await searchParams;
  const requestedYear = Number(Array.isArray(params.year) ? params.year[0] : params.year);
  const initialYear =
    Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2200
      ? requestedYear
      : currentBangkokYear();

  return <RevenueTargetsManager initialYear={initialYear} />;
}
