import { NextResponse } from "next/server";
import { getAccount } from "@/lib/mail/accounts";
import { deleteFromSender, deleteMessage, findOriginalMessage, getAttachment, getMessage } from "@/lib/mail/imap";
import { invalidateMail } from "@/lib/cache";
import { internalError, isUid } from "@/lib/api";

export const dynamic = "force-dynamic";

const SENDER_MAX = 254;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const account = url.searchParams.get("account") ?? "";
  const uidRaw = url.searchParams.get("uid");
  const uid = uidRaw === null ? NaN : Number(uidRaw);
  const partRaw = url.searchParams.get("part");
  const part = partRaw === null ? NaN : Number(partRaw);
  const to = url.searchParams.get("to") ?? "";
  const subject = url.searchParams.get("subject") ?? "";
  if (!account || (!isUid(uid) && !(to && subject))) {
    return NextResponse.json({ error: "account + (uid or to+subject) required" }, { status: 400 });
  }
  try {
    const acc = getAccount(account);
    if (Number.isInteger(part)) {
      if (!isUid(uid)) return NextResponse.json({ error: "uid required for attachments" }, { status: 400 });
      const att = await getAttachment(acc, uid, part);
      if (!att) return NextResponse.json({ error: "not found" }, { status: 404 });
      // filename* UTF-8 + nosniff : le content-type vient de l'expéditeur.
      const name = encodeURIComponent(att.filename).replace(/'/g, "%27");
      return new NextResponse(new Uint8Array(att.content), {
        headers: {
          "content-type": att.contentType,
          "content-disposition": `attachment; filename*=UTF-8''${name}`,
          "x-content-type-options": "nosniff",
        },
      });
    }
    const msg = isUid(uid)
      ? await getMessage(acc, uid)
      : await findOriginalMessage(acc, to.slice(0, 500), subject.slice(0, 500));
    if (!msg) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(msg);
  } catch (e) {
    return internalError(e, "message");
  }
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const account = url.searchParams.get("account") ?? "";
  const uidRaw = url.searchParams.get("uid");
  const uid = uidRaw === null ? NaN : Number(uidRaw);
  const sender = (url.searchParams.get("sender") ?? "").slice(0, SENDER_MAX);
  if (!account || (!isUid(uid) && !sender)) {
    return NextResponse.json({ error: "account + (uid or sender) required" }, { status: 400 });
  }
  try {
    const acc = getAccount(account);
    if (sender) {
      const count = await deleteFromSender(acc, sender);
      if (count > 0) invalidateMail();
      return NextResponse.json({ ok: true, deleted: count });
    }
    await deleteMessage(acc, uid);
    invalidateMail();
    return NextResponse.json({ ok: true, deleted: 1 });
  } catch (e) {
    return internalError(e, "message");
  }
}
