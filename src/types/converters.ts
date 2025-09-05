// src/types/converters.ts
import { FirestoreDataConverter, QueryDocumentSnapshot } from "firebase/firestore";
import type { JournalEntry } from "./JournalEntry";

export const journalEntryConverter: FirestoreDataConverter<JournalEntry> = {
  toFirestore: (e) => e,
  fromFirestore: (snap: QueryDocumentSnapshot): JournalEntry => {
    const data = snap.data() as JournalEntry;
    return { id: snap.id, ...data };
  },
};