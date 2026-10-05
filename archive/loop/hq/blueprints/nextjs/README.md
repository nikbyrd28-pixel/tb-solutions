# TB Command — Next.js auth blueprint (Phase 4)

Production-grade auth flow and route protection for the future Next.js
version of TB Command. Pairs with `../../multi-tenant-blueprint.sql` — the
roles these files read (`user_role`, `organization_id`, `client_id` in JWT
`app_metadata`) are stamped by that schema's claim-sync trigger.

> ⚠️ The live tbsol.net app today is static HTML — these files are the
> migration target, not something running in production right now.

## Files
```
middleware.ts                     session refresh + role-gated routing
lib/auth.ts                       verified server-side auth context
app/(dashboard)/layout.tsx        server layout: validate + provision context
components/auth-provider.tsx      client context (no tokens, hints only)
app/actions/switch-org.ts         super_admin org switcher (IDOR-safe)
```

## Env vars
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Route rules enforced
| Path | Allowed |
|---|---|
| `/dashboard/**` (any) | any authenticated user |
| `/dashboard/admin/**` | `super_admin`, `agency_admin` only |
| `/dashboard/client/**` | everyone; and `client_user` is *confined* here |
| `/login` while signed in | redirected to their role home |

## Why the client switcher is IDOR-safe

The active-organization override lives in an `httpOnly` cookie, but the
cookie is **advisory, never authoritative**. Three independent layers:

1. **Write gate** — only the `switchOrganization` server action sets it, and
   the action re-verifies the caller's JWT (`supabase.auth.getUser()`) and
   refuses any role except `super_admin`, then confirms the target org exists.
2. **Read gate** — `getEffectiveOrgId()` ignores the cookie entirely unless
   the *verified* role is `super_admin`. A client_user hand-crafting the
   cookie changes nothing: their effective org is always their JWT claim.
3. **Database wall** — even if both app layers were bypassed, RLS policies
   scope every non-super query to `get_auth_org_id()` from the signed JWT.
   The cookie is never visible to Postgres at all.

An attacker would need a forged *signed JWT* claiming `super_admin` — i.e.,
Supabase's signing key — not just a cookie edit. That is the correct trust
anchor.

## Notes
- Security gates always call `supabase.auth.getUser()` (server-verified),
  never `getSession()` alone, and read roles from `app_metadata`
  (server-controlled) never `user_metadata` (user-editable).
- Role changes take effect on token refresh; force sign-out for instant
  demotion.
