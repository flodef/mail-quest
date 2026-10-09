import { describe, expect, it } from "vitest";
import { isUid, isUuid, parseJson } from "./api";

describe("isUuid", () => {
  it("accepte un UUID", () => {
    expect(isUuid("123e4567-e89b-42d3-a456-426614174000")).toBe(true);
  });
  it("rejette le reste", () => {
    for (const v of ["", "abc", "123e4567e89b42d3a456426614174000", "123e4567-e89b-42d3-a456-426614174000x", 42, null, {}]) {
      expect(isUuid(v), String(v)).toBe(false);
    }
  });
});

describe("isUid", () => {
  it("entiers strictement positifs uniquement", () => {
    expect(isUid(1)).toBe(true);
    expect(isUid(12345)).toBe(true);
    expect(isUid(0)).toBe(false);
    expect(isUid(-3)).toBe(false);
    expect(isUid(1.5)).toBe(false);
    expect(isUid(NaN)).toBe(false);
    expect(isUid("42")).toBe(false);
    expect(isUid(Infinity)).toBe(false);
  });
});

describe("parseJson", () => {
  it("requiert un content-type JSON", async () => {
    const r = new Request("http://x/api", { method: "POST", body: "a=1", headers: { "content-type": "text/plain" } });
    expect(await parseJson(r)).toBeNull();
  });
  it("accepte un objet JSON", async () => {
    const r = new Request("http://x/api", { method: "POST", body: '{"uid":3}', headers: { "content-type": "application/json" } });
    expect(await parseJson(r)).toEqual({ uid: 3 });
  });
  it("rejette JSON invalide ou non-objet", async () => {
    for (const body of ["{bad", "[1,2]", "42", '"s"']) {
      const r = new Request("http://x/api", { method: "POST", body, headers: { "content-type": "application/json" } });
      expect(await parseJson(r), body).toBeNull();
    }
  });
});
