import { NextResponse } from "next/server";
import { getAccount } from "@/lib/mail/accounts";
import { getDraft, findOriginalMessage, createReplyDraft, moveDraft } from "@/lib/mail/imap";
import { improveDraft } from "@/lib/ai";
import { internalError, isUid, parseJson } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const INSTRUCTIONS_MAX = 2000;

export async function POST(req: Request) {
  const body = await parseJson(req);
  const account = typeof body?.account === "string" ? body.account : "";
  const uid = body?.uid;
  const instructions = typeof body?.instructions === "string" ? body.instructions.trim() : "";
  if (!account || !isUid(uid) || !instructions || instructions.length > INSTRUCTIONS_MAX) {
    return NextResponse.json({ error: "account, uid, instructions required" }, { status: 400 });
  }
  try {
    const acc = getAccount(account);
    const draft = await getDraft(acc, uid);
    if (!draft) return NextResponse.json({ error: "draft not found" }, { status: 404 });
    const original = await findOriginalMessage(acc, draft.to, draft.subject).catch(() => null);
    const improved = await improveDraft({
      draft: draft.text ?? draft.preview ?? "",
      instructions,
      context: original?.text ?? undefined,
    });
    await createReplyDraft(acc, {
      to: draft.to,
      subject: draft.subject,
      body: improved,
      inReplyTo: original?.messageId,
      ai: true,
    });
    // Si le déplacement de l'original échoue, le nouveau brouillon existe
    // quand même — le client avertit (pattern `moved` comme sendDraft).
    const moved = await moveDraft(acc, uid).then(() => true, () => false);
    return NextResponse.json({ ok: true, moved });
  } catch (e) {
    return internalError(e, "improve");
  }
}
