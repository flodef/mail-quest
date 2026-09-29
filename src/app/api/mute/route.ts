import { NextResponse } from "next/server";
import { addMuted, dbReady, removeMuted } from "@/lib/db";

export async function POST(req: Request) {
  const { account, sender } = await req.json().catch(() => ({}));
  if (!account || !sender) return NextResponse.json({ error: "account, sender required" }, { status: 400 });
  if (!dbReady()) return NextResponse.json({ error: "db unavailable" }, { status: 503 });
  await addMuted(account, sender);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { account, sender } = await req.json().catch(() => ({}));
  if (!account || !sender) return NextResponse.json({ error: "account, sender required" }, { status: 400 });
  if (!dbReady()) return NextResponse.json({ error: "db unavailable" }, { status: 503 });
  await removeMuted(account, sender);
  return NextResponse.json({ ok: true });
}
