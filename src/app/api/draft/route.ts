import { NextResponse } from "next/server";
import { getAccount } from "@/lib/mail/accounts";
import { getDraft } from "@/lib/mail/imap";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const account = url.searchParams.get("account") ?? "";
  const mailbox = url.searchParams.get("mailbox") ?? "";
  const uidRaw = url.searchParams.get("uid");
  const uid = uidRaw === null ? NaN : Number(uidRaw);
  if (!account || !mailbox || !Number.isFinite(uid)) {
    return NextResponse.json({ error: "account, mailbox, uid required" }, { status: 400 });
  }
  const draft = await getDraft(getAccount(account), mailbox, uid);
  if (!draft) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(draft);
}
