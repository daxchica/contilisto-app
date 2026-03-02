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
const getDocsMock = vi.fn(async () => ({ empty: true, docs: [] }));
const writeBatchMock = vi.fn(() => ({
  set: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  commit: vi.fn(async () => undefined),
}));

vi.mock("firebase/firestore", () => ({
  collection: collectionMock,
  doc: docMock,
  getDocs: getDocsMock,
  query: vi.fn((ref: any, ...constraints: any[]) => ({ ref, constraints })),
  where: vi.fn((...args: any[]) => ({ type: "where", args })),
  orderBy: vi.fn((...args: any[]) => ({ type: "orderBy", args })),
  limit: vi.fn((...args: any[]) => ({ type: "limit", args })),
  writeBatch: writeBatchMock,
  serverTimestamp: vi.fn(() => ({ __ts: "server" })),
}));

import { saveJournalEntries } from "@/services/journalService";

describe("journalService guards and integrity", () => {
  beforeEach(() => {
    collectionMock.mockClear();
    docMock.mockClear();
    getDocsMock.mockClear();
    writeBatchMock.mockClear();
  });

  it("rejects unbalanced transactions (debits != credits)", async () => {
    await expect(
      saveJournalEntries(
        "ent-1",
        "user-1",
        [
          {
            transactionId: "tx-1",
            date: "2025-01-01",
            account_code: "101",
            account_name: "Caja",
            debit: 10,
            credit: 0,
          },
          {
            transactionId: "tx-1",
            date: "2025-01-01",
            account_code: "201",
            account_name: "Proveedores",
            debit: 0,
            credit: 5,
          },
        ] as any
      )
    ).rejects.toThrow(/Unbalanced transaction/);
  });

  it("enforces journal entry integrity (min 2 lines + same transactionId)", async () => {
    await expect(
      saveJournalEntries(
        "ent-1",
        "user-1",
        [
          {
            transactionId: "tx-1",
            date: "2025-01-01",
            account_code: "101",
            account_name: "Caja",
            debit: 10,
            credit: 10,
          },
        ] as any
      )
    ).rejects.toThrow(/at least 2 journal lines/i);
  });

  it("writes journal entries under entities/{entityId}/journalEntries", async () => {
    await saveJournalEntries(
      "ent-2",
      "user-2",
      [
        {
          transactionId: "tx-2",
          date: "2025-01-01",
          account_code: "101",
          account_name: "Caja",
          debit: 10,
          credit: 0,
        },
        {
          transactionId: "tx-2",
          date: "2025-01-01",
          account_code: "201",
          account_name: "Proveedores",
          debit: 0,
          credit: 10,
        },
      ] as any
    );

    expect(collectionMock).toHaveBeenCalledWith(
      expect.anything(),
      "entities",
      "ent-2",
      "journalEntries"
    );
  });
});
