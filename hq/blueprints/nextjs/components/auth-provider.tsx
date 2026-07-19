// ============================================================================
// TB Command — components/auth-provider.tsx
// Client-side context for the server-provisioned auth snapshot.
// Contains NO tokens — only display/authorization hints. Real authorization
// happens server-side (middleware, layouts, server actions) and in RLS.
// ============================================================================
'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { AuthContext } from '@/lib/auth';

export type ClientAuth = Pick<
  AuthContext,
  'userId' | 'email' | 'role' | 'organizationId' | 'clientId' | 'effectiveOrgId'
>;

const Ctx = createContext<ClientAuth | null>(null);

export function AuthProvider({
  value,
  children,
}: {
  value: ClientAuth;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): ClientAuth {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
