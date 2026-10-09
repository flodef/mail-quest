import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, safeEq } from "@/lib/auth";
import { sessionValid } from "@/lib/db";

import { isBotRoute, isMutating, isPublicApi, isPublicAsset } from "@/lib/access";

// Cache court des sessions valides : évite un aller-retour Neon par requête.
// Une révocation met au plus SESSION_CACHE_MS à être effective.
const SESSION_CACHE_MS = 60_000;
const SESSION_CACHE_MAX = 500;
const sessionCache = new Map<string, number>();

function sessionCacheSet(token: string, until: number) {
  // Balayage anti-croissance : au-delà de SESSION_CACHE_MAX, on purge les
  // entrées expirées avant d'insérer.
  if (sessionCache.size >= SESSION_CACHE_MAX) {
    const now = Date.now();
    for (const [k, v] of sessionCache) if (v <= now) sessionCache.delete(k);
  }
  sessionCache.set(token, until);
}

async function sessionOk(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const hit = sessionCache.get(token);
  if (hit && hit > Date.now()) return true;
  let ok = false;
  try {
    ok = await sessionValid(token);
  } catch {
    ok = false; // DB injoignable → fail-closed
  }
  if (ok) sessionCacheSet(token, Date.now() + SESSION_CACHE_MS);
  else sessionCache.delete(token);
  return ok;
}

function forbidden(req: NextRequest): NextResponse {
  if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.redirect(new URL("/login", req.url));
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // CSRF : les mutations d'API exigent une origine same-origin (fetch
  // metadata) — vérifié AVANT le passe-droit des routes publiques : un POST
  // cross-site vers /api/auth est ainsi bloqué. Les clients non-navigateur
  // (bot, curl, cron-job.org) n'ont pas ces en-têtes et passent — ils sont
  // authentifiés par Bearer/cookie.
  const mutating = isMutating(req.method);
  if (mutating && pathname.startsWith("/api/")) {
    const site = req.headers.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "same-site" && site !== "none") return forbidden(req);
    const origin = req.headers.get("origin");
    if (origin) {
      let host = "";
      try {
        host = new URL(origin).host;
      } catch {
        return forbidden(req);
      }
      if (host !== req.headers.get("host")) return forbidden(req);
    }
  }

  if (isPublicApi(pathname) || isPublicAsset(pathname)) return NextResponse.next();

  // Sans code d'accès configuré (dev), l'app reste ouverte — comme avant.
  if (!process.env.MAIL_PASSCODE) return NextResponse.next();

  // Bot : Bearer BOT_API_TOKEN sur GET/POST des routes tasks/notes uniquement.
  if (isBotRoute(req.method, pathname)) {
    const t = process.env.BOT_API_TOKEN;
    if (t && safeEq(req.headers.get("authorization") ?? "", `Bearer ${t}`)) return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token && (await sessionOk(token))) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
