export interface MailAccount {
  id: string;
  label: string;
  color: string;
  imap: { host: string; port: number; secure: boolean; user: string; password: string };
  smtp: { host: string; port: number; secure: boolean; user: string; password: string; from: string };
  // "manual": true dans MAIL_ACCOUNTS → AUCUN polling auto (cron + overview
  // l'ignorent) : le compte n'est relevé qu'à l'ouverture de sa boîte, via
  // /api/account. Pour les fournisseurs qui bloquent les logins IMAP
  // répétés depuis des IP de datacenter (ex. free.fr).
  manual?: boolean;
}

const ACCOUNT_COLORS: Record<string, string> = {
  free: "#e0a100",
  fims: "#3b9e4d",
  tradiz: "#3b6fd4",
  jobconciergerie: "#b04dd4",
};

let cached: MailAccount[] | null = null;

export function getAccounts(): MailAccount[] {
  if (cached) return cached;
  const raw = process.env.MAIL_ACCOUNTS;
  if (!raw) throw new Error("MAIL_ACCOUNTS env var missing");
  const parsed = JSON.parse(raw) as Omit<MailAccount, "color">[];
  cached = parsed.map((a) => ({ ...a, color: ACCOUNT_COLORS[a.id] ?? "#888" }));
  return cached;
}

export function isKnownAccount(id: string): boolean {
  try {
    return getAccounts().some((a) => a.id === id);
  } catch {
    return false;
  }
}

export function getAccount(id: string): MailAccount {
  const acc = getAccounts().find((a) => a.id === id);
  if (!acc) throw new Error(`Unknown account: ${id}`);
  return acc;
}
