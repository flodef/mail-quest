import { NextResponse } from "next/server";
import { getAccount } from "@/lib/mail/accounts";
import { getDraft, findOriginalMessage, createReplyDraft, moveDraft } from "@/lib/mail/imap";
import { improveDraft } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const { account, mailbox, uid, instructions } = await req.json().catch(() => ({}));
  if (!account || !mailbox || !Number.isFinite(uid) || typeof instructions !== "string" || !instructions.trim()) {
    return NextResponse.json({ error: "account, mailbox, uid, instructions required" }, { status: 400 });
  }
  try {
    const acc = getAccount(account);
    const draft = await getDraft(acc, mailbox, uid);
    if (!draft) return NextResponse.json({ error: "draft not found" }, { status: 404 });
    const original = await findOriginalMessage(acc, draft.to, draft.subject).catch(() => null);
    const body = await improveDraft({
      draft: draft.text ?? draft.preview ?? "",
      instructions: instructions.trim(),
      context: original?.text ?? undefined,
    });
    await createReplyDraft(acc, draft.to, draft.subject, body);
    await moveDraft(acc, mailbox, uid);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
