import { randomUUID, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { createSession, dbReady, deleteSession } from "@/lib/db";

export const SESSION_COOKIE = "mq_session";
const SESSION_DAYS = 90;

function secret(): string {
  const s = process.env.MAIL_PASSCODE;
  if (!s) throw new Error("MAIL_PASSCODE env var missing");
  return s;
}

/** Comparaison en temps constant (anti timing-attack). */
export function safeEq(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function checkPasscode(input: string): boolean {
  return safeEq(input, secret());
}

/** Crée une session aléatoire en base et pose le cookie. */
export async function setSession(): Promise<void> {
  // Pas de DB = pas de session validable par le proxy : échouer ici plutôt
  // que de poser un cookie qui ne laisserait jamais passer l'utilisateur.
  if (!dbReady()) throw new Error("DATABASE_URL requis pour ouvrir une session");
  const token = `${randomUUID()}${randomUUID().replace(/-/g, "")}`; // ~256 bits
  await createSession(token, SESSION_DAYS);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
    path: "/",
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(token).catch(() => {});
  jar.delete(SESSION_COOKIE);
}

/**
 * Les routes appelées par un scheduler externe (cron-job.org) se protègent
 * elles-mêmes par Bearer CRON_SECRET — fail-closed : sans secret configuré,
 * la route est injoignable.
 */
export function checkCronAuth(req: Request): { ok: true } | { ok: false; status: number; error: string } {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, status: 503, error: "CRON_SECRET non configuré" };
  if (!safeEq(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return { ok: false, status: 401, error: "unauthorized" };
  }
  return { ok: true };
}
