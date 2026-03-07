// ============================================================================
// src/services/documents/documentDuplicateService.ts
// CONTILISTO — Duplicate detection for accounting documents
// ============================================================================

import type { AccountingDocument } from "@/types/AccountingDocument";

const normalize = (v?: string) => String(v ?? "").trim().toUpperCase();

export function buildDocumentDuplicateKey(document: Partial<AccountingDocument>): string {
  const entityId = normalize(document.entityId);
  const type = normalize(document.type);
  const ruc = normalize(document.counterpartyRUC);
  const number = normalize(document.documentNumber);
  const auth = normalize(document.authorizationNumber);

  return [entityId, type, ruc, number, auth].join("|");
}

export function findDuplicateDocument(
  documents: AccountingDocument[],
  candidate: Partial<AccountingDocument>
): AccountingDocument | null {
  const key = buildDocumentDuplicateKey(candidate);
  if (!key.replace(/\|/g, "")) return null;

  return (
    documents.find((doc) => buildDocumentDuplicateKey(doc) === key) ?? null
  );
}

export function isDuplicateDocument(
  documents: AccountingDocument[],
  candidate: Partial<AccountingDocument>
): boolean {
  return Boolean(findDuplicateDocument(documents, candidate));
}