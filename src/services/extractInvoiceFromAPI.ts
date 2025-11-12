// src/services/extractInvoiceFromAPI.ts

import type { JournalEntry } from "../types/JournalEntry";
import ECUADOR_COA from "../../shared/coa/ecuador_coa";
import { normalizeEntry, canonicalPair } from "../utils/accountPUCMap";
import { getAccountHint } from "./firestoreHintsService";

/**
 * Extrae los asientos contables desde el endpoint OCR clásico (/api/extractinvoice)
 * usando texto plano y lógica AI basada en prompt.
 */
export async function extractInvoiceFromAPI(
  fullText: string, 
  entityRUC: string,
  entityType: string,
): Promise<JournalEntry[]> {
  const today = new Date().toISOString().slice(0, 10);

  if (!fullText?.trim() || !entityRUC) {
    console.warn("⚠️ extractInvoiceFromAPI recibió valores vacíos:", { 
      fullTextLength: fullText?.length, 
      entityRUC });
    return [];
  }

  // ---------------------------------------------------------
  // 🧩 Helper: normalizar números en cualquier formato
  // ---------------------------------------------------------
  const num = (s?: string): number => {
    if (!s) return 0;
    const cleaned = s
      .replace(/[^\d,.-]/g, "") // eliminar texto no numérico
      .replace(/\s+/g, "")
      .replace(",", ".")
      .trim();
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
  };

  // ---------------------------------------------------------
  // 🔍 Detectar número de factura, totales e IVA
  // ---------------------------------------------------------
  const matchFactura = 
    fullText.match(/\b\d{3}-\d{3}-\d{6,9}\b/) || // Ecuadorian format
  fullText.match(/factura\s*(n[o°:\- ]+)?\s*([0-9\-]+)/i) ||
  fullText.match(/No\.*\s*([0-9\-]+)/i);

  const invoiceNumber = matchFactura ? matchFactura[0] : "";

  // Detect supplier RUC (issuer)
  const matchIssuer = 
    fullText.match(/\bR\.?U\.?C[:\s-]*([0-9]{10,13})\b/i) ||
    fullText.match(/\bRUC[:\s-]*([0-9]{10,13})\b/i);
  const issuerRUC = matchIssuer ? matchIssuer[1] : "";

  // ---------------------------------------------------------
// 🔍 Detect supplier name (razón social o nombre comercial)
// ---------------------------------------------------------

let supplier_name = "";

// 1️⃣ Try to capture text around “Razón Social” or “Nombre Comercial”
const nameRegexes = [
  /RAZ[ÓO]N\s+SOCIAL[:\s-]*([A-ZÁÉÍÓÚÑ0-9&.,\s\-]+)/i,
  /NOMBRE\s+COMERCIAL[:\s-]*([A-ZÁÉÍÓÚÑ0-9&.,\s\-]+)/i,
  /EMPRESA[:\s-]*([A-ZÁÉÍÓÚÑ0-9&.,\s\-]+)/i,
];

// 2️⃣ Run through regex list
for (const r of nameRegexes) {
  const m = fullText.match(r);
  if (m && m[1]) {
    supplier_name = m[1]
      .replace(/\s{2,}/g, " ")
      .replace(/FACTURA.*/i, "") // avoid overlapping with header text
      .trim();
    break;
  }
}

// 3️⃣ If still empty, look for uppercase company-like name before RUC
if (!supplier_name && matchIssuer?.index) {
  const snippet = fullText.slice(Math.max(0, matchIssuer.index - 80), matchIssuer.index);
  const nameGuess = snippet
    .split(/\n|\s{2,}/)
    .map(s => s.trim())
    .filter(s => s.length > 3 && /^[A-ZÁÉÍÓÚÑ0-9\s.&,]+$/.test(s))
    .pop();
  if (nameGuess) supplier_name = nameGuess.trim();
}

// 4️⃣ Clean up residual artifacts
if (supplier_name.length > 80) supplier_name = supplier_name.slice(0, 80).trim();
console.log("🏢 Detected supplier name:", supplier_name);

// ---------------------------------------------------------
// 🧠 Recall supplier→account mapping (Firestore + Local)
// ---------------------------------------------------------
let recalledAccount: { account_code: string; account_name: string } | null = null;

try {
  const hint = await getAccountHint(issuerRUC, supplier_name);
  if (hint) {
    recalledAccount = {
      account_code: hint.account_code,
      account_name: hint.account_name,
    };
    console.log(
      "💡 Recalled supplier→account mapping:",
      supplier_name || issuerRUC,
      "→",
      hint.account_code,
      hint.account_name
    );
  } else {
    // fallback to local cache
    const cachedHints = JSON.parse(localStorage.getItem("accountHintsLocal") || "{}");
    if (issuerRUC && cachedHints[issuerRUC]) recalledAccount = cachedHints[issuerRUC];
    else if (supplier_name && cachedHints[supplier_name]) recalledAccount = cachedHints[supplier_name];
  }
} catch (err) {
  console.warn("⚠️ Error retrieving account hint:", err);
}

// ---------------------------------------------------------
// 🔍 Detectar subtotales, IVA y total (robusto)
// ---------------------------------------------------------

const subtotal15 = 
  num(fullText.match(/SUBTOTAL\s*(?:15|12)%[\s:]*([\d.,]+)/i)?.[1]) || 0;

const subtotal0 = 
  num(fullText.match(/SUBTOTAL\s*0%[\s:]*([\d.,]+)/i)?.[1]) ||
  num(fullText.match(/SUBTOTAL\s*NO\s*OBJETO\s*DE\s*IVA[\s:]*([\d.,]+)/i)?.[1]) ||
  num(fullText.match(/SUBTOTAL\s*SIN\s*IMPUESTOS[\s:]*([\d.,]+)/i)?.[1]) ||
  0;

// Buscar cualquier forma posible de "IVA" seguida de porcentaje y número
const ivaCandidates: number[] = [];

// 1️⃣ Detectar líneas que contengan “IVA” seguido directamente por porcentaje o número
const ivaRegexList = [
  /IVA\s*(?:1[25]%|12%|15%)?[:\-]?\s*([\d.,]+)/gi,
  /([\d.,]+)\s*(?:1[25]%|12%|15%)?\s*IVA/gi,
  /IVA[\s\S]{0,20}?([\d.,]+)/gi,  
];
for (const r of ivaRegexList) {
  for (const m of fullText.matchAll(r)) {
    const n = num(m[1]);
    if (n > 0 && n < 5000) ivaCandidates.push(n);
  }
}
const iva = ivaCandidates.length > 0 ? Math.max(...ivaCandidates) : 0;

// ----- Buscar total -----
const total =
  num(fullText.match(/VALOR\s*TOTAL[\s:]*([\d.,]+)/i)?.[1]) ||
  num(fullText.match(/TOTAL\s*FACTURA[\s:]*([\d.,]+)/i)?.[1]) ||
  num(fullText.match(/TOTAL\s*A\s*PAGAR[\s:]*([\d.,]+)/i)?.[1]) ||
  num(fullText.match(/\bTOTAL[\s:]*([\d.,]+)/i)?.[1]) ||
  0;

  const subtotalBase = 
    subtotal15 + subtotal0 > 0
      ? subtotal15 + subtotal0
      : total > 0 && iva > 0 
      ? total - iva 
      : 0;

  console.log("🧾 Datos detectados localmente:", {
    invoiceNumber,
    subtotal15,
    subtotal0,
    iva,
    subtotalBase,
    total,
  });

  // ---------------------------------------------------------
  // ⚡ STEP 1: If recall found → skip AI extraction
  // ---------------------------------------------------------
  if (recalledAccount) {
    console.log("✅ Using recalled account, skipping AI extraction.");

    const baseAmount =
      subtotalBase > 0 ? subtotalBase : total > 0 && iva > 0 ? total - iva : total;

    const entries: JournalEntry[] = [];

    if (baseAmount > 0.01) {
      entries.push({
        date: today,
        description: `Compra local – ${supplier_name || "Gasto general"}`,
        account_code: recalledAccount.account_code,
        account_name: recalledAccount.account_name,
        debit: baseAmount,
        type: "expense",
        invoice_number: invoiceNumber,
        issuerRUC,
        entityRUC,
        supplier_name,
        source: "learned",
      });
    }

    if (iva > 0.01) {
      entries.push({
        date: today,
        description: "CRÉDITO TRIBUTARIO A FAVOR DE LA EMPRESA (IVA)",
        account_code: "1010501",
        account_name: "CRÉDITO TRIBUTARIO A FAVOR DE LA EMPRESA (IVA)",
        debit: iva,
        type: "expense",
        invoice_number: invoiceNumber,
        issuerRUC,
        entityRUC,
        supplier_name,
        source: "learned",
      });
    }

    const totalToUse = total > 0 ? total : subtotalBase + iva;
    if (totalToUse > 0.01) {
      entries.push({
        date: today,
        description: "Cuenta por pagar proveedor",
        account_code: "201030102",
        account_name: "PROVEEDORES",
        credit: totalToUse,
        type: "expense",
        invoice_number: invoiceNumber,
        issuerRUC,
        entityRUC,
        supplier_name,
        source: "learned",
      });
    }

    return entries.map((e) => normalizeEntry(e));
  }

  // ---------------------------------------------------------
  //  🚀 STEP 2: No recall → use AI extraction
  // ---------------------------------------------------------

  try {
    const response = await fetch("/.netlify/functions/extract-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        fullText, 
        userRUC: entityRUC, 
        entityType,
        issuerRUC ,
        supplier_name,
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      console.error("❌ API error extract-invoice:", response.status, text);
      throw new Error(`API returned status ${response.status}`);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (jsonErr) {
      console.error("⚠️ Error parsing JSON from extract-invoice:", jsonErr);
      console.error("📄 Raw text response:", text.slice(0, 1000));
      throw new Error("Invalid JSON returned from extract-invoice");
    }
    
    // ---------------------------------------------------------
    // 🧮 Transform results to JournalEntry
    // ---------------------------------------------------------
    const parsedEntries: any[] = Array.isArray(parsed?.entries ?? parsed)
      ? (parsed.entries ?? parsed)
      : [];

    const rawEntries: JournalEntry[] = parsedEntries
      .map((r) => 
        coerceOne(
          { ...r, issuerRUC, supplier_name, invoice_number: invoiceNumber },
          "expense", 
          today, 
          entityRUC, 
        )
      )
      .filter((e): e is JournalEntry => e !== null) // 👈 Tipado fuerte
      .map((e) => enforceLevel5(e)!)
      .map((e) => normalizeEntry({ ...e, issuerRUC, entityRUC, supplier_name }));

    /* ✅ Add fallback if AI missed main expense line */
    const hasExpenseDebit = rawEntries.some(
      (e) => e.debit && e.debit > 0 && e.type === "expense"
    );
    if (!hasExpenseDebit) {
      console.warn("🧩 AI missed expense line — adding fallback manually.");
      const baseAmount =
        subtotalBase > 0
          ? subtotalBase
          : total > 0 && iva > 0
          ? total - iva
          : total;
      if (baseAmount > 0.01) {
        const guessed = guessAccountFromDescription(fullText);
        rawEntries.unshift({
          date: today,
          description: `Compra local – ${supplier_name || "Gasto general"}`,
          account_code: guessed.account_code,
          account_name: guessed.account_name,
          debit: baseAmount,
          credit: undefined,
          type: "expense",
          invoice_number: invoiceNumber,
          issuerRUC,
          entityRUC,
          supplier_name,
          source: "ai",
        });
      }
    }

    // ---------------------------------------------------------
    // 🧩 Fallback local si AI no devolvió asientos o omitió IVA
    // ---------------------------------------------------------
    if (
      rawEntries.length === 0 || !rawEntries.some((e) => e.account_code)
    ) {
      console.warn("⚙️ Generando asiento local de respaldo para factura con IVA.");
      const entries: JournalEntry[] = [];

      // 1️⃣  Gasto principal (base imponible)
      const baseAmount =
        subtotalBase > 0
          ? subtotalBase
          : total > 0 && iva > 0
          ? total - iva
          : total;

      if (baseAmount > 0.01) {
        const guessed = guessAccountFromDescription(fullText);
        entries.push({
          date: today,
          description: `Compra local – ${supplier_name || "Gasto general"}`,
          account_code: guessed.account_code,
          account_name: guessed.account_name,
          debit: baseAmount,
          credit: undefined,
          type: "expense",
          invoice_number: invoiceNumber,
          issuerRUC,
          entityRUC,
          supplier_name,
          source: "ai",
        });
      }

      // 2️⃣ IVA Credito Tributario -> Activo Corriente
      if (iva > 0.01) {
        entries.push({
          date: today,
          description: "CRÉDITO TRIBUTARIO A FAVOR DE LA EMPRESA (IVA)",
          account_code: "1010501",
          account_name: "CRÉDITO TRIBUTARIO A FAVOR DE LA EMPRESA (IVA)",
          debit: iva,
          credit: undefined,
          type: "expense",
          invoice_number: invoiceNumber,
          issuerRUC,
          entityRUC,
          supplier_name,
          source: "ai",
        });
      }

      // 3️⃣ Proveedor / CxP
      const totalToUse = total > 0 ? total : subtotalBase + iva;
      if (totalToUse > 0.01) {
        entries.push({
          date: today,
          description: "Cuenta por pagar proveedor",
          account_code: "201030102",
          account_name: "PROVEEDORES",
          debit: undefined,
          credit: totalToUse,
          type: "expense",
          invoice_number: invoiceNumber,
          issuerRUC,
          entityRUC,
          supplier_name,
          source: "ai",
        });
    }

      return entries
        .map((e) => enforceLevel5(e))
        .filter((e): e is JournalEntry => e !== null)
        .map((e) => normalizeEntry(e));
    }

    return rawEntries;
  } catch (err) {
    console.error("❌ Error calling extract-invoice:", err);
    return [];
  }
}

/* --------------------------------------------------------- */
/* 🔧 Helpers */
/* --------------------------------------------------------- */
/**
 * Guess the most likely expense account based on invoice text content.
 */
function guessAccountFromDescription(text: string): { account_code: string; account_name: string } {
  const normalized = text.toLowerCase();
  if (normalized.includes("servicio") || normalized.includes("mantenimiento"))
    return { account_code: "5090101", account_name: "SERVICIOS PROFESIONALES" };
  if (normalized.includes("combustible"))
    return { account_code: "5040102", account_name: "COMBUSTIBLES Y LUBRICANTES" };
  if (normalized.includes("material") || normalized.includes("suministro"))
    return { account_code: "5020102", account_name: "MATERIALES Y SUMINISTROS" };
  return { account_code: "5099901", account_name: "OTROS GASTOS (NIVEL 5)" }; // default
}

function toNum(x: any): number | undefined {
  const n = typeof x === "string" ? parseFloat(x) : x;
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : undefined;
}

/**
 * Transforma un objeto plano recibido desde el backend en un JournalEntry bien tipado.
 */
function coerceOne(
  r: any,
  fallbackType: "expense" | "income",
  fallbackDate: string,
  entityRUC: string,
): JournalEntry | null {
  const debit = toNum(r?.debit);
  const credit = toNum(r?.credit);
  if (!debit && !credit) return null;
  const description = String(r?.description ?? "").slice(0, 300);
  const pair = canonicalPair({ code: r?.account_code ?? "", name: r?.account_name ?? "" });
  // Detectar tipo de asiento: si el emisor es distinto al RUC de la entidad => compra (expense)
  const tipo: "expense" | "income" =
    r?.type === "expense" || r?.type === "income"
      ? r.type
      : r?.issuerRUC && r?.issuerRUC !== entityRUC
      ? "expense"
      : fallbackType;

  return {
    date: r?.date?.slice?.(0, 10) ?? fallbackDate,
    description,
    account_code: (pair as any).code || "",
    account_name: (pair as any).name || "",
    debit: debit && (!credit || debit >= credit) ? debit : undefined,
    credit: credit && (!debit || credit > debit) ? credit : undefined,
    type: tipo,
    invoice_number: r?.invoice_number ?? "",
    source: "ai",
  };
}
/**
 * Ensures every account is a level 5 account (descends using ECUADOR_COA)
 */
function enforceLevel5(entry: JournalEntry | null): JournalEntry | null {
  if (!entry) return null;
  const code = entry.account_code?.trim?.();
  if (!code) return entry;
  if (code.length >= 6) return entry;
  // Find first descendant from ECUADOR_COA
  const descendant = Object.values(ECUADOR_COA).find(
    (acc: any) => acc.code.startsWith(code) && acc.code.length >= 6 && acc.level === 5
  );
  return descendant
    ? { ...entry, account_code: descendant.code, account_name: descendant.name }
    : entry;
}

function buildLocalFallbackEntries(args: any): JournalEntry[] {
  const {
    today,
    supplier_name,
    invoiceNumber,
    issuerRUC,
    entityRUC,
    subtotalBase,
    iva,
    total,
    fullText,
  } = args;
  const entries: JournalEntry[] = [];
  const base = subtotalBase > 0 ? subtotalBase : total > 0 && iva > 0 ? total - iva : total;
  if (base > 0.01) {
    const guessed = guessAccountFromDescription(fullText);
    entries.push({
      date: today,
      description: `Compra local – ${supplier_name || "Gasto general"}`,
      account_code: guessed.account_code,
      account_name: guessed.account_name,
      debit: base,
      type: "expense",
      invoice_number: invoiceNumber,
      issuerRUC,
      entityRUC,
      supplier_name,
      source: "ai",
    } as JournalEntry);
  }
  if (iva > 0.01) {
    entries.push({
      date: today,
      description: "CRÉDITO TRIBUTARIO A FAVOR DE LA EMPRESA (IVA)",
      account_code: "1010501",
      account_name: "CRÉDITO TRIBUTARIO A FAVOR DE LA EMPRESA (IVA)",
      debit: iva,
      type: "expense",
      invoice_number: invoiceNumber,
      issuerRUC,
      entityRUC,
      supplier_name,
      source: "ai",
    } as JournalEntry);
  }
  const totalToUse = total > 0 ? total : subtotalBase + iva;
  if (totalToUse > 0.01) {
    entries.push({
      date: today,
      description: "Cuenta por pagar proveedor",
      account_code: "201030102",
      account_name: "PROVEEDORES",
      credit: totalToUse,
      type: "expense",
      invoice_number: invoiceNumber,
      issuerRUC,
      entityRUC,
      supplier_name,
      source: "ai",
    } as JournalEntry);
  }
  return entries.map((e) => normalizeEntry(e));
}