// ============================================================================
// TB Command — app/actions/switch-org.ts
// Server action: super_admin-only organization switcher (IDOR-safe).
// ============================================================================
'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createSupabaseServer, ACTIVE_ORG_COOKIE } from '@/lib/auth';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SwitchOrgResult {
  ok: boolean;
  error?: string;
}

export async function switchOrganization(orgId: string): Promise<SwitchOrgResult> {
  // 1) Input shape gate — reject anything that isn't a UUID outright.
  if (!UUID_RE.test(orgId)) return { ok: false, error: 'Invalid organization id.' };

  const supabase = await createSupabaseServer();

  // 2) VERIFIED identity + role from the JWT — not from anything the client
  //    posted. A client_user calling this action gets refused here.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated.' };

  const role = user.app_metadata?.user_role as string | undefined;
  if (role !== 'super_admin') return { ok: false, error: 'Not authorized.' };

  // 3) Existence check under the caller's own RLS. super_admin's policies
  //    allow cross-tenant SELECT, so this succeeds only for real orgs.
  const { data: org, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', orgId)
    .maybeSingle();
  if (error || !org) return { ok: false, error: 'Organization not found.' };

  // 4) httpOnly advisory cookie. Even if a non-super forges this cookie in
  //    the browser, getEffectiveOrgId() ignores it for their role AND their
  //    RLS policies scope every query to their own JWT org — two independent
  //    walls have to fall before any cross-tenant read could happen.
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, orgId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8, // one workday
  });

  revalidatePath('/dashboard');
  return { ok: true };
}

export async function clearOrganizationOverride(): Promise<SwitchOrgResult> {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_ORG_COOKIE);
  revalidatePath('/dashboard');
  return { ok: true };
}
