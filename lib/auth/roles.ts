import type { User } from "@supabase/supabase-js";

export type AppRole = "owner" | "viewer";

export function getAppRole(user: Pick<User, "app_metadata">): AppRole {
  return user.app_metadata?.role === "viewer" ? "viewer" : "owner";
}

export function isReadOnlyUser(user: Pick<User, "app_metadata">) {
  return getAppRole(user) === "viewer";
}
