// ============================================================================
// src/utils/buildRetentionJournalEntries.ts
// CONTILISTO — Build journal entries for a received retention certificate
//
// Journal structure (retención recibida de cliente):
//   DR  Retención IR  por recuperar  (1130201xx)  — ONE LINE PER IR retention
//   DR  Retención IVA por recuperar  (1130202xx)  — one line for IVA total
//   CR  Cuentas por Cobrar           (receivable) — total of all retentions
//
// Each IR retention line has its own journal row so the amounts in the
// journal match the "Valor Retenido" column in the retention certificate.
// ============================================================================

import { v4 as uuidv4 } from "uuid";
import type { Account } from "@/types/AccountTypes";
import type { JournalEntry } from "@/types/JournalEntry";
import type { SriRetXmlResult } from "@/utils/parseSriRetXml";
import type { Receivable } from "@/types/Receivable";

const n2 = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

/** Find an account by normalized code prefix. Returns the best match:
 *  prefers exact postable leaf accounts over parent/summary accounts. */
function resolveAccount(
  accounts: Account[],
  prefix: string,
  fallbackName: string,
): { code: string; name: string } {
  const norm  = (c: string) => c.replace(/\./g, "").trim();
  const pfx   = norm(prefix);

  // Sort matches so longer (more specific) codes come first — avoids matching
  // a broad parent code like 1010303 when we want 101030101.
  const matches = accounts
    .filter((a) => norm(a.code ?? "").startsWith(pfx))
    .sort((a, b) => norm(b.code).length - norm(a.code).length);

  const found = matches[0];
  return found
    ? { code: norm(found.code), name: found.name }
    : { code: pfx, name: fallbackName };
}

/** Resolve Cuentas por Cobrar account.
 *  Priority: receivable.account_code → 101030101 → 1010301 → 101030 */
function resolveARAccount(
  accounts: Account[],
  receivable: Receivable | null,
): { code: string; name: string } {
  if (receivable?.account_code) {
    return {
      code: receivable.account_code.replace(/\./g, ""),
      name: receivable.account_name ?? "Cuentas por Cobrar",
    };
  }
  // Prefer the most specific customer-receivable prefix
  for (const pfx of ["1010301", "10103010", "101030101", "101030"]) {
    const norm = (c: string) => c.replace(/\./g, "").trim();
    const match = accounts
      .filter((a) => {
        const code = norm(a.code ?? "");
        // Exclude bad-debt / provision accounts (typically ending in 03 at NEC level 4)
        return code.startsWith(norm(pfx)) && !/provision|incobrabl/i.test(a.name ?? "");
      })
      .sort((a, b) => norm(b.code).length - norm(a.code).length)[0];

    if (match) return { code: norm(match.code), name: match.name };
  }
  return { code: "101030101", name: "Clientes Nacionales" };
}

// ── main builder ──────────────────────────────────────────────────────────────

export interface RetentionJournalResult {
  entries:    JournalEntry[];
  receivable: Receivable | null;
}

export function buildRetentionJournalEntries(
  entityId:           string,
  userId:             string,
  retention:          SriRetXmlResult,
  accounts:           Account[],
  receivable:         Receivable | null,
  date?:              string,
  /** Explicit CxC account found by querying the original sale journal entry */
  arAccountOverride?: { code: string; name: string } | null,
): RetentionJournalResult {

  const tx        = uuidv4();
  const entryDate = date
    || retention.issueDate
    || retention.authDate
    || new Date().toISOString().slice(0, 10);

  const certNum    = retention.certNumber ?? "";

  // The original sales invoice number (shown on every data row)
  const invoiceNum = retention.retentions.find((r) => r.invoiceNumber)?.invoiceNumber ?? "";

  const rentaLines = retention.retentions.filter((r) => r.taxCode === "1");
  const ivaLines   = retention.retentions.filter((r) => r.taxCode === "2");

  const totalRenta = n2(rentaLines.reduce((s, l) => s + n2(l.retainedAmount), 0));
  const totalIVA   = n2(ivaLines.reduce((s, l)   => s + n2(l.retainedAmount), 0));
  const totalAll   = n2(totalRenta + totalIVA);

  const irAcc  = resolveAccount(accounts, "1130201", "Retención IR por recuperar");
  const ivaAcc = resolveAccount(accounts, "1130202", "Retención IVA por recuperar");

  // Priority: 1) explicit override from journal lookup, 2) receivable record, 3) COA fallback
  const arAcc  = arAccountOverride ?? resolveARAccount(accounts, receivable);

  const base: Omit<JournalEntry, "account_code" | "account_name" | "debit" | "credit" | "description"> = {
    entityId,
    uid:             userId,
    transactionId:   tx,
    date:            entryDate,
    transactionType: "payment",
    documentNature:  "sale",
    // Each data row shows the original invoice number (what was paid)
    invoice_number:  invoiceNum,
    // The retention cert number goes in documentRef — the JournalTable group
    // header shows documentRef (when present) so the cert number appears there
    documentRef:     certNum || undefined,
    customer_ruc:    retention.issuerRUC,
    customer_name:   retention.issuerName,
    source:          "manual",
  };

  const entries: JournalEntry[] = [];

  // ── DR Retención IR — one line per retention row ─────────────────────────
  // Each line in the certificate ("Valor Retenido") becomes its own journal
  // entry so the amounts visible in the modal exactly match the certificate.
  for (const line of rentaLines) {
    const amt = n2(line.retainedAmount);
    if (amt <= 0) continue;

    entries.push({
      ...base,
      account_code: irAcc.code,
      account_name: irAcc.name,
      debit:  amt,
      credit: 0,
      description: `Ret. IR ${line.percentage}% ret. ${certNum}${invoiceNum ? ` — fact. ${invoiceNum}` : ""}`,
      tax: {
        retenciones: [{
          taxType:    "RENTA" as const,
          code:       line.retentionCode,
          percentage: n2(line.percentage),
          base:       n2(line.baseAmount),
          amount:     amt,
        }],
      },
    });
  }

  // ── DR Retención IVA ─────────────────────────────────────────────────────
  for (const line of ivaLines) {
    const amt = n2(line.retainedAmount);
    if (amt <= 0) continue;

    entries.push({
      ...base,
      account_code: ivaAcc.code,
      account_name: ivaAcc.name,
      debit:  amt,
      credit: 0,
      description: `Ret. IVA ${line.percentage}% ret. ${certNum}${invoiceNum ? ` — fact. ${invoiceNum}` : ""}`,
      tax: {
        retenciones: [{
          taxType:    "IVA" as const,
          code:       line.retentionCode,
          percentage: n2(line.percentage),
          base:       n2(line.baseAmount),
          amount:     amt,
        }],
      },
    });
  }

  // ── CR Cuentas por Cobrar (single balancing credit) ──────────────────────
  if (totalAll > 0) {
    entries.push({
      ...base,
      account_code: arAcc.code,
      account_name: arAcc.name,
      debit:  0,
      credit: totalAll,
      description: `Cobro ret. ${certNum}${invoiceNum ? ` — fact. ${invoiceNum}` : ""}`,
    });
  }

  return { entries, receivable };
}
