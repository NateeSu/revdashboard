import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/get-user";
import { DEFAULT_AUTHENTICATED_PATH } from "@/lib/auth/routes";

export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? DEFAULT_AUTHENTICATED_PATH : "/login");
}
