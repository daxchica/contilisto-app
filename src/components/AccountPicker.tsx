// ============================================================================
// src/components/AccountPicker.tsx
// CONTILISTO — FINAL PRODUCTION VERSION
// Portal-based dropdown (fixes Rnd / modal stacking issues)
// Supports hints, keyboard nav, scroll, AI learning integration
// ============================================================================

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import ReactDOM from "react-dom";

import type { Account } from "@/types/AccountTypes";

type Props = {
  value: { code: string; name: string } | null;
  onChange: (next: { code: string; name: string }) => void;

  accounts: Account[];

  hints?: { code: string; name: string }[];

  placeholder?: string;

  inputClassName?: string;

  displayMode?: "name" | "code" | "code+name";

  limit?: number;
};

// ============================================================================
// HELPERS
// ============================================================================

function norm(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function getCode(a: any): string {
  return String(a?.code ?? "").trim();
}

function getName(a: any): string {
  return String(a?.name ?? "").trim();
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function AccountPicker({

  value,

  onChange,

  accounts,

  hints,

  placeholder = "Buscar cuenta…",

  inputClassName = "w-full border rounded px-3 py-2",

  displayMode = "name",

  limit = 100,

}: Props) {

  const inputRef = useRef<HTMLInputElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const listRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);

  const [query, setQuery] = useState("");

  const [activeIndex, setActiveIndex] = useState(0);

  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  // ============================================================================
  // DISPLAY VALUE
  // ============================================================================

  const displayValue = useMemo(() => {

    if (!value) return "";

    if (displayMode === "code")
      return value.code;

    if (displayMode === "code+name")
      return `${value.code} — ${value.name}`;

    return value.name;

  }, [value, displayMode]);

  // ============================================================================
  // MERGE HINTS
  // ============================================================================

  const mergedAccounts = useMemo(() => {

    const base = accounts ?? [];

    if (!hints?.length)
      return base;

    const map = new Map<string, Account>();

    hints.forEach(h =>
      map.set(h.code, {
        code: h.code,
        name: h.name,
        level: 99,
      })
    );

    base.forEach(a =>
      map.set(a.code, a)
    );

    return Array.from(map.values());

  }, [accounts, hints]);

  // ============================================================================
  // FILTER
  // ============================================================================

  const filtered = useMemo(() => {

    if (!query)
      return mergedAccounts.slice(0, limit);

    const nq = norm(query);

    return mergedAccounts
      .filter(a =>
        norm(a.name).includes(nq) ||
        a.code.includes(nq)
      )
      .slice(0, limit);

  }, [mergedAccounts, query, limit]);

  // ============================================================================
  // POSITION
  // ============================================================================

  useEffect(() => {

    if (!open)
      return;

    const rect =
      inputRef.current?.getBoundingClientRect();

    if (!rect)
      return;

    setDropdownStyle({

      position: "fixed",

      top: rect.bottom + 4,

      left: rect.left,

      width: rect.width,

      zIndex: 999999,

    });

  }, [open]);

  // ============================================================================
  // PICK
  // ============================================================================

  function pick(acc: Account) {

    onChange({
      code: acc.code,
      name: acc.name,
    });

    setOpen(false);

  }

  // ============================================================================
  // KEYBOARD NAV
  // ============================================================================

  function onKeyDown(e: React.KeyboardEvent) {

    if (!open)
      return;

    if (e.key === "ArrowDown") {

      e.preventDefault();

      setActiveIndex(i =>
        Math.min(filtered.length - 1, i + 1)
      );

    }

    if (e.key === "ArrowUp") {

      e.preventDefault();

      setActiveIndex(i =>
        Math.max(0, i - 1)
      );

    }

    if (e.key === "Enter") {

      e.preventDefault();

      const acc = filtered[activeIndex];

      if (acc)
        pick(acc);

    }

    if (e.key === "Escape")
      setOpen(false);

  }

  // ============================================================================
  // DROPDOWN PORTAL
  // ============================================================================

  const dropdown = open && (

    <div
      ref={listRef}
      style={dropdownStyle}
      className="bg-white border rounded shadow-lg max-h-60 overflow-auto"
    >

      {filtered.map((acc, i) => (

        <div

          key={acc.code}

          className={`
            px-3 py-2 cursor-pointer
            ${i === activeIndex
              ? "bg-emerald-100"
              : "hover:bg-emerald-50"}
          `}

          onMouseDown={() => pick(acc)}

        >

          <div className="font-mono text-sm">

            {acc.code}

          </div>

          <div className="text-xs text-gray-600">

            {acc.name}

          </div>

        </div>

      ))}

    </div>

  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (

    <div ref={containerRef}>

      <input

        ref={inputRef}

        value={open ? query : displayValue}

        placeholder={placeholder}

        className={inputClassName}

        onFocus={() => {

          setQuery("");

          setOpen(true);

        }}

        onChange={e => {

          setQuery(e.target.value);

          setOpen(true);

        }}

        onKeyDown={onKeyDown}

      />

      {open &&
        ReactDOM.createPortal(
          dropdown,
          document.body
        )}

    </div>

  );

}