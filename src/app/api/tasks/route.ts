import { NextResponse } from "next/server";
import { addTasks, dbReady, deleteTask, listTasks, purgeDoneTasks, reorderTasks, setTaskDone, taskToBottom, updateTask } from "@/lib/db";
import { internalError, isUuid, parseJson } from "@/lib/api";

export const dynamic = "force-dynamic";

const TEXT_MAX = 1000;
const ORDER_MAX = 500;

export async function GET() {
  if (!dbReady()) return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  try {
    return NextResponse.json({ tasks: await listTasks() });
  } catch (e) {
    return internalError(e, "tasks");
  }
}

export async function POST(req: Request) {
  if (!dbReady()) return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  const body = await parseJson(req);
  if (!body) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const items: { text: string; id?: string }[] = [];
  if (Array.isArray(body.texts)) {
    for (const t of body.texts.slice(0, 50)) {
      if (typeof t === "string") items.push({ text: t });
      else if (t && typeof t === "object" && typeof t.text === "string") items.push({ text: t.text, id: isUuid(t.id) ? t.id : undefined });
    }
  }
  if (typeof body.text === "string") items.push({ text: body.text, id: isUuid(body.id) ? body.id : undefined });
  if (items.some((i) => i.text.length > TEXT_MAX)) return NextResponse.json({ error: "text too long" }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, added: await addTasks(items) });
  } catch (e) {
    return internalError(e, "tasks");
  }
}

export async function PATCH(req: Request) {
  if (!dbReady()) return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  const body = await parseJson(req);
  if (!body) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    if (Array.isArray(body.order)) {
      const order = body.order.slice(0, ORDER_MAX).filter(isUuid);
      await reorderTasks(order);
    } else if (isUuid(body.id)) {
      if (body.toBottom === true) await taskToBottom(body.id);
      else if (typeof body.done === "boolean") await setTaskDone(body.id, body.done);
      else if (typeof body.text === "string" && body.text.trim() && body.text.length <= TEXT_MAX) await updateTask(body.id, body.text.trim());
      else return NextResponse.json({ error: "nothing to do" }, { status: 400 });
    } else {
      return NextResponse.json({ error: "bad request" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return internalError(e, "tasks");
  }
}

export async function DELETE(req: Request) {
  if (!dbReady()) return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  const url = new URL(req.url);
  try {
    if (url.searchParams.get("purge") === "1") {
      return NextResponse.json({ ok: true, purged: await purgeDoneTasks() });
    }
    const id = url.searchParams.get("id");
    if (!isUuid(id)) return NextResponse.json({ error: "valid id required" }, { status: 400 });
    await deleteTask(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return internalError(e, "tasks");
  }
}
