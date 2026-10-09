import { describe, expect, it } from "vitest";
import { cleanHeaderValue, extractAddress, headerAddresses, sanitizeBody } from "./imap";

// C1 : un email piégé ne doit pas pouvoir exécuter de script dans l'app.
describe("sanitizeBody — XSS", () => {
  it("retire les handlers on* et les scripts", () => {
    const out = sanitizeBody('<img src="https://x/p.png" onerror="alert(1)"><script>alert(2)</script><p>ok</p>', true)!;
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert(");
    expect(out).toContain("<p>ok</p>");
  });

  it("neutralise javascript: et les URLs protocol-relative", () => {
    const out = sanitizeBody('<a href="javascript:alert(1)">x</a><a href="//evil.test">y</a><img src="javascript:x">', true)!;
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain('href="//evil.test"');
  });

  it("retire iframe/form/object", () => {
    const out = sanitizeBody('<iframe src="https://evil"></iframe><form action="https://evil"><input></form><object></object><b>ok</b>', true)!;
    expect(out).not.toContain("<iframe");
    expect(out).not.toContain("<form");
    expect(out).not.toContain("<object");
    expect(out).toContain("<b>ok</b>");
  });

  it("force target=_blank + rel=noopener sur les liens", () => {
    const out = sanitizeBody('<a href="https://ok.test">lien</a>', true)!;
    expect(out).toContain('target="_blank"');
    expect(out).toContain("noopener");
  });

  it("variante sans images : distantes retirées, data/cid conservées", () => {
    const out = sanitizeBody('<img src="https://tracker/p.gif"><img src="data:image/png;base64,iVBOR"><img src="cid:part1">', false)!;
    expect(out).not.toContain("tracker/p.gif");
    expect(out).toContain("data:image/png");
    expect(out).toContain("cid:part1");
  });

  it("variante sans images : pas de CSS url() — l'attribut style est retiré", () => {
    const out = sanitizeBody(
      '<div style="background-image:url(https://tracker.example/px.gif)">x</div>' +
        '<p style="list-style-image:url(https://t/x.png)">y</p>' +
        '<span style="cursor:url(https://t/c.cur),auto">z</span>',
      false,
    )!;
    expect(out).not.toContain("url(");
    expect(out).not.toContain("style=");
    expect(out).toContain(">x<");
    // … et la variante complète garde le style (l'utilisateur a consenti).
    expect(sanitizeBody('<b style="color:red">r</b>', true)).toContain("color:red");
  });

  it("pas de html → null", () => {
    expect(sanitizeBody(false, true)).toBeNull();
    expect(sanitizeBody(undefined, true)).toBeNull();
  });
});

// C2 : un sujet/expéditeur piégé ne doit pas injecter d'en-têtes dans le brouillon.
describe("cleanHeaderValue", () => {
  it("neutralise CRLF (injection d'en-têtes)", () => {
    expect(cleanHeaderValue("Sujet\r\nCc: evil@x.test\nBcc: evil2@x.test")).toBe("Sujet Cc: evil@x.test Bcc: evil2@x.test");
    expect(cleanHeaderValue("Sujet\r\nCc: evil@x.test")).not.toMatch(/[\r\n]/);
  });
});

describe("extractAddress", () => {
  it("extrait l'adresse d'un affichage « Nom <a@b> »", () => {
    expect(extractAddress("Jean Dupont <Jean@X.FR>")).toBe("jean@x.fr");
    expect(extractAddress("alice@x.test")).toBe("alice@x.test");
    expect(extractAddress('"Jean, D." <jean@x.fr>')).toBe("jean@x.fr"); // nom avec virgule
  });
});

describe("headerAddresses", () => {
  it("accepte les formes d'affichage et les listes", () => {
    expect(headerAddresses("Jean Dupont <jean@x.fr>")).toEqual(["jean@x.fr"]);
    expect(headerAddresses("a@x.fr, Bob <b@y.fr>, c@z.fr")).toEqual(["a@x.fr", "b@y.fr", "c@z.fr"]);
  });
  it("jette si aucune adresse valide (injection CRLF neutralisée)", () => {
    for (const v of ["  ", "pas une adresse", "a@b.c\r\nCc: e@f.g"]) {
      expect(() => headerAddresses(v), v).toThrow("destinataire invalide");
    }
  });
});
