import { NextResponse } from "next/server";
import { addAside, dbReady, removeAside } from "@/lib/db";

export async function POST(req: Request) {
  const { account, uid } = await req.json().catch(() => ({}));
  if (!account || !Number.isFinite(uid)) {
    return NextResponse.json({ error: "account, uid required" }, { status: 400 });
  }
  if (!dbReady()) return NextResponse.json({ error: "db unavailable" }, { status: 503 });
  await addAside(account, uid);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { account, uid } = await req.json().catch(() => ({}));
  if (!dbReady()) return NextResponse.json({ error: "db unavailable" }, { status: 503 });
  await removeAside(account, uid);
  return NextResponse.json({ ok: true });
}
