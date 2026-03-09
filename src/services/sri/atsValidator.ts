// ============================================================================
// src/services/sri/atsValidator.ts
// CONTILISTO — ATS Validator
// Validates ATS documents before XML generation
// ============================================================================

import type { AtsDocument } from "@/types/atsDocument";
import type {
  AtsValidationIssue,
  AtsValidationResult
} from "@/types/atsValidation";

/* =============================================================================
   HELPERS
============================================================================= */

function isValidRuc(ruc?: string): boolean {

  if (!ruc) return false;

  if (!/^\d{13}$/.test(ruc)) return false;

  return true;

}

function isValidSequential(seq?: string): boolean {

  if (!seq) return false;

  // Accepts formats like:
  // 001-001-000000123
  // 000000123
  return /^(\d{3}-\d{3}-)?\d{3,9}$/.test(seq);

}

function isValidDate(date?: string): boolean {

  if (!date) return false;

  return /^\d{4}-\d{2}-\d{2}$/.test(date);

}

function isNegativeNumber(value?: number) {

  return typeof value === "number" && value < 0;

}

/* =============================================================================
   MAIN VALIDATOR
============================================================================= */

export function validateAtsDocuments(
  docs: AtsDocument[] | undefined
): AtsValidationResult {

  const issues: AtsValidationIssue[] = [];

  if (!Array.isArray(docs) || docs.length === 0) {

    issues.push({
      level: "warning",
      code: "EMPTY_ATS",
      message: "No existen documentos para generar ATS"
    });

    return {
      valid: true,
      issues
    };

  }

  const seenInvoices = new Set<string>();

  for (const doc of docs) {

    const key = `${doc.ruc ?? ""}-${doc.sequential ?? ""}`;

    /* ------------------------------------------------------------------------
       DUPLICATE DETECTION
    ------------------------------------------------------------------------ */

    if (seenInvoices.has(key)) {

      issues.push({
        level: "error",
        code: "DUPLICATE_INVOICE",
        message: `Factura duplicada detectada: ${doc.sequential}`,
        documentId: doc.id
      });

    }

    seenInvoices.add(key);

    /* ------------------------------------------------------------------------
       RUC VALIDATION
    ------------------------------------------------------------------------ */

    if (!doc.ruc) {

      issues.push({
        level: "error",
        code: "MISSING_RUC",
        message: "Documento sin RUC",
        documentId: doc.id
      });

    } else if (!isValidRuc(doc.ruc)) {

      issues.push({
        level: "error",
        code: "INVALID_RUC",
        message: `RUC inválido: ${doc.ruc}`,
        documentId: doc.id
      });

    }

    /* ------------------------------------------------------------------------
       DOCUMENT TYPE
    ------------------------------------------------------------------------ */

    if (!doc.documentType) {

      issues.push({
        level: "error",
        code: "MISSING_DOCUMENT_TYPE",
        message: "Documento sin tipo de comprobante",
        documentId: doc.id
      });

    }

    /* ------------------------------------------------------------------------
       SEQUENTIAL NUMBER
    ------------------------------------------------------------------------ */

    if (!doc.sequential) {

      issues.push({
        level: "error",
        code: "MISSING_SEQUENTIAL",
        message: "Documento sin número secuencial",
        documentId: doc.id
      });

    } else if (!isValidSequential(doc.sequential)) {

      issues.push({
        level: "warning",
        code: "INVALID_SEQUENTIAL",
        message: `Formato de secuencial inusual: ${doc.sequential}`,
        documentId: doc.id
      });

    }

    /* ------------------------------------------------------------------------
       DATE VALIDATION
    ------------------------------------------------------------------------ */

    if (!doc.date) {

      issues.push({
        level: "error",
        code: "MISSING_DATE",
        message: "Documento sin fecha",
        documentId: doc.id
      });

    } else if (!isValidDate(doc.date)) {

      issues.push({
        level: "error",
        code: "INVALID_DATE",
        message: `Fecha inválida: ${doc.date}`,
        documentId: doc.id
      });

    }

    /* ------------------------------------------------------------------------
       AUTHORIZATION NUMBER
    ------------------------------------------------------------------------ */

    if (!doc.authorizationNumber) {

      issues.push({
        level: "warning",
        code: "MISSING_AUTHORIZATION",
        message: "Documento sin número de autorización SRI",
        documentId: doc.id
      });

    }

    /* ------------------------------------------------------------------------
       NEGATIVE VALUES
    ------------------------------------------------------------------------ */

    if (
      isNegativeNumber(doc.base12) ||
      isNegativeNumber(doc.base0) ||
      isNegativeNumber(doc.iva)
    ) {

      issues.push({
        level: "error",
        code: "NEGATIVE_VALUES",
        message: "Valores negativos detectados en el documento",
        documentId: doc.id
      });

    }

    /* ------------------------------------------------------------------------
       IVA CONSISTENCY
    ------------------------------------------------------------------------ */

    if ((doc.base12 ?? 0) > 0 && (doc.iva ?? 0) === 0) {

      issues.push({
        level: "warning",
        code: "IVA_MISSING",
        message: "Base gravada sin IVA asociado",
        documentId: doc.id
      });

    }

  }

  const hasErrors = issues.some(i => i.level === "error");

  return {

    valid: !hasErrors,

    issues

  };

}