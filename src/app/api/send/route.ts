import { NextResponse } from "next/server";
import { getAccount } from "@/lib/mail/accounts";
import { sendDraft } from "@/lib/mail/smtp";
import { dbReady, removeAside } from "@/lib/db";
import { invalidateMail } from "@/lib/cache";

export async function POST(req: Request) {
  const { account, mailbox, uid } = await req.json().catch(() => ({}));
  if (!account || !mailbox || !Number.isFinite(uid)) {
    return NextResponse.json({ error: "account, mailbox, uid required" }, { status: 400 });
  }
  try {
    const sent = await sendDraft(getAccount(account), mailbox, uid);
    if (dbReady()) await removeAside(account, uid).catch(() => {});
    invalidateMail();
    return NextResponse.json({ ok: true, ...sent });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
