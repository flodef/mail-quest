import { NextResponse } from "next/server";
import { getAccount } from "@/lib/mail/accounts";
import { getDraft } from "@/lib/mail/imap";
import { internalError, isUid } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const account = url.searchParams.get("account") ?? "";
  const uidRaw = url.searchParams.get("uid");
  const uid = uidRaw === null ? NaN : Number(uidRaw);
  if (!account || !isUid(uid)) {
    return NextResponse.json({ error: "account, uid required" }, { status: 400 });
  }
  try {
    const draft = await getDraft(getAccount(account), uid);
    if (!draft) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(draft);
  } catch (e) {
    return internalError(e, "draft");
  }
}
