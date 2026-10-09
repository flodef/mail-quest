import { NextResponse } from "next/server";
import { addPushSub, dbReady, removePushSub } from "@/lib/db";
import { internalError, parseJson } from "@/lib/api";
import { isAllowedPushEndpoint } from "@/lib/push";

// Seuls les services push reconnus : sinon n'importe quel endpoint ferait
// sortir des requêtes serveur (SSRF) à chaque notification.
export async function POST(req: Request) {
  const sub = await parseJson(req);
  const endpoint = typeof sub?.endpoint === "string" ? sub.endpoint : "";
  const keys = sub?.keys as { p256dh?: unknown; auth?: unknown } | undefined;
  if (!endpoint || typeof keys?.p256dh !== "string" || typeof keys?.auth !== "string") {
    return NextResponse.json({ error: "bad subscription" }, { status: 400 });
  }
  if (endpoint.length > 500 || keys.p256dh.length > 200 || keys.auth.length > 200) {
    return NextResponse.json({ error: "subscription too large" }, { status: 400 });
  }
  if (!isAllowedPushEndpoint(endpoint)) {
    return NextResponse.json({ error: "endpoint not allowed" }, { status: 400 });
  }
  if (!dbReady()) return NextResponse.json({ error: "db unavailable" }, { status: 503 });
  try {
    await addPushSub(endpoint, { p256dh: keys.p256dh, auth: keys.auth });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return internalError(e, "push");
  }
}

export async function DELETE(req: Request) {
  const body = await parseJson(req);
  if (!dbReady()) return NextResponse.json({ error: "db unavailable" }, { status: 503 });
  try {
    if (typeof body?.endpoint === "string" && body.endpoint.length <= 500) await removePushSub(body.endpoint);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return internalError(e, "push");
  }
}
