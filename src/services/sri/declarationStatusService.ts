// ============================================================================
// src/services/sri/declarationStatusService.ts
// CONTILISTO — Tax Declaration Status Engine
// ============================================================================

import type { JournalEntry } from "@/types/JournalEntry";
import type { DeclarationStatus } from "@/types/sri/declarationStatus";

export function getDeclarationStatuses(
  entries: JournalEntry[] | undefined,
  entityId: string,
  period: string
): DeclarationStatus[] {

  if (!entries?.length) {
    return [
      {
        module: "iva104",
        status: "pending",
        message: "No existen movimientos contables"
      },
      {
        module: "ret103",
        status: "pending",
        message: "No existen movimientos contables"
      },
      {
        module: "ats",
        status: "pending",
        message: "No existen facturas registradas"
      }
    ];
  }

  // ----------------------------------------------------
  // Filter entries by entity + period
  // ----------------------------------------------------

  const periodEntries = entries.filter(e =>
    true &&
    e.date &&
    e.date.startsWith(period)
  );

  if (!periodEntries.length) {
    return [
      {
        module: "iva104",
        status: "pending",
        message: "No existen movimientos en el periodo"
      },
      {
        module: "ret103",
        status: "pending",
        message: "No existen retenciones en el periodo"
      },
      {
        module: "ats",
        status: "pending",
        message: "No existen facturas registradas"
      }
    ];
  }

  // ----------------------------------------------------
  // Detect accounting activity
  // ----------------------------------------------------

  let hasSales = false;
  let hasPurchases = false;
  let hasRetentions = false;
  let hasIVA = false;

  for (const e of periodEntries) {

    const code = e.account_code ?? "";

    if (!hasSales && code.startsWith("4")) {
      hasSales = true;
    }

    if (!hasPurchases && code.startsWith("6")) {
      hasPurchases = true;
    }

    if (!hasRetentions && (
      code.startsWith("213") ||
      code.startsWith("133")
    )) {
      hasRetentions = true;
    }

    if (!hasIVA && (
      code.startsWith("2010201") ||
      code.startsWith("13301")
    )) {
      hasIVA = true;
    }

    if (hasSales && hasPurchases && hasRetentions && hasIVA) {
      break;
    }
  }

  // ----------------------------------------------------
  // IVA 104 Status
  // ----------------------------------------------------

  const ivaStatus: DeclarationStatus = !hasIVA
    ? {
        module: "iva104",
        status: "pending",
        message: "No se detectaron movimientos de IVA"
      }
    : {
        module: "iva104",
        status: "ready",
        message: "Listo para generar formulario 104"
      };

  // ----------------------------------------------------
  // RETENCIONES 103
  // ----------------------------------------------------

  const retStatus: DeclarationStatus = hasRetentions
    ? {
        module: "ret103",
        status: "ready",
        message: "Retenciones detectadas"
      }
    : {
        module: "ret103",
        status: "pending",
        message: "No existen retenciones en el periodo"
      };

  // ----------------------------------------------------
  // ATS Status
  // ----------------------------------------------------

  const atsStatus: DeclarationStatus =
    hasSales || hasPurchases
      ? {
          module: "ats",
          status: "ready",
          message: "Información lista para ATS"
        }
      : {
          module: "ats",
          status: "pending",
          message: "No existen facturas registradas"
        };

  return [
    ivaStatus,
    retStatus,
    atsStatus
  ];
}