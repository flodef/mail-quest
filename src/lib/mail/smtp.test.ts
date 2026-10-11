import { describe, expect, it } from "vitest";
import { stripOutboundHeaders } from "./smtp";

describe("stripOutboundHeaders — en-têtes sensibles retirés à l'envoi", () => {
  it("retire Bcc (+ continuations repliées), Resent-Bcc et DKIM-Signature, préserve le reste", () => {
    const raw = Buffer.from(
      "From: a@x.fr\r\nTo: b@y.fr\r\nBcc: secret1@z.fr,\r\n\tsecret2@z.fr\r\nResent-Bcc: s3@z.fr\r\nDKIM-Signature: v=1; a=rsa;\r\n\tb=abc123\r\nSubject: hello\r\n\r\nbody!",
      "latin1",
    );
    const out = stripOutboundHeaders(raw).toString("latin1");
    expect(out).not.toMatch(/bcc/i);
    expect(out).not.toContain("secret");
    expect(out).not.toMatch(/dkim/i);
    expect(out).toContain("From: a@x.fr");
    expect(out).toContain("Subject: hello");
    expect(out).toContain("body!");
  });

  it("sans séparateur corps : les lignes d'en-tête sont quand même scannées", () => {
    const raw = Buffer.from("From: a@x.fr\nBcc: secret@z.fr\nSubject: hi\n<html>pas un header</html>", "latin1");
    const out = stripOutboundHeaders(raw).toString("latin1");
    expect(out).not.toContain("secret");
    expect(out).toContain("From: a@x.fr");
    expect(out).toContain("<html>pas un header</html>");
  });
});
