import { describe, expect, it } from "vitest";
import { isBotRoute, isMutating, isPublicApi, isPublicAsset } from "./access";

describe("matrice d'accès du proxy", () => {
  it("routes API publiques : exactes ou sous-chemins uniquement", () => {
    for (const p of ["/api/auth", "/api/cron", "/api/reminders", "/api/cron/x"]) {
      expect(isPublicApi(p), p).toBe(true);
    }
  });

  it("un préfixe ressemblant n'est PAS public (régression)", () => {
    for (const p of ["/api/cronXYZ", "/api/reminders2", "/api/authenticate", "/api/cronjob", "/api/reminder"]) {
      expect(isPublicApi(p), p).toBe(false);
    }
  });

  it("assets publics : exacts ou sous /_next/", () => {
    expect(isPublicAsset("/login")).toBe(true);
    expect(isPublicAsset("/sw.js")).toBe(true);
    expect(isPublicAsset("/_next/static/chunk.js")).toBe(true);
    expect(isPublicAsset("/iconXYZ")).toBe(false);
    expect(isPublicAsset("/login/evil")).toBe(false);
    expect(isPublicAsset("/")).toBe(false);
  });

  it("bot : GET/POST sur tasks+notes uniquement", () => {
    expect(isBotRoute("GET", "/api/tasks")).toBe(true);
    expect(isBotRoute("POST", "/api/notes")).toBe(true);
    expect(isBotRoute("DELETE", "/api/tasks")).toBe(false);
    expect(isBotRoute("PATCH", "/api/notes")).toBe(false);
    expect(isBotRoute("PUT", "/api/tasks")).toBe(false);
    expect(isBotRoute("GET", "/api/message")).toBe(false);
    expect(isBotRoute("GET", "/api/tasksX")).toBe(false);
  });

  it("méthodes mutantes soumises au garde CSRF", () => {
    expect(isMutating("POST")).toBe(true);
    expect(isMutating("DELETE")).toBe(true);
    expect(isMutating("GET")).toBe(false);
    expect(isMutating("HEAD")).toBe(false);
    expect(isMutating("OPTIONS")).toBe(false);
  });
});
