// ============================================================================
// TB Command — lib/auth.ts
// Server-side auth context: verified user + role + effective organization.
// ============================================================================
import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Role } from '../middleware';

export const ACTIVE_ORG_COOKIE = 'tb-active-org';

export interface AuthContext {
  userId: string;
  email: string;
  role: Role;
  /** Org from the verified JWT claim — the user's REAL tenant. */
  organizationId: string | null;
  /** client_user linkage for row-scoped reads. */
  clientId: string | null;
  /**
   * Org every query should use. Equals organizationId for everyone except a
   * super_admin with an active switcher cookie. See getEffectiveOrgId().
   */
  effectiveOrgId: string | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        // Server Components can't write cookies; middleware owns refresh.
        setAll: () => {},
      },
    },
  );
}

/**
 * IDOR-safe effective org derivation — the heart of the client switcher.
 * The override cookie is ONLY honored for a verified super_admin; for every
 * other role it is ignored no matter what the browser sends. And even if this
 * check were bypassed, RLS scopes non-super queries to their JWT org anyway
 * (defense in depth: app rule + database rule must both fail to leak data).
 */
export function getEffectiveOrgId(
  role: Role,
  ownOrgId: string | null,
  overrideCookie: string | undefined,
): string | null {
  if (role !== 'super_admin') return ownOrgId;
  if (overrideCookie && UUID_RE.test(overrideCookie)) return overrideCookie;
  return ownOrgId;
}

/** Fetch + verify the caller. Returns null when not authenticated. */
export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser(); // verified — not a raw cookie read

  if (!user) return null;

  const role = (user.app_metadata?.user_role ?? 'client_user') as Role;
  const organizationId = (user.app_metadata?.organization_id as string | undefined) ?? null;
  const clientId = (user.app_metadata?.client_id as string | undefined) ?? null;

  const cookieStore = await cookies();
  const override = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;

  return {
    userId: user.id,
    email: user.email ?? '',
    role,
    organizationId,
    clientId,
    effectiveOrgId: getEffectiveOrgId(role, organizationId, override),
  };
}
