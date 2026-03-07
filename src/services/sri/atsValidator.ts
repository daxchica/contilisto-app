// ============================================================================
// src/services/sri/atsValidator.ts
// Validates ATS documents before XML generation
// ============================================================================

import { AtsDocument } from "@/types/atsDocument";
import {
  AtsValidationIssue,
  AtsValidationResult
} from "@/types/atsValidation";

export function validateAtsDocuments(
  docs: AtsDocument[]
): AtsValidationResult {

  const issues: AtsValidationIssue[] = [];

  const seenInvoices = new Set<string>();

  for (const doc of docs) {

    const key = `${doc.ruc}-${doc.sequential}`;

    // --------------------------------------------------
    // Duplicate invoice detection
    // --------------------------------------------------

    if (seenInvoices.has(key)) {

      issues.push({
        level: "error",
        code: "DUPLICATE_INVOICE",
        message: `Factura duplicada detectada: ${doc.sequential}`,
        documentId: doc.id
      });

    }

    seenInvoices.add(key);

    // --------------------------------------------------
    // Missing RUC
    // --------------------------------------------------

    if (!doc.ruc || doc.ruc.length < 10) {

      issues.push({
        level: "error",
        code: "MISSING_RUC",
        message: "Documento sin RUC válido",
        documentId: doc.id
      });

    }

    // --------------------------------------------------
    // Missing document type
    // --------------------------------------------------

    if (!doc.documentType) {

      issues.push({
        level: "error",
        code: "MISSING_DOCUMENT_TYPE",
        message: "Documento sin tipo de comprobante",
        documentId: doc.id
      });

    }

    // --------------------------------------------------
    // Missing authorization number
    // --------------------------------------------------

    if (!doc.authorizationNumber) {

      issues.push({
        level: "warning",
        code: "MISSING_AUTHORIZATION",
        message: "Documento sin número de autorización SRI",
        documentId: doc.id
      });

    }

    // --------------------------------------------------
    // Negative totals
    // --------------------------------------------------

    if (doc.base12 < 0 || doc.base0 < 0 || doc.iva < 0) {

      issues.push({
        level: "error",
        code: "NEGATIVE_VALUES",
        message: "Valores negativos detectados en el documento",
        documentId: doc.id
      });

    }

    // --------------------------------------------------
    // IVA consistency
    // --------------------------------------------------

    if (doc.base12 > 0 && doc.iva === 0) {

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