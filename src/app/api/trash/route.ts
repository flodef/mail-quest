import { NextResponse } from "next/server";
import { getAccount } from "@/lib/mail/accounts";
import { listTrash, purgeTrash, restoreTrash } from "@/lib/mail/imap";
import { invalidateMail } from "@/lib/cache";
import { internalError, isUid, parseJson } from "@/lib/api";

export const dynamic = "force-dynamic";

// GET ?account=x — liste les missives de la corbeille IMAP.
export async function GET(req: Request) {
  const account = new URL(req.url).searchParams.get("account") ?? "";
  if (!account) return NextResponse.json({ error: "account required" }, { status: 400 });
  try {
    return NextResponse.json({ items: await listTrash(getAccount(account)) });
  } catch (e) {
    return internalError(e, "trash");
  }
}

// POST {account, uid} — ressuscite une missive (corbeille → INBOX).
export async function POST(req: Request) {
  const body = await parseJson(req);
  const account = typeof body?.account === "string" ? body.account : "";
  const uid = body?.uid;
  if (!account || !isUid(uid)) {
    return NextResponse.json({ error: "account + uid required" }, { status: 400 });
  }
  try {
    await restoreTrash(getAccount(account), uid);
    invalidateMail();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return internalError(e, "trash");
  }
}

// DELETE ?account=x&uid=n — purge définitive ; &all=1 vide toute la corbeille.
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const account = url.searchParams.get("account") ?? "";
  const uidRaw = url.searchParams.get("uid");
  const uid = uidRaw === null ? NaN : Number(uidRaw);
  const all = url.searchParams.get("all") === "1";
  if (!account || (!all && !isUid(uid))) {
    return NextResponse.json({ error: "account + (uid or all=1) required" }, { status: 400 });
  }
  try {
    const purged = await purgeTrash(getAccount(account), isUid(uid) ? uid : undefined);
    invalidateMail();
    return NextResponse.json({ ok: true, purged });
  } catch (e) {
    return internalError(e, "trash");
  }
}
