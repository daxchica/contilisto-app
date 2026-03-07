import { JournalEntry } from "@/types/JournalEntry";
import { SRI_ACCOUNT_MAP } from "@/config/sriAccounts";

export function getIvaVentasLedger(
  entries: JournalEntry[],
  entityId: string,
  period: string
) {

  return entries.filter(e =>
    e.entityId === entityId &&
    e.date?.slice(0,7) === period &&
    SRI_ACCOUNT_MAP.IVA_VENTAS.includes(e.account_code)
  );

}

export function getIvaComprasLedger(
  entries: JournalEntry[],
  entityId: string,
  period: string
) {

  return entries.filter(e =>
    e.entityId === entityId &&
    e.date?.slice(0,7) === period &&
    SRI_ACCOUNT_MAP.IVA_COMPRAS.includes(e.account_code)
  );

}