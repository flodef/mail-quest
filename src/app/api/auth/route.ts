import { NextResponse } from "next/server";
import { checkPasscode, setSession, clearSession } from "@/lib/auth";

export async function POST(req: Request) {
  const { passcode } = await req.json().catch(() => ({ passcode: "" }));
  if (!checkPasscode(String(passcode ?? ""))) {
    return NextResponse.json({ error: "bad passcode" }, { status: 401 });
  }
  await setSession();
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
