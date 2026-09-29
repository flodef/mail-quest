import { NextResponse } from "next/server";
import { getAccount } from "@/lib/mail/accounts";
import { createReplyDraft, getMessage } from "@/lib/mail/imap";
import { generateReply } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const { account, uid } = await req.json().catch(() => ({}));
  if (!account || !Number.isFinite(uid)) {
    return NextResponse.json({ error: "account, uid required" }, { status: 400 });
  }
  try {
    const acc = getAccount(account);
    const msg = await getMessage(acc, uid);
    if (!msg) return NextResponse.json({ error: "message not found" }, { status: 404 });
    if (!msg.fromEmail) return NextResponse.json({ error: "sender address missing" }, { status: 400 });
    const body = await generateReply({ from: msg.from, subject: msg.subject, body: msg.text ?? "" });
    await createReplyDraft(acc, msg.fromEmail, msg.subject, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
