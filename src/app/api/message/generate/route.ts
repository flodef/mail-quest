import { NextResponse } from "next/server";
import { getAccount } from "@/lib/mail/accounts";
import { createReplyDraft, getMessage } from "@/lib/mail/imap";
import { generateReply } from "@/lib/ai";
import { internalError, isUid, parseJson } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await parseJson(req);
  const account = typeof body?.account === "string" ? body.account : "";
  const uid = body?.uid;
  if (!account || !isUid(uid)) {
    return NextResponse.json({ error: "account, uid required" }, { status: 400 });
  }
  try {
    const acc = getAccount(account);
    const msg = await getMessage(acc, uid);
    if (!msg) return NextResponse.json({ error: "message not found" }, { status: 404 });
    // Reply-To prioritaire (listes, formulaires) ; sinon l'expéditeur.
    const to = msg.replyToEmail ?? msg.fromEmail;
    if (!to) return NextResponse.json({ error: "sender address missing" }, { status: 400 });
    const text = await generateReply({ from: msg.from, subject: msg.subject, body: msg.text ?? "" });
    await createReplyDraft(acc, {
      to,
      subject: msg.subject,
      body: text,
      inReplyTo: msg.messageId,
      ai: true,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return internalError(e, "generate");
  }
}
