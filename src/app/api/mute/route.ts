import { NextResponse } from "next/server";
import { addMuted, dbReady, removeMuted } from "@/lib/db";
import { invalidateMail } from "@/lib/cache";
import { internalError, parseJson } from "@/lib/api";

const SENDER_MAX = 254;

function parse(req: Request): Promise<{ account: string; sender: string } | null> {
  return parseJson(req).then((body) => {
    const account = typeof body?.account === "string" ? body.account : "";
    const sender = typeof body?.sender === "string" ? body.sender : "";
    if (!account || !sender || sender.length > SENDER_MAX) return null;
    return { account, sender };
  });
}

export async function POST(req: Request) {
  const input = await parse(req);
  if (!input) return NextResponse.json({ error: "account, sender required" }, { status: 400 });
  if (!dbReady()) return NextResponse.json({ error: "db unavailable" }, { status: 503 });
  try {
    await addMuted(input.account, input.sender);
    invalidateMail();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return internalError(e, "mute");
  }
}

export async function DELETE(req: Request) {
  const input = await parse(req);
  if (!input) return NextResponse.json({ error: "account, sender required" }, { status: 400 });
  if (!dbReady()) return NextResponse.json({ error: "db unavailable" }, { status: 503 });
  try {
    await removeMuted(input.account, input.sender);
    invalidateMail();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return internalError(e, "mute");
  }
}
