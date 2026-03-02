import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/firebase-config", () => ({
  db: { __mock: "db" },
}));

const collectionMock = vi.fn((db: any, ...path: string[]) => ({ db, path }));
const docMock = vi.fn((refOrDb: any, ...rest: string[]) => {
  if (refOrDb && refOrDb.path) {
    const id = rest[0] ?? "auto-id";
    return { path: [...refOrDb.path, id], id };
  }
  const id = rest[rest.length - 1] ?? "auto-id";
  return { path: rest, id };
});
const updateDocMock = vi.fn(async () => undefined);
const addDocMock = vi.fn(async (ref: any, data: any) => ({ id: "new-id", ref, data }));

vi.mock("firebase/firestore", () => ({
  collection: collectionMock,
  doc: docMock,
  updateDoc: updateDocMock,
  addDoc: addDocMock,
  getDoc: vi.fn(async () => ({ exists: () => true, data: () => ({}) })),
  serverTimestamp: vi.fn(() => ({ __ts: "server" })),
}));

import { createBankMovement, linkJournalTransaction } from "@/services/bankMovementService";

describe("bankMovementService linking + entity scoping", () => {
  beforeEach(() => {
    collectionMock.mockClear();
    docMock.mockClear();
    updateDocMock.mockClear();
    addDocMock.mockClear();
  });

  it("links a bank movement to a journal transaction", async () => {
    await linkJournalTransaction("ent-1", "mov-1", "tx-1");

    expect(docMock).toHaveBeenCalledWith(
      expect.anything(),
      "entities",
      "ent-1",
      "bankMovements",
      "mov-1"
    );
    expect(updateDocMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        relatedJournalTransactionId: "tx-1",
      })
    );
  });

  it("creates bank movements under entities/{entityId}/bankMovements", async () => {
    await createBankMovement({
      entityId: "ent-2",
      bankAccountId: "bank-1",
      date: "2025-01-01",
      amount: 100,
      type: "in",
      description: "Ingreso",
    } as any);

    expect(collectionMock).toHaveBeenCalledWith(
      expect.anything(),
      "entities",
      "ent-2",
      "bankMovements"
    );
  });
});
