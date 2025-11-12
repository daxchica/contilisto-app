// src/components/AccountPicker.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { Account } from "../types/AccountTypes";

type Props = {
  value: { code: string; name: string } | null;
  onChange: (next: { code: string; name: string }) => void;
  accounts: Account[];
  inputClassName?: string;
  listClassName?: string;
  placeholder?: string;
  /** NEW: can be "name" | "code" | "code+name" */
  displayMode?: "name" | "code" | "code+name";
  limit?: number;
};

function norm(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

export default function AccountPicker({
  value,
  onChange,
  accounts,
  inputClassName = "w-full border rounded px-2 py-1",
  listClassName = "absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded border bg-white shadow",
  placeholder = "Buscar cuenta por código o nombre…",
  displayMode = "name",
  limit = 100,
}: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [q, setQ] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const listRef = useRef<HTMLUListElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectedDisplay =
    value == null
      ? ""
      : displayMode === "code"
      ? value.code
      : displayMode === "code+name"
      ? `${value.code} — ${value.name}`
      : value.name;

  useEffect(() => {
    if (!editing) setQ(selectedDisplay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDisplay]);

  const filtered = useMemo(() => {
    const nq = norm(q);
    if (!nq) return accounts.slice(0, Math.min(limit, accounts.length));

    // prefer prefix matches, then contains
    const scored = accounts
      .map((a) => {
        const nameN = norm(a.name);
        const codeN = a.code;
        const contains = nameN.includes(nq) || codeN.includes(nq);
        if (!contains) return null;
        const isPrefix = nameN.startsWith(nq) || codeN.startsWith(nq) ? 0 : 1;
        return { a, score: isPrefix };
      })
      .filter(Boolean) as { a: Account; score: number }[];

    scored.sort((x, y) =>
      x.score !== y.score
        ? x.score - y.score
        : x.a.code.localeCompare(y.a.code, "es", { numeric: true })
    );
    return scored.slice(0, limit).map((x) => x.a);
  }, [q, accounts, limit]);

  const pick = (acc: Account) => {
    onChange({ code: acc.code, name: acc.name });
    setOpen(false);
    setEditing(false);
    // reflect the chosen value in the visible input
    setQ(displayMode === "code" ? acc.code : displayMode === "code+name" ? `${acc.code} — ${acc.name}` : acc.name);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const acc = filtered[activeIdx];
      if (acc) pick(acc);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setEditing(false);
      setQ(selectedDisplay);
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={editing ? q : selectedDisplay}
        placeholder={placeholder}
        aria-label={placeholder || "Campo de busqueda de cuenta"}
        className={inputClassName}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-haspopup="listbox"
        onFocus={() => {
          setEditing(true);
          setOpen(true);
          // when editing the "Código" field, start with the current code in the query
          setQ(displayMode === "code" ? value?.code ?? "" : value?.name ?? "");
        }}
        onChange={(e) => {
          setEditing(true);
          setQ(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          // let option click happen first
          setTimeout(() => {
            setOpen(false);
            setEditing(false);
            setQ(selectedDisplay);
          }, 0);
        }}
      />

      {open && (
        <ul 
          ref={listRef} 
          role="listbox" 
          className={listClassName}
          aria-activedescendant={open ? `option-${activeIdx}` : undefined}
          aria-label="Lista de cuentas disponibles"
        >
          {filtered.length === 0 && (
            <li
              role="presentation" 
              className="px-3 py-2 text-sm text-gray-500"
            >
              Sin resultados
            </li>
          )}
          {filtered.map((a, i) => (
            <li
              key={`${a.code}-${i}`}
              id={`option-${i}`}
              role="option"
              tabIndex={-1}
              aria-selected={i === activeIdx}
              className={`cursor-pointer px-3 py-2 hover:bg-emerald-50 ${
                i === activeIdx ? "bg-emerald-100" : ""
              }`}
              onMouseEnter={() => setActiveIdx(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(a);
              }}
            >
              {/* show code prominent, name below (helps both Código & Cuenta use cases) */}
              <div className="font-mono text-slate-900">{a.code}</div>
              <div className="text-xs text-slate-600">{a.name}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}