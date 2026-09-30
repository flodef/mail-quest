import { NextResponse } from "next/server";
import { getAccount } from "@/lib/mail/accounts";
import { deleteFromSender, deleteMessage, findOriginalMessage, getMessage } from "@/lib/mail/imap";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const account = url.searchParams.get("account") ?? "";
  const uidRaw = url.searchParams.get("uid");
  const uid = uidRaw === null ? NaN : Number(uidRaw);
  const to = url.searchParams.get("to") ?? "";
  const subject = url.searchParams.get("subject") ?? "";
  if (!account || (!Number.isFinite(uid) && !(to && subject))) {
    return NextResponse.json({ error: "account + (uid or to+subject) required" }, { status: 400 });
  }
  try {
    const acc = getAccount(account);
    const msg = Number.isFinite(uid)
      ? await getMessage(acc, uid)
      : await findOriginalMessage(acc, to, subject);
    if (!msg) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(msg);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const account = url.searchParams.get("account") ?? "";
  const uidRaw = url.searchParams.get("uid");
  const uid = uidRaw === null ? NaN : Number(uidRaw);
  const sender = url.searchParams.get("sender") ?? "";
  if (!account || (!Number.isFinite(uid) && !sender)) {
    return NextResponse.json({ error: "account + (uid or sender) required" }, { status: 400 });
  }
  try {
    const acc = getAccount(account);
    if (sender) {
      const count = await deleteFromSender(acc, sender);
      return NextResponse.json({ ok: true, deleted: count });
    }
    await deleteMessage(acc, uid);
    return NextResponse.json({ ok: true, deleted: 1 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
