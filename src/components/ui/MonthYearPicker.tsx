// src/components/ui/MonthYearPicker.tsx
// Lets the user pick month + year; always returns the last day of that month.

import React from "react";
import { getLastDayOfMonth, parseYearMonth } from "@/utils/dateUtils";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface Props {
  /** YYYY-MM-DD — always the last day of the selected month */
  value: string;
  onChange: (isoDate: string) => void;
  disabled?: boolean;
  /** Earliest selectable year (default: current year - 10) */
  minYear?: number;
  /** Latest selectable year (default: current year) */
  maxYear?: number;
}

export default function MonthYearPicker({
  value,
  onChange,
  disabled = false,
  minYear,
  maxYear,
}: Props) {
  const now = new Date();
  const min = minYear ?? now.getFullYear() - 10;
  const max = maxYear ?? now.getFullYear();

  const { year, month } = parseYearMonth(value);

  const years: number[] = [];
  for (let y = max; y >= min; y--) years.push(y);

  function handleMonth(m: number) {
    onChange(getLastDayOfMonth(year, m));
  }

  function handleYear(y: number) {
    onChange(getLastDayOfMonth(y, month));
  }

  const lastDay = getLastDayOfMonth(year, month);
  const [, , dd] = lastDay.split("-");
  const displayDate = `Al ${parseInt(dd, 10)} de ${MONTHS[month - 1].toLowerCase()} de ${year}`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <select
          value={month}
          disabled={disabled}
          onChange={(e) => handleMonth(Number(e.target.value))}
          className="border rounded px-2 py-1.5 text-sm bg-white disabled:bg-gray-100"
        >
          {MONTHS.map((name, i) => (
            <option key={i + 1} value={i + 1}>
              {name}
            </option>
          ))}
        </select>

        <select
          value={year}
          disabled={disabled}
          onChange={(e) => handleYear(Number(e.target.value))}
          className="border rounded px-2 py-1.5 text-sm bg-white disabled:bg-gray-100"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-blue-700 font-medium">
        📅 Fecha de corte: <span className="font-semibold">{displayDate}</span>
      </p>
    </div>
  );
}
