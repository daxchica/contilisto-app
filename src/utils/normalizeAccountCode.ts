export type AccountCodeLike =
  | null
  | undefined
  | {
      account_code?: string;
      accountCode?: string;
    };

export function normalizeAccountCode(value: AccountCodeLike): string {
  if (!value) return "";

  const raw = value.account_code ?? value.accountCode ?? "";
  return String(raw).trim();
}
