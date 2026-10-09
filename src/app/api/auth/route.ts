import { NextResponse } from "next/server";
import { checkPasscode, setSession, clearSession } from "@/lib/auth";
import { recordLoginAttempt, tooManyLoginAttempts } from "@/lib/db";
import { internalError, parseJson } from "@/lib/api";

// IP cliente pour le rate-limit : x-real-ip est posé par l'edge Vercel
// (fiable). À défaut, la DERNIÈRE entrée x-forwarded-for — les entrées en
// tête sont contrôlées par le client et permettraient d'esquiver le quota.
function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const xff = req.headers.get("x-forwarded-for")?.split(",").pop()?.trim();
  return xff || "unknown";
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (await tooManyLoginAttempts(ip).catch(() => false)) {
    return NextResponse.json({ error: "too many attempts" }, { status: 429 });
  }
  const body = await parseJson(req);
  const passcode = String(body?.passcode ?? "");
  try {
    // Seuls les échecs sont comptés — un utilisateur légitime qui se
    // reconnecte souvent ne doit pas tomber sur le plafond.
    if (!checkPasscode(passcode)) {
      await recordLoginAttempt(ip).catch(() => {});
      return NextResponse.json({ error: "bad passcode" }, { status: 401 });
    }
    await setSession();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return internalError(e, "auth");
  }
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
