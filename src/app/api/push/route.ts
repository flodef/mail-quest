import { NextResponse } from "next/server";
import { addPushSub, dbReady, removePushSub } from "@/lib/db";

export async function POST(req: Request) {
  const sub = await req.json().catch(() => null);
  if (!sub?.endpoint || !sub?.keys) return NextResponse.json({ error: "bad subscription" }, { status: 400 });
  if (!dbReady()) return NextResponse.json({ error: "db unavailable" }, { status: 503 });
  await addPushSub(sub.endpoint, sub.keys);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { endpoint } = await req.json().catch(() => ({}));
  if (!dbReady()) return NextResponse.json({ error: "db unavailable" }, { status: 503 });
  if (endpoint) await removePushSub(endpoint);
  return NextResponse.json({ ok: true });
}
