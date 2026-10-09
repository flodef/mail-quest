import { NextResponse } from "next/server";

export const isUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export const isUid = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;

export const jsonError = (status: number, error: string) => NextResponse.json({ error }, { status });

/**
 * Journalise l'erreur côté serveur et renvoie un message générique au client —
 * les messages internes (IMAP, Postgres, Gemini) ne doivent pas fuiter.
 */
export function internalError(e: unknown, ctx = "api") {
  console.error(`[${ctx}]`, e instanceof Error ? e.message : e);
  return jsonError(500, "Erreur interne");
}

/**
 * Corps JSON obligatoire sur les méthodes mutantes : sans ce garde, un POST
 * text/plain (simple, sans préflight CORS) serait accepté — rempart CSRF.
 */
export async function parseJson(req: Request): Promise<Record<string, unknown> | null> {
  const ct = (req.headers.get("content-type") ?? "").toLowerCase();
  if (!ct.startsWith("application/json")) return null;
  const b = await req.json().catch(() => null);
  return b && typeof b === "object" && !Array.isArray(b) ? b : null;
}
