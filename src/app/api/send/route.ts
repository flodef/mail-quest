import { NextResponse } from "next/server";
import { getAccount } from "@/lib/mail/accounts";
import { sendDraft } from "@/lib/mail/smtp";
import { dbReady, removeAside } from "@/lib/db";
import { invalidateMail } from "@/lib/cache";
import { internalError, isUid, parseJson } from "@/lib/api";

// La boîte Brouillons est résolue côté serveur (imap.ts) — le client n'a pas
// à la fournir, et ne peut donc pas faire « envoyer » un message de l'INBOX.
export async function POST(req: Request) {
  const body = await parseJson(req);
  const account = typeof body?.account === "string" ? body.account : "";
  const uid = body?.uid;
  if (!account || !isUid(uid)) {
    return NextResponse.json({ error: "account, uid required" }, { status: 400 });
  }
  try {
    const sent = await sendDraft(getAccount(account), uid);
    if (dbReady()) await removeAside(account, uid).catch(() => {});
    invalidateMail();
    return NextResponse.json({ ok: true, ...sent });
  } catch (e) {
    return internalError(e, "send");
  }
}
