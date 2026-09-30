export async function improveDraft(opts: { draft: string; instructions: string; context?: string }): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY env var missing");
  const model = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
  const prompt = [
    "Tu réécris un brouillon d'email existant en appliquant les consignes de l'utilisateur.",
    "Réponds UNIQUEMENT avec le nouveau corps du brouillon, sans explication, sans markdown.",
    "Garde la langue du brouillon existant sauf si la consigne demande de changer.",
    "Applique fidèlement les consignes : ajouts, suppressions, changement de ton, etc.",
    "",
    "Brouillon actuel:",
    opts.draft.slice(0, 6000),
    "",
    opts.context ? `Contexte (message original):\n${opts.context.slice(0, 4000)}\n` : "",
    `Consignes: ${opts.instructions}`,
  ].join("\n");
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  if (!text) throw new Error("Réponse IA vide");
  return text;
}

export async function generateReply(opts: { from: string; subject: string; body: string }): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY env var missing");
  const model = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
  const prompt = [
    "Tu es un assistant qui rédige un brouillon de réponse à un email.",
    "Réponds UNIQUEMENT avec le corps de la réponse, sans salutations méta, sans explication, sans markdown.",
    "Rédige dans la langue exacte du message reçu.",
    "Ton professionnel mais chaleureux, concis.",
    "",
    `De: ${opts.from}`,
    `Sujet: ${opts.subject}`,
    "",
    "Message:",
    opts.body.slice(0, 6000),
  ].join("\n");
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  if (!text) throw new Error("Réponse IA vide");
  return text;
}

const fallbackTitle = (body: string) => (body.length > 60 ? body.slice(0, 60).trim() + "…" : body.trim());

export async function generateTitle(body: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return fallbackTitle(body);
  const model = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
  const prompt = [
    "Donne un titre très court (3 à 6 mots, sans ponctuation finale) pour cette note.",
    "Réponds UNIQUEMENT avec le titre, dans la langue de la note.",
    "",
    "Note:",
    body.slice(0, 3000),
  ].join("\n");
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return fallbackTitle(body);
    const j = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
    return text ? text.slice(0, 200) : fallbackTitle(body);
  } catch {
    return fallbackTitle(body);
  }
}
