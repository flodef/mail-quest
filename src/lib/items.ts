// Fourre-tout : chaque ligne d'une note est un item de type checklist.
// "• item" = actif, "✅ item" = fait (descend en bas, comme les trophées de Quêtes).

export type NoteItem = { text: string; done: boolean };

// Attention : les formes "- [ ]"/"- [x]" doivent précéder la classe de
// puces — sinon le "-" seul est consommé d'abord et "[ ]" survit.
const DONE_RE = /^(?:-\s*\[[xX]\]|[✅✔☑])\s*/;
const BULLET_RE = /^(?:-\s*\[ \]|[•\-–—*])\s*/;

export function parseNoteItems(body: string): NoteItem[] {
  return body
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const done = DONE_RE.test(l);
      const text = l.replace(DONE_RE, "").replace(BULLET_RE, "").trim();
      return { text, done };
    })
    .filter((i) => i.text);
}

export function serializeNoteItems(items: NoteItem[]): string {
  return items.map((i) => `${i.done ? "✅" : "•"} ${i.text}`).join("\n");
}

// Normalise un texte libre en liste à puces — idempotent.
export function bulletizeNote(text: string): string {
  return serializeNoteItems(parseNoteItems(text));
}
