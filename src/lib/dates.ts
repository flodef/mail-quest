// Formatage de dates partagé entre composants.

/** "14:32" si aujourd'hui, sinon "05/10 14:32". */
export function fmtShort(d: string | Date | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  const now = new Date();
  const hm = dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return dt.toDateString() === now.toDateString()
    ? hm
    : `${dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} ${hm}`;
}

/** "mar. 07 oct. à 14:32" — pour les échéances d'agenda. */
export function fmtWhen(iso: string, now = Date.now()): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" });
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${day} à ${time}${+d < now ? " (PASSÉ)" : ""}`;
}

/** Début du jour courant (min = aujourd'hui pour les sélecteurs de date). */
export const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
