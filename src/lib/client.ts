// Helpers partagés côté client — NE PAS importer next/server ici (le module
// finit dans le bundle client via page.tsx).

/** Extrait le message d'erreur d'une réponse API. */
export async function apiError(r: Response, fallback = "Échec"): Promise<string> {
  const body = (await r.json().catch(() => ({}))) as { error?: string };
  return body.error ?? fallback;
}
