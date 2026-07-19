// ============================================================================
// TB Command — app/(dashboard)/layout.tsx
// Server-side session fetch + role validation + secure context provisioning.
// Middleware already gates routes; this layout re-validates (defense in
// depth) and hands a SAFE, serializable context to client components.
// ============================================================================
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getAuthContext } from '@/lib/auth';
import { AuthProvider } from '@/components/auth-provider';

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const auth = await getAuthContext();

  // Never render the shell for an unauthenticated caller — even if
  // middleware were misconfigured, this server check still holds.
  if (!auth) {
    redirect('/login?next=/dashboard');
  }

  // A provisioned user must belong to a tenant (super_admin may float).
  if (auth.role !== 'super_admin' && !auth.organizationId) {
    redirect('/onboarding'); // profile exists but isn't linked to an org yet
  }

  return (
    <AuthProvider
      value={{
        userId: auth.userId,
        email: auth.email,
        role: auth.role,
        organizationId: auth.organizationId,
        clientId: auth.clientId,
        effectiveOrgId: auth.effectiveOrgId,
      }}
    >
      <div className="min-h-screen bg-[#05070f] text-slate-100">
        {/* Shell chrome (sidebar/topbar) renders per-role via useAuth() */}
        {children}
      </div>
    </AuthProvider>
  );
}
