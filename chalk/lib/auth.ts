import { db } from "./db";
import { getAdminSession, getPlayerSession, getStaffSession } from "./session";
import type { Player, Staff, Venue } from "./types";

export async function currentPlayer(): Promise<{ player: Player; verified: boolean } | null> {
  const s = await getPlayerSession();
  if (!s?.pid) return null;
  const q = await db();
  const [p] = await q<Player[]>`select * from chalk_players where id = ${s.pid}`;
  if (!p) return null;
  return { player: p, verified: s.v === 1 && !!p.verified_at };
}

export async function requirePlayer() {
  const c = await currentPlayer();
  if (!c) throw new AuthError("Tell us who you are first");
  return c;
}

export async function currentStaff(): Promise<{ staff: Staff; venue: Venue } | null> {
  const s = await getStaffSession();
  if (!s?.sid) return null;
  const q = await db();
  const [row] = await q<(Staff & { venue: Venue })[]>`
    select st.*, row_to_json(v.*) as venue from chalk_staff st join chalk_venues v on v.id = st.venue_id
     where st.id = ${s.sid} and st.active`;
  if (!row) return null;
  const { venue, ...staff } = row;
  return { staff: staff as Staff, venue };
}

export async function requireStaff(roles?: Staff["role"][]) {
  const c = await currentStaff();
  if (!c) throw new AuthError("Log in");
  if (roles && !roles.includes(c.staff.role)) throw new AuthError("Not allowed", 403);
  return c;
}

export async function requireAdmin() {
  const a = await getAdminSession();
  if (!a?.admin) throw new AuthError("Admin login", 401);
  return true;
}

export class AuthError extends Error {
  status: number;
  constructor(m: string, status = 401) {
    super(m);
    this.status = status;
  }
}

// Wrap a route handler: errors become JSON, auth errors keep their status.
export function handler(fn: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      const err = e as Error & { status?: number };
      const status = err instanceof AuthError ? err.status : 400;
      if (status >= 500 || !(err instanceof AuthError)) console.error(`[${req.method} ${new URL(req.url).pathname}]`, err.message);
      return Response.json({ error: err.message || "Something went wrong" }, { status });
    }
  };
}
