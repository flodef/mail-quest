export interface MailAccount {
  id: string;
  label: string;
  color: string;
  imap: { host: string; port: number; secure: boolean; user: string; password: string };
  smtp: { host: string; port: number; secure: boolean; user: string; password: string; from: string };
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

export function getAccount(id: string): MailAccount {
  const acc = getAccounts().find((a) => a.id === id);
  if (!acc) throw new Error(`Unknown account: ${id}`);
  return acc;
}
