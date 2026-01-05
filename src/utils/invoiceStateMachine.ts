// src/utils/invoiceStateMachine.ts
import type { InvoiceStatus } from "@/types/InvoiceStatus";

/**
 * SRI-compliant invoice lifecycle
 */
const transitions: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ["pending-sign", "cancelled"],
  "pending-sign": ["signed", "cancelled"],
  signed: ["sent-sri", "cancelled"],
  "sent-sri": ["authorized", "rejected"],
    authorized: [],
    rejected: [],
    cancelled: [],
    voided: []    // legacy / alias (optional)
};

export function canTransition(
  from: InvoiceStatus,
  to: InvoiceStatus
): boolean {
  return transitions[from]?.includes(to) ?? false;
}