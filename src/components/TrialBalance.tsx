// src/components/TrialBalance.tsx
import React, { useMemo, useState } from "react";
import ECUADOR_COA from "@/../shared/coa/ecuador_coa";
import type { JournalEntry } from "@/types/JournalEntry";
import { hasInitial, getInitialBalanceDate } from "@/utils/journalGuards";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type Props = {
  entityId: string;
  entries: JournalEntry[];
  startDate?: string;
  endDate?: string;
};

type Row = {
  code: string;
  name: string;
  initial: number;
  debit: number;
  credit: number;
  balance: number;
  level: number;
};

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

const fmt = (n: number) =>
  new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(n || 0);

const detectLevel = (code: string) => {
  if (code.length <= 1) return 1;
  if (code.length <= 3) return 2;
  if (code.length <= 5) return 3;
  if (code.length <= 7) return 4;
  return 5;
};

const iso = (s?: string) => (typeof s === "string" ? s.slice(0, 10) : "");

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export default function TrialBalance({
  entityId,
  entries,
  startDate,
  endDate,
}: Props) {
  const [level, setLevel] = useState(5);

  const coaMap = useMemo(() => new Map(ECUADOR_COA.map(a => [a.code, a.name])), []);
  const coaCodes = useMemo(() => new Set(ECUADOR_COA.map(a => a.code)), []);

  const entityEntries = useMemo(
    () => entries.filter(e => e.entityId === entityId),
    [entries, entityId]
  );

  const hasInitialBalance = useMemo(
    () => hasInitial(entityEntries),
    [entityEntries]
  );

  const initialBalanceDate = useMemo(
    () => getInitialBalanceDate(entries, entityId),
    [entries, entityId]
  );

  const fromISO = startDate ? iso(startDate) : (initialBalanceDate ?? "");
  const toISO = endDate ? iso(endDate) : "";

  /* ------------------------------------------------------------------------ */
  /* FILTER ENTRIES                                                           */
  /* ------------------------------------------------------------------------ */

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (e.entityId !== entityId) return false;

      if (e.source !== "initial") {
        const d = iso(e.date);
        if (!d) return false;
        if (fromISO && d < fromISO) return false;
        if (toISO && d > toISO) return false;
      }

      return true;
    });
  }, [entries, entityId, fromISO, toISO]);

  /* ------------------------------------------------------------------------ */
  /* RAW MAP (NOW ACCOUNTING-CORRECT)                                         */
  /* ------------------------------------------------------------------------ */

  const raw = useMemo(() => {
    const map = new Map<
      string,
      { initialDebit: number; initialCredit: number; debit: number; credit: number }
    >();

    for (const e of filteredEntries) {
      const code = e.account_code?.trim();
      if (!code) continue;

      if (!map.has(code)) {
        map.set(code, {
          initialDebit: 0,
          initialCredit: 0,
          debit: 0,
          credit: 0,
        });
      }

      const entry = map.get(code)!;

      const debit = Number(e.debit ?? 0);
      const credit = Number(e.credit ?? 0);

      if (e.source === "initial") {
        entry.initialDebit += debit;
        entry.initialCredit += credit;
      } else {
        entry.debit += debit;
        entry.credit += credit;
      }
    }

    return map;
  }, [filteredEntries]);

  /* ------------------------------------------------------------------------ */
  /* AGGREGATION (SIGN CORRECT)                                               */
  /* ------------------------------------------------------------------------ */

  const rows = useMemo<Row[]>(() => {
    const prefixes = new Set<string>();
    const VALID_LEVELS = [1, 3, 5, 7, 9];

    for (const code of raw.keys()) {
      for (const len of VALID_LEVELS) {
        if (code.length >= len) {
          const p = code.slice(0, len);
          if (coaCodes.has(p)) prefixes.add(p);
        }
      }
    }

    return Array.from(prefixes)
      .map(code => {
        let initialDebit = 0;
        let initialCredit = 0;
        let debit = 0;
        let credit = 0;

        for (const [c, r] of raw.entries()) {
          if (c.startsWith(code)) {
            initialDebit += r.initialDebit;
            initialCredit += r.initialCredit;
            debit += r.debit;
            credit += r.credit;
          }
        }

        const group = code.charAt(0);

        let initial = 0;
        let balance = 0;

        if (group === "1") {
          // Activo (debit-normal)
          initial = initialDebit - initialCredit;
          balance = initial + debit - credit;
        } else if (group === "2" || group === "3") {
          // Pasivo & Patrimonio (credit-normal)
          initial = initialCredit - initialDebit;
          balance = initial + credit - debit;
        } else if (group === "4") {
          balance = credit - debit;
        } else if (group === "5") {
          balance = debit - credit;
        }

        if (
          Math.abs(initial) < 0.0001 &&
          Math.abs(debit) < 0.0001 &&
          Math.abs(credit) < 0.0001
        ) {
          return null;
        }

        return {
          code,
          name: coaMap.get(code) || "CUENTA NO DEFINIDA",
          initial,
          debit,
          credit,
          balance,
          level: detectLevel(code),
        };
      })
      .filter(Boolean)
      .filter(r => r!.level <= level)
      .sort((a, b) => a!.code.localeCompare(b!.code)) as Row[];
  }, [raw, level, coaMap, coaCodes]);

  /* ------------------------------------------------------------------------ */
  /* RENDER                                                                   */
  /* ------------------------------------------------------------------------ */

  if (!hasInitialBalance) {
    return (
      <div className="bg-white shadow rounded p-6 text-center text-amber-600">
        ⚠️ Debes registrar el <strong>Balance Inicial</strong> primero.
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded p-6">
      <div className="flex justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-blue-800">
            📘 Balance de Comprobación
          </h2>
          {initialBalanceDate && (
            <div className="text-xs text-gray-600 mt-1">
              Balance Inicial detectado:{" "}
              <span className="font-mono">{initialBalanceDate}</span>
            </div>
          )}
        </div>

        <select
          value={level}
          onChange={e => setLevel(Number(e.target.value))}
          className="border rounded px-2 py-1"
        >
          {[1, 2, 3, 4, 5].map(l => (
            <option key={l} value={l}>
              Nivel {l}
            </option>
          ))}
        </select>
      </div>

      <table className="w-full text-sm border">
        <thead className="bg-gray-100">
          <tr>
            <th>Código</th>
            <th>Cuenta</th>
            <th className="text-right">Inicial</th>
            <th className="text-right">Débito</th>
            <th className="text-right">Crédito</th>
            <th className="text-right">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.code}>
              <td className="font-mono">{r.code}</td>
              <td>{r.name}</td>
              <td className="text-right">{fmt(r.initial)}</td>
              <td className="text-right">{fmt(r.debit)}</td>
              <td className="text-right">{fmt(r.credit)}</td>
              <td className="text-right">{fmt(r.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}