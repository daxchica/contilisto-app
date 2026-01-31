// ============================================================================
// src/services/receivablesService.ts
// Accounts Receivable — CONTILISTO v1.0 (MIRROR of payablesService.ts) + SAFE ANNULMENT
// ============================================================================

import { db } from "@/firebase-config";
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";

import type { Receivable, ReceivableStatus } from "@/types/Receivable";
import type { JournalEntry } from "@/types/JournalEntry";

import {
  applyPaymentToInstallments,
  buildInstallmentSchedule,
} from "@/utils/payable"; // ✅ reuse same installment utilities (they are generic)

import {
  fetchJournalEntriesByTransactionId,
  saveJournalEntries,
  annulInvoiceByTransaction,
} from "./journalService";

import { deleteBankMovementsByJournalTransactionId } from "./bankMovementService";

/* ============================================================================
 * HELPERS
 * ========================================================================== */

const n2 = (x: any) =>
  Number.isFinite(Number(x)) ? Number(Number(x).toFixed(2)) : 0;

const normAcc = (c?: string) => (c || "").replace(/\./g, "").trim();

// Ecuador "Consumidor Final" (SRI): 9999999999999
const CONSUMIDOR_FINAL_ID = "9999999999999";
const CONSUMIDOR_FINAL_NAME = "CONSUMIDOR FINAL";

/**
 * Ecuador COA typical:
 * - 113... = Cuentas por Cobrar
 * - 114... = CxC relacionadas (optional)
 */
const RECEIVABLE_PREFIXES = ["1020901", "113", "1301"];

function extractCustomerNameFromDescription(desc?: string): string | null {
  if (!desc) return null;

  // Matches: "Cliente: AGENSITUR SA"
  const m = desc.match(/cliente\s*:\s*(.+)$/i);
  if (!m) return null;
  return m[1].trim();
}

/**
 * Prefer consistent customer names to avoid duplicates in reporting.
 * (Optional but safe: only normalizes whitespace + uppercases)
 */
function normalizeCustomerName(name: string) {
  return name.replace(/\s+/g, " ").trim().toUpperCase();
}

/**
 * Finds the receivable control line in a transaction journal.
 * Rule: Receivable control lives on DEBIT side for customer receivable accounts.
 */
function findReceivableControlLine(entries: JournalEntry[]) {
  return entries.find(
    (e) =>
      RECEIVABLE_PREFIXES.some((p) => normAcc(e.account_code).startsWith(p)) &&
      n2(e.debit) > 0
  );
}

function assertReceivableAccount(account_code?: string) {
  const c = normAcc(account_code);
  if (!c) throw new Error("Receivable requiere cuenta contable");

  if (!RECEIVABLE_PREFIXES.some((p) => c.startsWith(p))) {
    throw new Error(`Cuenta inválida para CxC: ${account_code}`);
  }
}

function assertTransactionId(tx: unknown): asserts tx is string {
  if (typeof tx !== "string" || !tx.trim()) {
    throw new Error("Receivable inválido: falta transactionId");
  }
}

function assertInvoiceInvariant(
  receivable: Pick<Receivable, "invoiceNumber" | "issueDate">
) {
  if (!receivable.invoiceNumber?.trim()) {
    throw new Error("Receivable requiere número de factura");
  }
  if (!receivable.issueDate?.trim()) {
    throw new Error("Receivable requiere fecha de emisión");
  }
}

function assertNotAnnulled(r: Pick<Receivable, "status">) {
  if ((r.status as any) === "annulled") {
    throw new Error("No permitido: la factura está anulada");
  }
}

function computeStatus(paid: number, total: number) {
  const balance = n2(total - paid);
  if (balance <= 0) return { balance, status: "paid" as ReceivableStatus };
  if (paid > 0) return { balance, status: "partial" as ReceivableStatus };
  return { balance, status: "pending" as ReceivableStatus };
}

/* ============================================================================
 * FETCH (by transactionId)
 * ========================================================================== */

export async function fetchReceivableByTransactionId(
  entityId: string,
  transactionId: string
): Promise<Receivable | null> {
  if (!entityId || !transactionId) return null;

  const ref = doc(db, "entities", entityId, "receivables", transactionId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  return { id: snap.id, ...(snap.data() as Receivable) };
}

/* ============================================================================
 * FETCH RECEIVABLES
 * ========================================================================== */

export async function fetchReceivables(entityId: string): Promise<Receivable[]> {
  if (!entityId) return [];

  const colRef = collection(db, "entities", entityId, "receivables");
  const qRef = query(colRef, orderBy("issueDate", "desc"));

  const snap = await getDocs(qRef);

  return snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({
    id: d.id,
    ...(d.data() as Receivable),
  }));
}

/* ============================================================================
 * UPSERT RECEIVABLE
 * ========================================================================== */

export async function upsertReceivable(
  entityId: string,
  receivable: Omit<
    Receivable,
    "id" | "entityId" | "status" | "balance" | "createdAt" | "updatedAt"
  >
) {
  assertTransactionId(receivable.transactionId);
  assertReceivableAccount(receivable.account_code);
  assertInvoiceInvariant(receivable);

  const tx = receivable.transactionId;
  const ref = doc(db, "entities", entityId, "receivables", tx);
  const snap = await getDoc(ref);

  const existing = snap.exists() ? (snap.data() as Receivable) : null;
  if (existing) assertNotAnnulled(existing);

  const paid = n2((receivable as any).paid ?? existing?.paid ?? 0);
  const total = n2((receivable as any).total ?? existing?.total ?? 0);

  if (total <= 0) throw new Error("Receivable requiere total > 0");
  if (paid < 0 || paid > total) throw new Error("Monto cobrado inválido");

  // ------------------------------------------------------------------
  // 🔎 Resolve customer identity from journal (source of truth)
  // ------------------------------------------------------------------

  // Receivable type uses camelCase (customerName/customerRUC).
  let customerName = (receivable as any).customerName as string | undefined;
  let customerRUC = (receivable as any).customerRUC as string | undefined;

  // Also accept legacy snake_case if any caller still passes it
  customerName =
    customerName || String((receivable as any).customer_name ?? "").trim() || "";
  customerRUC =
    customerRUC || String((receivable as any).customer_ruc ?? "").trim() || "";

  let customerSource: "payload" | "journal_control" | "description" | "default" =
    customerName && customerRUC ? "payload" : "default";

  if (!customerName || !customerRUC) {
    const journalEntries = await fetchJournalEntriesByTransactionId(entityId, tx);
    const control = findReceivableControlLine(journalEntries);

    // Try to read identity from the control line first (support both casings)
    const fromControlName =
      String((control as any)?.customer_name ?? (control as any)?.customerName ?? "")
        .trim();
    const fromControlRuc =
      String((control as any)?.customer_ruc ?? (control as any)?.customerRUC ?? "")
        .trim();

    // If not present, attempt from description
    const fromDescName = extractCustomerNameFromDescription(control?.description);

    if (!customerName) {
      if (fromControlName) {
        customerName = fromControlName;
        customerSource = "journal_control";
      } else if (fromDescName) {
        customerName = fromDescName;
        customerSource = "description";
      }
    }

    if (!customerRUC) {
      if (fromControlRuc) {
        customerRUC = fromControlRuc;
        customerSource = customerSource === "default" ? "journal_control" : customerSource;
      }
    }

    // Final fallback: consumidor final (pair them)
    if (!customerName && !customerRUC) {
      customerName = CONSUMIDOR_FINAL_NAME;
      customerRUC = CONSUMIDOR_FINAL_ID;
      customerSource = "default";
    } else {
      // If one side is missing, force consistent pairing rules
      if (!customerName) customerName = CONSUMIDOR_FINAL_NAME;
      if (!customerRUC) customerRUC = CONSUMIDOR_FINAL_ID;
      customerSource = customerSource === "default" ? "default" : customerSource;
    }
  }

  customerName = normalizeCustomerName(customerName);

  // 🔒 HARD invariant: customer identity must exist
  if (!customerName?.trim() || !customerRUC?.trim()) {
    throw new Error(`Receivable ${tx} missing customer identity after resolution`);
  }

  const { balance, status } = computeStatus(paid, total);

  const payload: any = {
    ...(existing ? existing : {}),
    ...receivable,

    customer_name: customerName,
    customer_ruc: customerRUC,
    
    customerName,
    customerRUC,

    customerSource,

    entityId,
    paid,
    total,
    balance,
    status,
    installmentSchedule:
      (receivable as any).installmentSchedule ??
      existing?.installmentSchedule ??
      buildInstallmentSchedule(
        total,
        receivable.issueDate,
        receivable.termsDays,
        receivable.installments
      ),
    updatedAt: serverTimestamp(),
    ...(existing ? {} : { createdAt: serverTimestamp() }),
  };

  // 🔒 Never allow caller to override createdAt accidentally
  delete payload.createdAt;

  await setDoc(ref, payload, { merge: true });
}

/* ============================================================================
 * APPLY COLLECTION (PAYMENT RECEIVED)
 * ========================================================================== */

export async function applyReceivableCollection(
  entityId: string,
  receivable: Receivable,
  amount: number
) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Monto de cobro inválido");
  }

  if (!receivable?.id) throw new Error("Receivable inválido (id faltante)");

  const ref = doc(db, "entities", entityId, "receivables", receivable.id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Receivable no existe");

  const current = snap.data() as Receivable;

  assertNotAnnulled(current);
  assertTransactionId(current.transactionId);
  assertReceivableAccount(current.account_code);

  const paidNow = n2(current.paid);
  const total = n2(current.total);
  const { balance } = computeStatus(paidNow, total);

  if (amount > balance) throw new Error("El monto excede el saldo pendiente");

  let paidDelta = amount;
  let schedule = current.installmentSchedule ?? [];

  if (schedule.length) {
    const res = applyPaymentToInstallments(schedule, amount);
    schedule = res.updatedSchedule;
    paidDelta = res.paidDelta;
  }

  const paid = n2(paidNow + paidDelta);
  const next = computeStatus(paid, total);

  await updateDoc(ref, {
    installmentSchedule: schedule,
    paid,
    balance: next.balance,
    status: next.status,
    updatedAt: serverTimestamp(),
  });
}

/* ============================================================================
 * REPAIR LEGACY RECEIVABLE (NO account_code)
 * ========================================================================== */

export async function repairReceivableAccountFromJournal(
  entityId: string,
  receivableId: string
) {
  const ref = doc(db, "entities", entityId, "receivables", receivableId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Receivable no existe");

  const receivable = snap.data() as Receivable;

  assertNotAnnulled(receivable);
  assertTransactionId(receivable.transactionId);

  if (receivable.account_code) return receivable;

  if (n2(receivable.paid) > 0) {
    throw new Error("No se puede reparar un receivable con cobros registrados");
  }

  const entries = await fetchJournalEntriesByTransactionId(
    entityId,
    receivable.transactionId
  );

  const candidates = entries.filter((e) => {
    const c = normAcc(e.account_code);
    return RECEIVABLE_PREFIXES.some((p) => c.startsWith(p)) && n2(e.debit) > 0;
  });

  if (candidates.length !== 1) {
    throw new Error("Asiento ambiguo o inválido para reparación");
  }

  const picked = candidates[0];
  assertReceivableAccount(picked.account_code);

  await updateDoc(ref, {
    account_code: picked.account_code,
    account_name: picked.account_name,
    updatedAt: serverTimestamp(),
  });

  return picked;
}

/* ============================================================================
 * UPDATE RECEIVABLE TERMS
 * ========================================================================== */

export async function updateReceivableTerms(
  entityId: string,
  receivableId: string,
  termsDays: number,
  installments: number
) {
  if (!entityId) throw new Error("entityId requerido");
  if (!receivableId) throw new Error("receivableId requerido");

  if (!Number.isInteger(termsDays) || termsDays < 0) {
    throw new Error("Plazo de días inválido");
  }
  if (!Number.isInteger(installments) || installments < 1) {
    throw new Error("Número de cuotas inválido");
  }

  const ref = doc(db, "entities", entityId, "receivables", receivableId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Receivable no existe");

  const current = snap.data() as Receivable;

  assertNotAnnulled(current);

  if (n2(current.paid) > 0) {
    throw new Error(
      "No se pueden modificar los plazos de un receivable con cobros registrados"
    );
  }

  assertTransactionId(current.transactionId);
  assertReceivableAccount(current.account_code);
  assertInvoiceInvariant(current);

  const total = n2(current.total);
  if (total <= 0) throw new Error("Total inválido");

  const installmentSchedule = buildInstallmentSchedule(
    total,
    current.issueDate,
    termsDays,
    installments
  );

  await updateDoc(ref, {
    termsDays,
    installments,
    installmentSchedule,
    balance: total,
    status: "pending",
    updatedAt: serverTimestamp(),
  });
}

/* ============================================================================
 * SAFE ANNULMENT (NO DELETE) — SALES INVOICE
 * Creates reversal journal and marks receivable as "annulled"
 * ========================================================================== */

export async function annulReceivableInvoice(
  entityId: string,
  receivableId: string,
  userId: string,
  reason = "Anulación de factura"
) {
  if (!entityId) throw new Error("entityId requerido");
  if (!receivableId) throw new Error("receivableId requerido");
  if (!userId) throw new Error("userId requerido");

  const ref = doc(db, "entities", entityId, "receivables", receivableId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Receivable no existe");

  const r = snap.data() as Receivable;

  if ((r.status as any) === "annulled") {
    throw new Error("La factura ya está anulada");
  }

  if (n2(r.paid) > 0) {
    throw new Error("No se puede anular: la factura tiene cobros registrados");
  }

  assertTransactionId(r.transactionId);

  const original = await fetchJournalEntriesByTransactionId(
    entityId,
    r.transactionId
  );

  if (!original.length) {
    throw new Error("No se encontraron asientos contables de la factura");
  }

  const today = new Date().toISOString().slice(0, 10);
  const reversalTx = doc(collection(db, "entities", entityId, "journalEntries")).id;

  const reversal: JournalEntry[] = original.map((e) => ({
    entityId,
    transactionId: reversalTx,
    date: today as any,
    account_code: e.account_code,
    account_name: e.account_name,
    debit: n2(e.credit),
    credit: n2(e.debit),
    invoice_number: e.invoice_number,
    description: `ANULACIÓN — ${e.description || `Factura ${e.invoice_number}`}`,
    source: "manual_journal" as any,
  }));

  await saveJournalEntries(entityId, reversal, userId);

  await updateDoc(ref, {
    status: "annulled" as any,
    balance: 0,
    updatedAt: serverTimestamp(),
    annulledAt: serverTimestamp() as any,
    annulledBy: userId,
    annulmentTransactionId: reversalTx,
    annulmentReason: reason,
  });

  return { annulmentTransactionId: reversalTx };
}

/* ============================================================================
 * DELETE RECEIVABLE (CASCADE) — DEV ONLY
 * IMPORTANT: In production, prefer annulReceivableInvoice instead.
 * ========================================================================== */

async function deleteReceivable(entityId: string, receivableId: string) {
  await deleteDoc(doc(db, "entities", entityId, "receivables", receivableId));
}

async function fetchCollectionsForReceivable(
  entityId: string,
  receivableId: string
): Promise<{ transactionId: string }[]> {
  const ref = doc(db, "entities", entityId, "receivables", receivableId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];

  const receivable = snap.data() as any;
  const txs: string[] = Array.isArray(receivable.collectionTransactionIds)
    ? receivable.collectionTransactionIds.filter(
        (x: any) => typeof x === "string" && x.trim()
      )
    : [];

  return txs.map((transactionId) => ({ transactionId }));
}

export async function deleteReceivableCascade(
  entityId: string,
  transactionId: string
) {
  const receivable = await fetchReceivableByTransactionId(entityId, transactionId);
  if (!receivable) return;

  if (!receivable.id) {
    throw new Error("Receivable inválido: falta id");
  }

  const collections = await fetchCollectionsForReceivable(entityId, receivable.id);

  for (const c of collections) {
    if (!c.transactionId) continue;

    await annulInvoiceByTransaction(entityId, c.transactionId);
  }

  await deleteReceivable(entityId, receivable.id);
}