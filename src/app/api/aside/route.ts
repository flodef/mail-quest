import { NextResponse } from "next/server";
import { addAside, dbReady, removeAside } from "@/lib/db";
import { invalidateMail } from "@/lib/cache";
import { internalError, isUid, parseJson } from "@/lib/api";

function parse(req: Request): Promise<{ account: string; uid: number } | null> {
  return parseJson(req).then((body) => {
    const account = typeof body?.account === "string" ? body.account : "";
    const uid = body?.uid;
    if (!account || !isUid(uid)) return null;
    return { account, uid };
  });
}

export async function POST(req: Request) {
  const input = await parse(req);
  if (!input) return NextResponse.json({ error: "account, uid required" }, { status: 400 });
  if (!dbReady()) return NextResponse.json({ error: "db unavailable" }, { status: 503 });
  try {
    await addAside(input.account, input.uid);
    invalidateMail();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return internalError(e, "aside");
  }
}

export async function DELETE(req: Request) {
  const input = await parse(req);
  if (!input) return NextResponse.json({ error: "account, uid required" }, { status: 400 });
  if (!dbReady()) return NextResponse.json({ error: "db unavailable" }, { status: 503 });
  try {
    await removeAside(input.account, input.uid);
    invalidateMail();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return internalError(e, "aside");
  }
}
