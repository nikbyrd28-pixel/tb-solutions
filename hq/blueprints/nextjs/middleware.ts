// ============================================================================
// TB Command — middleware.ts (project root)
// Session refresh + role-gated route protection via @supabase/ssr.
// Pairs with hq/multi-tenant-blueprint.sql (roles live in JWT app_metadata).
// ============================================================================
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export type Role = 'super_admin' | 'agency_admin' | 'team_member' | 'client_user';

const DASHBOARD_PREFIX = '/dashboard';
const ADMIN_PREFIX = '/dashboard/admin';
const CLIENT_PREFIX = '/dashboard/client';
const LOGIN_PATH = '/login';

/** Copy refreshed auth cookies onto any response we hand back (incl. redirects). */
function withCookies(target: NextResponse, source: NextResponse): NextResponse {
  source.cookies.getAll().forEach((c) => target.cookies.set(c));
  return target;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  // Response we mutate as Supabase rotates cookies during refresh.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() round-trips to Supabase Auth and VERIFIES the token —
  // never gate security on getSession() alone (it trusts the cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const inDashboard = pathname.startsWith(DASHBOARD_PREFIX);

  // 1) Unauthenticated → /login?next=<original>
  if (!user && inDashboard) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.search = '';
    url.searchParams.set('next', pathname + search);
    return withCookies(NextResponse.redirect(url), supabaseResponse);
  }

  // 2) Role gates. Roles come from VERIFIED JWT app_metadata (synced by the
  //    DB trigger in multi-tenant-blueprint.sql) — never from user_metadata,
  //    which end users can edit themselves.
  if (user && inDashboard) {
    const role = (user.app_metadata?.user_role ?? 'client_user') as Role;

    // /dashboard/admin/* — strictly super_admin or agency_admin
    if (pathname.startsWith(ADMIN_PREFIX) && role !== 'super_admin' && role !== 'agency_admin') {
      const url = request.nextUrl.clone();
      url.pathname = role === 'client_user' ? CLIENT_PREFIX : DASHBOARD_PREFIX;
      url.search = '';
      return withCookies(NextResponse.redirect(url), supabaseResponse);
    }

    // client_user is confined to /dashboard/client/*
    if (role === 'client_user' && !pathname.startsWith(CLIENT_PREFIX)) {
      const url = request.nextUrl.clone();
      url.pathname = CLIENT_PREFIX;
      url.search = '';
      return withCookies(NextResponse.redirect(url), supabaseResponse);
    }
  }

  // 3) Logged-in user visiting /login → send them home for their role.
  if (user && pathname === LOGIN_PATH) {
    const role = (user.app_metadata?.user_role ?? 'client_user') as Role;
    const url = request.nextUrl.clone();
    url.pathname = role === 'client_user' ? CLIENT_PREFIX : DASHBOARD_PREFIX;
    url.search = '';
    return withCookies(NextResponse.redirect(url), supabaseResponse);
  }

  return supabaseResponse;
}

export const config = {
  // Run everywhere except static assets so sessions stay fresh site-wide.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)'],
};
