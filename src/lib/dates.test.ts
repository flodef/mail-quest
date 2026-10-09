import { describe, expect, it } from "vitest";
import { fmtShort, fmtWhen, startOfToday } from "./dates";

describe("fmtShort", () => {
  it("heure seule si aujourd'hui, date+heure sinon", () => {
    const now = new Date();
    expect(fmtShort(now)).toMatch(/^\d{2}:\d{2}$/);
    const old = new Date(2020, 0, 5, 14, 32);
    expect(fmtShort(old)).toBe("05/01 14:32");
  });
  it("chaînes invalides / vides", () => {
    expect(fmtShort(null)).toBe("");
    expect(fmtShort("pas une date")).toBe("");
  });
});

describe("fmtWhen", () => {
  it("format jour + heure, marqueur (PASSÉ) si échu", () => {
    const future = fmtWhen(new Date(Date.now() + 3600_000).toISOString());
    expect(future).toContain("à");
    expect(future).not.toContain("PASSÉ");
    const past = fmtWhen(new Date(Date.now() - 3600_000).toISOString());
    expect(past).toContain("(PASSÉ)");
  });
});

describe("startOfToday", () => {
  it("minuit local", () => {
    const d = startOfToday();
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
  });
});
