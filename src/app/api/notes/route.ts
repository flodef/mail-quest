import { NextResponse } from "next/server";
import { addNote, dbReady, deleteNote, listNotes, reorderNotes, updateNote } from "@/lib/db";
import { generateTitle } from "@/lib/ai";
import { bulletizeNote } from "@/lib/items";
import { internalError, isUuid, parseJson } from "@/lib/api";

export const dynamic = "force-dynamic";

const BODY_MAX = 20_000;
const ORDER_MAX = 500;

export async function GET() {
  if (!dbReady()) return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  try {
    return NextResponse.json({ notes: await listNotes() });
  } catch (e) {
    return internalError(e, "notes");
  }
}

export async function POST(req: Request) {
  if (!dbReady()) return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  const body = await parseJson(req);
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!text) return NextResponse.json({ error: "body required" }, { status: 400 });
  if (text.length > BODY_MAX) return NextResponse.json({ error: "body too long" }, { status: 400 });
  const items = bulletizeNote(text);
  const title =
    typeof body?.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 200)
      : await generateTitle(text);
  const id = isUuid(body?.id) ? body.id : undefined;
  try {
    return NextResponse.json({ ok: true, note: await addNote(title, items, id) });
  } catch (e) {
    return internalError(e, "notes");
  }
}

export async function PATCH(req: Request) {
  if (!dbReady()) return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  const body = await parseJson(req);
  if (!body) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    if (Array.isArray(body.order)) {
      await reorderNotes(body.order.slice(0, ORDER_MAX).filter(isUuid));
      return NextResponse.json({ ok: true });
    }
    if (!isUuid(body.id)) return NextResponse.json({ error: "valid id required" }, { status: 400 });
    // body absent = 400 — sinon on effacerait la note par accident.
    if (typeof body.body !== "string") return NextResponse.json({ error: "body required" }, { status: 400 });
    const text = body.body.trim();
    if (text.length > BODY_MAX) return NextResponse.json({ error: "body too long" }, { status: 400 });
    await updateNote(body.id, text);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return internalError(e, "notes");
  }
}

export async function DELETE(req: Request) {
  if (!dbReady()) return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  const id = new URL(req.url).searchParams.get("id");
  if (!isUuid(id)) return NextResponse.json({ error: "valid id required" }, { status: 400 });
  try {
    await deleteNote(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return internalError(e, "notes");
  }
}
