import { NextResponse } from "next/server";
import { addNote, dbReady, deleteNote, listNotes, updateNote } from "@/lib/db";
import { generateTitle } from "@/lib/ai";
import { bulletizeNote } from "@/lib/items";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!dbReady()) return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  return NextResponse.json({ notes: await listNotes() });
}

export async function POST(req: Request) {
  if (!dbReady()) return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) return NextResponse.json({ error: "body required" }, { status: 400 });
  const items = bulletizeNote(text);
  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 200)
      : await generateTitle(text);
  return NextResponse.json({ ok: true, note: await addNote(title, items) });
}

export async function PATCH(req: Request) {
  if (!dbReady()) return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await updateNote(id, text);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!dbReady()) return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteNote(id);
  return NextResponse.json({ ok: true });
}
