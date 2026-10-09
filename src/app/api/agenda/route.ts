import { NextResponse } from "next/server";
import {
  addAgenda,
  dbReady,
  deleteAgenda,
  listAgenda,
  setAgendaDone,
  updateAgendaSchedule,
  updateAgendaText,
} from "@/lib/db";

export const dynamic = "force-dynamic";

const isUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

const isDate = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));

export async function GET() {
  if (!dbReady()) return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  return NextResponse.json({ events: await listAgenda() });
}

export async function POST(req: Request) {
  if (!dbReady()) return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });
  if (!isDate(body.dueAt)) return NextResponse.json({ error: "dueAt required" }, { status: 400 });
  const remind = Number.isInteger(body.remindMinutes) && body.remindMinutes >= 0 ? body.remindMinutes : 30;
  const event = await addAgenda(text, new Date(body.dueAt).toISOString(), remind, isUuid(body.id) ? body.id : undefined);
  return NextResponse.json({ ok: true, event });
}

export async function PATCH(req: Request) {
  if (!dbReady()) return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.id !== "string") return NextResponse.json({ error: "id required" }, { status: 400 });
  if (typeof body.done === "boolean") {
    await setAgendaDone(body.id, body.done);
  } else if (isDate(body.dueAt)) {
    const remind = Number.isInteger(body.remindMinutes) && body.remindMinutes >= 0 ? body.remindMinutes : 30;
    await updateAgendaSchedule(body.id, new Date(body.dueAt).toISOString(), remind);
  } else if (typeof body.text === "string" && body.text.trim()) {
    await updateAgendaText(body.id, body.text.trim());
  } else {
    return NextResponse.json({ error: "nothing to do" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!dbReady()) return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteAgenda(id);
  return NextResponse.json({ ok: true });
}
