import { describe, expect, it } from "vitest";
import { bulletizeNote, parseNoteItems, serializeNoteItems } from "./items";

describe("parseNoteItems", () => {
  it("parse les puces et les coches", () => {
    expect(parseNoteItems("• pain\n✅ lait\n- [ ] oeufs\n- [x] beurre")).toEqual([
      { text: "pain", done: false },
      { text: "lait", done: true },
      { text: "oeufs", done: false },
      { text: "beurre", done: true },
    ]);
  });
  it("ignore les lignes vides et les puces sans texte", () => {
    expect(parseNoteItems("\n• \n\n• sel")).toEqual([{ text: "sel", done: false }]);
  });
  it("garde une ligne sans puce comme item actif", () => {
    expect(parseNoteItems("juste une ligne")).toEqual([{ text: "juste une ligne", done: false }]);
  });
});

describe("bulletizeNote", () => {
  it("normalise en puces cochables, idempotent", () => {
    const once = bulletizeNote("pain\n✅ lait");
    expect(once).toBe("• pain\n✅ lait");
    expect(bulletizeNote(once)).toBe(once);
  });
});

describe("serializeNoteItems", () => {
  it("réversible via parseNoteItems", () => {
    const items = [
      { text: "a", done: false },
      { text: "b", done: true },
    ];
    expect(parseNoteItems(serializeNoteItems(items))).toEqual(items);
  });
});
