// ============================================================================
// src/services/bankService.ts
// ---------------------------------------------------------------------------
// Compatibility wrapper for Bank Movements
//
// NOTE:
// - This file exists ONLY to avoid breaking legacy imports.
// - All real logic lives in bankMovementService.ts
// - Do NOT add Firestore queries here.
// ============================================================================

import type { BankMovement } from "./bankMovementService";
import { fetchBankMovements } from "./bankMovementService";

/**
 * Fetch bank movements for an entity.
 *
 * USER-FACING (Spanish):
 * - Obtiene los movimientos del Libro Bancos ordenados por fecha.
 */
export async function fetchBankMovementsForEntity(
  entityId: string,
  from?: string,
  to?: string
): Promise<BankMovement[]> {
  return fetchBankMovements(entityId, from, to);
}