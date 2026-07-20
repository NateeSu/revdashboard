import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicEnv } from "@/lib/env/public";
import { isReadOnlyUser } from "@/lib/auth/roles";
import { DEFAULT_AUTHENTICATED_PATH } from "@/lib/auth/routes";
import type { Database } from "@/lib/supabase/database.types";

const protectedPrefixes = ["/dashboard", "/reports", "/explorer", "/upload", "/imports", "/backup"];
const ownerOnlyPrefixes = ["/upload", "/imports", "/backup"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = getPublicEnv();
  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isProtected = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (!user && isProtected) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  const isOwnerOnly = ownerOnlyPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (user && isReadOnlyUser(user) && isOwnerOnly) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  if (user && pathname === "/login") {
    const landingUrl = request.nextUrl.clone();
    landingUrl.pathname = DEFAULT_AUTHENTICATED_PATH;
    landingUrl.search = "";
    return NextResponse.redirect(landingUrl);
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
