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
