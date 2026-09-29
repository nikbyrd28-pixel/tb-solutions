import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "./env";

// Stateless signed cookies. Three kinds:
//  chalk_p  player  { pid, v }        v=1 once the phone was verified by text on this device
//  chalk_s  staff   { sid, vid, role }
//  chalk_a  admin   { admin: true }

const key = () => new TextEncoder().encode(env.sessionSecret);

export type PlayerSession = { pid: string; v: 0 | 1 };
export type StaffSession = { sid: string; vid: string; role: "bartender" | "manager" | "owner" };
export type AdminSession = { admin: true };

async function sign(payload: Record<string, unknown>, days: number) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(key());
}

async function verify<T>(token: string | undefined): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return payload as unknown as T;
  } catch {
    return null;
  }
}

const base = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };

export async function setPlayerSession(s: PlayerSession) {
  (await cookies()).set("chalk_p", await sign(s, 60), { ...base, maxAge: 60 * 86400 });
}
export async function getPlayerSession() {
  return verify<PlayerSession>((await cookies()).get("chalk_p")?.value);
}
export async function clearPlayerSession() {
  (await cookies()).delete("chalk_p");
}

export async function setStaffSession(s: StaffSession) {
  (await cookies()).set("chalk_s", await sign(s, 30), { ...base, maxAge: 30 * 86400 });
}
export async function getStaffSession() {
  return verify<StaffSession>((await cookies()).get("chalk_s")?.value);
}
export async function clearStaffSession() {
  (await cookies()).delete("chalk_s");
}

export async function setAdminSession() {
  (await cookies()).set("chalk_a", await sign({ admin: true }, 7), { ...base, maxAge: 7 * 86400 });
}
export async function getAdminSession() {
  return verify<AdminSession>((await cookies()).get("chalk_a")?.value);
}
export async function clearAdminSession() {
  (await cookies()).delete("chalk_a");
}
