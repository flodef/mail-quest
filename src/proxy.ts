import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PREFIXES = ["/login", "/api/auth", "/api/cron", "/manifest.webmanifest", "/sw.js", "/icon", "/apple-touch-icon", "/_next", "/favicon"];

async function expectedToken(): Promise<string | null> {
  const s = process.env.MAIL_PASSCODE;
  if (!s) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${s}::mail-quest-v1`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();
  // Bot push (OpenClaw) : Bearer token sur les routes tasks/notes uniquement
  if (["/api/tasks", "/api/notes"].some((p) => pathname.startsWith(p))) {
    const t = process.env.BOT_API_TOKEN;
    if (t && req.headers.get("authorization") === `Bearer ${t}`) return NextResponse.next();
  }
  const token = await expectedToken();
  if (!token) return NextResponse.next();
  if (req.cookies.get("mq_session")?.value === token) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
