// Copie dans le presse-papier avec fallback execCommand (contextes non-HTTPS,
// vieux WebViews iOS). Client-side only.
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}
