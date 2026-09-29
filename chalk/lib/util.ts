import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";

export const money = (cents: number) => {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return abs % 100 === 0 ? `${sign}$${abs / 100}` : `${sign}$${(abs / 100).toFixed(2)}`;
};

// Station codes: 5 chars, no look-alikes (0/O, 1/I/L).
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
export function stationCode(len = 5) {
  const b = randomBytes(len);
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[b[i] % ALPHABET.length];
  return s;
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// US-first phone normalization to E.164. Returns null if it can't make sense of it.
export function normalizePhone(raw: string): string | null {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 11 && digits.length <= 15 && raw.trim().startsWith("+")) return `+${digits}`;
  return null;
}

export function prettyPhone(e164: string) {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

export function cleanName(raw: string) {
  const s = (raw || "").trim().replace(/\s+/g, " ").slice(0, 24);
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export const otpCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

export function firstNameOf(s: string) {
  return (s || "").trim().split(" ")[0] || "Player";
}

export function json(data: unknown, init?: number | ResponseInit) {
  const i = typeof init === "number" ? { status: init } : init;
  return Response.json(data, i);
}

export function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

export const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);
