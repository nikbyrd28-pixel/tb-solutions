import postgres from "postgres";
import { env } from "./env";

// Postgres over the Supabase pooler (transaction mode). Two candidate hosts because Supabase
// splits a region across pooler clusters (aws-0 / aws-1); we use whichever one answers.

export type Client = postgres.Sql<Record<string, never>>;
export type Tx = postgres.TransactionSql<Record<string, never>>;
// Anything that can run a tagged query: the client or a transaction handle.
export type Q = Client | Tx;

function make(url: string): Client {
  const local = /@(127\.0\.0\.1|localhost)[:/]/.test(url);
  return postgres(url, {
    ssl: local ? false : "require",
    prepare: false,
    max: 4,
    idle_timeout: 20,
    connect_timeout: 10,
    transform: { undefined: null },
  });
}

let resolved: Promise<Client> | null = null;

async function resolve(): Promise<Client> {
  const candidates = [env.db.url, env.db.altUrl].filter(Boolean);
  if (!candidates.length) throw new Error("DATABASE_URL is not set");
  let lastErr: unknown;
  for (const url of candidates) {
    const c = make(url);
    try {
      await c`select 1`;
      return c;
    } catch (e) {
      lastErr = e;
      await c.end({ timeout: 1 }).catch(() => {});
    }
  }
  throw lastErr;
}

export function db(): Promise<Client> {
  if (!resolved) {
    resolved = resolve().catch((e) => {
      resolved = null;
      throw e;
    });
  }
  return resolved;
}

export async function tx<T>(fn: (t: Tx) => Promise<T>): Promise<T> {
  const c = await db();
  return c.begin(fn) as Promise<T>;
}
