import { describe, expect, it } from "vitest";
import { ipv6Prefix64, isBotRoute, isMutating, isPublicApi, isPublicAsset } from "./access";

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

describe("ipv6Prefix64", () => {
  it("expanse :: avant d'extraire les 4 premiers hextets", () => {
    // Toutes ces adresses sont dans 2001:db8::/64 → même bucket.
    for (const ip of ["2001:db8::1", "2001:db8::2", "2001:db8:0:0:0:0:0:1", "2001:0db8:0000:0000::beef"]) {
      expect(ipv6Prefix64(ip)).toBe("2001:db8:0:0::/64");
    }
    // /64 différents → buckets différents.
    expect(ipv6Prefix64("2001:db9::1")).toBe("2001:db9:0:0::/64");
    // fe80::abcd:12:34:56 = fe80:0:0:0:abcd:12:34:56 → le /64 est fe80::/64.
    expect(ipv6Prefix64("fe80::abcd:12:34:56")).toBe("fe80:0:0:0::/64");
  });
  it("IPv4-mapped retombe sur l'IPv4 (dotted + hex)", () => {
    expect(ipv6Prefix64("::ffff:1.2.3.4")).toBe("1.2.3.4");
    expect(ipv6Prefix64("::ffff:0102:0304")).toBe("1.2.3.4");
    expect(ipv6Prefix64("::ffff:1:203")).toBe("0.1.2.3");
  });
});
