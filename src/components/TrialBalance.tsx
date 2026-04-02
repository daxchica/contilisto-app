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
  
};

type Amounts = {
  initial: number;
  debit: number;
  credit: number;
};

type Row = {
  code: string;
  name: string;
  level: number;
  parentCode: string | null;
  initial: number;
  debit: number;
  credit: number;
  saldoDeudor: number;
  saldoAcreedor: number;
  hasChildren: boolean;
  hasOwnOrDescendantValues: boolean;
};

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

const fmt = (n: number) =>
  new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);

const iso = (s?: string) => (typeof s === "string" ? s.slice(0, 10) : "");

const toNumber = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const isZero = (n: number) => Math.abs(n) < 0.000001;

const hasAmounts = (a: Amounts) =>
  !isZero(a.initial) || !isZero(a.debit) || !isZero(a.credit);

const compareCodes = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

const getCOALevelLengths = (): number[] => {
  const lengths = Array.from(
    new Set(
      ECUADOR_COA.map((a) => String(a.code ?? "").trim().length).filter(
        (len) => len > 0
      )
    )
  ).sort((a, b) => a - b);

  return lengths.length ? lengths : [1, 2, 4, 6, 8];
};

const getDirectParentCode = (
  code: string,
  allCodes: Set<string>,
  levelLengths: number[]
): string | null => {
  const shorterLengths = levelLengths.filter((len) => len < code.length).sort((a, b) => b - a);

  for (const len of shorterLengths) {
    const candidate = code.slice(0, len);
    if (allCodes.has(candidate)) return candidate;
  }

  for (let len = code.length - 1; len >= 1; len--) {
    const candidate = code.slice(0, len);
    if (allCodes.has(candidate)) return candidate;
  }

  return null;
};

const computeSaldo = (initial: number, debit: number, credit: number) =>
  initial + debit - credit;

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export default function TrialBalance({
  entityId,
  entries,
}: Props) {
  const [level, setLevel] = useState(5);
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(["1", "2", "3", "4", "5"])
  );

  const levelLengths = useMemo(() => getCOALevelLengths(), []);
  const coaNameByCode = useMemo(
    () =>
      new Map(
        ECUADOR_COA.map((a) => [String(a.code ?? "").trim(), String(a.name ?? "").trim()])
      ),
    []
  );

  const entityEntries = entries;

  const hasInitialBalance = useMemo(
    () => hasInitial(entityEntries),
    [entityEntries]
  );

  const initialBalanceDate = useMemo(
    () => getInitialBalanceDate(entries, entityId),
    [entries, entityId]
  );


  const toggleExpand = (code: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };


  /* ------------------------------------------------------------------------ */
  /* EXACT AMOUNTS BY POSTED ACCOUNT                                          */
  /* ------------------------------------------------------------------------ */

  const exactAmountsByCode = useMemo(() => {
    const map = new Map<string, Amounts>();

    for (const e of entityEntries) {
      
      const code = String(e.account_code ?? "").trim();
      if (!code) continue;

      const d = iso(e.date);
      if (!d) continue;

      const existing = map.get(code) ?? { initial: 0, debit: 0, credit: 0 };

      const debit = toNumber(e.debit);
      const credit = toNumber(e.credit);

      if (e.source === "initial") {
        existing.initial += debit - credit;
      }
      else {
        existing.debit += debit;
        existing.credit += credit;
      }

      map.set(code, existing);
    }

    return map;
  }, [entries, entityId]);

  /* ------------------------------------------------------------------------ */
  /* ACCOUNT UNIVERSE + TREE                                                  */
  /* ------------------------------------------------------------------------ */

  const allCodes = useMemo(() => {
    const set = new Set<string>();

    for (const a of ECUADOR_COA) {
      const code = String(a.code ?? "").trim();
      if (code) set.add(code);
    }

    for (const code of exactAmountsByCode.keys()) {
      if (code) set.add(code);
    }

    return set;
  }, [exactAmountsByCode]);

  const tree = useMemo(() => {
    const parentByCode = new Map<string, string | null>();
    const childrenByCode = new Map<string, string[]>();

    const sortedCodes = Array.from(allCodes).sort(compareCodes);

    for (const code of sortedCodes) {
      const parent = getDirectParentCode(code, allCodes, levelLengths);
      parentByCode.set(code, parent);

      if (!childrenByCode.has(code)) childrenByCode.set(code, []);
      if (parent) {
        const siblings = childrenByCode.get(parent) ?? [];
        siblings.push(code);
        siblings.sort(compareCodes);
        childrenByCode.set(parent, siblings);
      }
    }

    return { parentByCode, childrenByCode, sortedCodes };
  }, [allCodes, levelLengths]);

  /* ------------------------------------------------------------------------ */
  /* ROLL-UP TOTALS TO ALL PARENTS                                            */
  /* ------------------------------------------------------------------------ */

  const rolledUpAmountsByCode = useMemo(() => {
    const map = new Map<string, Amounts>();

    for (const code of tree.sortedCodes) {
      map.set(code, { initial: 0, debit: 0, credit: 0 });
    }

    for (const [postedCode, amounts] of exactAmountsByCode.entries()) {
      let current: string | null = postedCode;

      while (current) {
        const bucket = map.get(current) ?? { initial: 0, debit: 0, credit: 0 };
        bucket.initial += amounts.initial;
        bucket.debit += amounts.debit;
        bucket.credit += amounts.credit;
        map.set(current, bucket);

        current = tree.parentByCode.get(current) ?? null;
      }
    }

    return map;
  }, [exactAmountsByCode, tree]);

  /* ------------------------------------------------------------------------ */
  /* ROWS                                                                     */
  /* ------------------------------------------------------------------------ */

  const rows = useMemo<Row[]>(() => {
    const memoHasValues = new Map<string, boolean>();

    const subtreeHasValues = (code: string): boolean => {
      if (memoHasValues.has(code)) return memoHasValues.get(code)!;

      const selfAmounts = rolledUpAmountsByCode.get(code) ?? {
        initial: 0,
        debit: 0,
        credit: 0,
      };

      if (hasAmounts(selfAmounts)) {
        memoHasValues.set(code, true);
        return true;
      }

      const children = tree.childrenByCode.get(code) ?? [];
      const result = children.some((child) => subtreeHasValues(child));
      memoHasValues.set(code, result);
      return result;
    };

    return tree.sortedCodes
      .map((code) => {
        const amounts = rolledUpAmountsByCode.get(code) ?? {
          initial: 0,
          debit: 0,
          credit: 0,
        };

        const parentCode = tree.parentByCode.get(code) ?? null;
        const parentLevel = parentCode
          ? tree.sortedCodes.includes(parentCode)
            ? undefined
            : undefined
          : undefined;

        let rowLevel = 1;
        if (parentCode) {
          const parentRow = tree.parentByCode.has(parentCode)
            ? undefined
            : undefined;
          void parentRow;
        }

        // Robust level based on tree depth, not raw code length.
        let depth = 1;
        let p = parentCode;
        while (p) {
          depth += 1;
          p = tree.parentByCode.get(p) ?? null;
        }

        const saldo = computeSaldo(amounts.initial, amounts.debit, amounts.credit);

        return {
          code,
          name: coaNameByCode.get(code) || `Cuenta ${code}`,
          level: depth,
          parentCode,
          initial: amounts.initial,
          debit: amounts.debit,
          credit: amounts.credit,
          saldoDeudor: saldo > 0 ? saldo : 0,
          saldoAcreedor: saldo < 0 ? Math.abs(saldo) : 0,
          hasChildren: (tree.childrenByCode.get(code) ?? []).length > 0,
          hasOwnOrDescendantValues: subtreeHasValues(code),
        };
      })
      .sort((a, b) => compareCodes(a.code, b.code));
  }, [rolledUpAmountsByCode, tree, coaNameByCode]);

  const rowByCode = useMemo(
    () => new Map(rows.map((r) => [r.code, r])),
    [rows]
  );

  const selectedMaxDepth = Math.min(
    Math.max(level, 1),
    Math.max(...rows.map((r) => r.level), 1)
  );

  /* ------------------------------------------------------------------------ */
  /* PROFESSIONAL ERP DISPLAY ORDER (DFS TREE)                                */
  /* ------------------------------------------------------------------------ */

  const visibleRows = useMemo(() => {
    const result: Row[] = [];
    const roots = rows
      .filter((r) => r.parentCode === null)
      .sort((a, b) => compareCodes(a.code, b.code));

    const visit = (row: Row) => {
      if (row.level > selectedMaxDepth) return;

      // Show top level always. For deeper rows, parent must be expanded.
      if (row.parentCode) {
        const parentExpanded = expanded.has(row.parentCode);
        if (!parentExpanded) return;
      }

      // Professional ERP behavior: keep top-level rows always visible,
      // and for deeper levels show rows with values (or descendants with values).
      if (row.level === 1 || row.hasOwnOrDescendantValues) {
        result.push(row);
      }

      if (!expanded.has(row.code)) return;

      const children = (tree.childrenByCode.get(row.code) ?? [])
        .map((code) => rowByCode.get(code))
        .filter((r): r is Row => Boolean(r))
        .sort((a, b) => compareCodes(a.code, b.code));

      for (const child of children) visit(child);
    };

    for (const root of roots) visit(root);

    return result;
  }, [rows, rowByCode, tree.childrenByCode, expanded, selectedMaxDepth]);

  /* ------------------------------------------------------------------------ */
  /* TOTALS (ALWAYS FROM LEVEL 1 TO AVOID DOUBLE COUNTING)                    */
  /* ------------------------------------------------------------------------ */

  const topLevelRows = useMemo(
    () => rows.filter((r) => r.level === 1).sort((a, b) => compareCodes(a.code, b.code)),
    [rows]
  );

  const totals = useMemo(
    () =>
      topLevelRows.reduce(
        (acc, r) => {
          acc.initial += r.initial;
          acc.debit += r.debit;
          acc.credit += r.credit;
          acc.deudor += r.saldoDeudor;
          acc.acreedor += r.saldoAcreedor;
          return acc;
        },
        {
          initial: 0,
          debit: 0,
          credit: 0,
          deudor: 0,
          acreedor: 0,
        }
      ),
    [topLevelRows]
  );

  const balanced =
    Math.abs(totals.debit - totals.credit) < 0.01 &&
    Math.abs(totals.deudor - totals.acreedor) < 0.01;

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
      <div className="flex items-start justify-between mb-4 gap-4">
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

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Nivel máximo</label>
          <select
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
            className="border rounded px-3 py-2 bg-white"
          >
            {[1, 2, 3, 4, 5].map((l) => (
              <option key={l} value={l}>
                Nivel {l}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!balanced && (
        <div className="mb-3 p-3 text-sm bg-red-50 border border-red-200 text-red-700 rounded">
          ⚠️ El Balance de Comprobación no cuadra.
        </div>
      )}

      <div className="overflow-x-auto border rounded">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-100">
            <tr className="text-left">
              <th className="p-2 border-b">Código</th>
              <th className="p-2 border-b">Cuenta</th>
              <th className="p-2 border-b text-right">Inicial</th>
              <th className="p-2 border-b text-right">Débito</th>
              <th className="p-2 border-b text-right">Crédito</th>
              <th className="p-2 border-b text-right">Saldo Deudor</th>
              <th className="p-2 border-b text-right">Saldo Acreedor</th>
            </tr>
          </thead>

          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  No hay movimientos contables para el rango seleccionado.
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => {
                const isOpen = expanded.has(row.code);

                return (
                  <tr key={row.code} className="border-t hover:bg-gray-50">
                    <td className="p-2 align-top whitespace-nowrap">
                      {row.hasChildren ? (
                        <button
                          type="button"
                          onClick={() => toggleExpand(row.code)}
                          className="mr-2 text-blue-600 font-semibold"
                          aria-label={
                            isOpen
                              ? `Contraer cuenta ${row.code}`
                              : `Expandir cuenta ${row.code}`
                          }
                          title={isOpen ? "Contraer" : "Expandir"}
                        >
                          {isOpen ? "▼" : "▶"}
                        </button>
                      ) : (
                        <span className="inline-block w-5 mr-2" />
                      )}
                      {row.code}
                    </td>

                    <td
                      className="p-2"
                      style={{ paddingLeft: `${(row.level - 1) * 18}px` }}
                    >
                      <span
                        className={
                          row.level <= 2 ? "font-semibold text-gray-800" : "text-gray-700"
                        }
                      >
                        {row.name}
                      </span>
                    </td>

                    <td className="p-2 text-right tabular-nums">
                      {fmt(row.initial)}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {fmt(row.debit)}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {fmt(row.credit)}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {fmt(row.saldoDeudor)}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {fmt(row.saldoAcreedor)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          <tfoot className="bg-gray-100 font-semibold border-t">
            <tr>
              <td className="p-2" />
              <td className="p-2">TOTAL</td>
              <td className="p-2 text-right tabular-nums">{fmt(totals.initial)}</td>
              <td className="p-2 text-right tabular-nums">{fmt(totals.debit)}</td>
              <td className="p-2 text-right tabular-nums">{fmt(totals.credit)}</td>
              <td className="p-2 text-right tabular-nums">{fmt(totals.deudor)}</td>
              <td className="p-2 text-right tabular-nums">{fmt(totals.acreedor)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}