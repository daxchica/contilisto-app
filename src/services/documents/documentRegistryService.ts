// ============================================================================
// src/services/documents/documentRegistryService.ts
// CONTILISTO — Document Registry Service
// ============================================================================

import { db } from "@/firebase-config";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
} from "firebase/firestore";
import type { AccountingDocument } from "@/types/AccountingDocument";

const getDocumentsCollection = (entityId: string) =>
  collection(db, "entities", entityId, "documents");

const getDocumentRef = (entityId: string, documentId: string) =>
  doc(db, "entities", entityId, "documents", documentId);

export async function saveAccountingDocument(
  document: AccountingDocument
): Promise<void> {
  if (!document.entityId) {
    throw new Error("saveAccountingDocument: entityId is required");
  }

  if (!document.id) {
    throw new Error("saveAccountingDocument: document.id is required");
  }

  const ref = getDocumentRef(document.entityId, document.id);

  await setDoc(
    ref,
    {
      ...document,
      updatedAt: Date.now(),
      createdAt: document.createdAt ?? Date.now(),
      _serverUpdatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function fetchAccountingDocuments(
  entityId: string
): Promise<AccountingDocument[]> {
  if (!entityId) return [];

  const snap = await getDocs(getDocumentsCollection(entityId));

  return snap.docs.map((d) => d.data() as AccountingDocument);
}

export async function fetchAccountingDocumentsByPeriod(
  entityId: string,
  period: string
): Promise<AccountingDocument[]> {
  if (!entityId || !period) return [];

  const q = query(
    getDocumentsCollection(entityId),
    where("period", "==", period)
  );

  const snap = await getDocs(q);

  return snap.docs.map((d) => d.data() as AccountingDocument);
}

export async function fetchAccountingDocumentById(
  entityId: string,
  documentId: string
): Promise<AccountingDocument | null> {
  if (!entityId || !documentId) return null;

  const snap = await getDoc(getDocumentRef(entityId, documentId));

  if (!snap.exists()) return null;

  return snap.data() as AccountingDocument;
}

export async function linkJournalEntriesToDocument(
  entityId: string,
  documentId: string,
  journalEntryIds: string[]
): Promise<void> {
  if (!entityId || !documentId) {
    throw new Error("linkJournalEntriesToDocument: entityId and documentId are required");
  }

  const ref = getDocumentRef(entityId, documentId);

  await updateDoc(ref, {
    journalEntryIds,
    updatedAt: Date.now(),
    _serverUpdatedAt: serverTimestamp(),
  });
}