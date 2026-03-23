// ============================================================================
// src/services/bankService.ts
import type { BankMovement } from "@/types/bankTypes";
import { fetchBankMovements } from "@/services/bankMovementService";

export async function fetchBankMovementsForEntity(
  entityId: string,
  bankAccountId?: string,
  from?: string,
  to?: string
): Promise<BankMovement[]> {
  if (!entityId?.trim()) {
    throw new Error("entityId es requerido");
  }

  return fetchBankMovements(
    entityId.trim(),
    bankAccountId,
    from,
    to
  );
}