import React, { useEffect, useMemo, useRef, useState } from "react";
import type { EntityType } from "@/types/Entity";

/* ======================================================
   Types
====================================================== */

export type CreateEntityPayload = {
  ruc: string;
  name: string;
  entityType: EntityType;
  email: string;
  address: string;
  phone?: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: CreateEntityPayload) => Promise<void>;
};

/* ======================================================
   Layout constants
====================================================== */

const MIN_MARGIN = 12;
const DESKTOP_W = 540;
const DESKTOP_H = 420;

/* ======================================================
   Component
====================================================== */

export default function AddEntityModal({ isOpen, onClose, onCreate }: Props) {
  /* -------------------------------
     Form state
  -------------------------------- */
  const [ruc, setRuc] = useState("");
  const [name, setName] = useState("");
  const [entityType, setEntityType] = useState<EntityType>("comercial");

  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* -------------------------------
     Responsive
  -------------------------------- */
  const [isMobile, setIsMobile] = useState(false);

  /* -------------------------------
     Drag state (desktop only)
  -------------------------------- */
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  /* ======================================================
     Effects
  ====================================================== */

  // Detect mobile
  useEffect(() => {
    if (!isOpen) return;

    const update = () => setIsMobile(window.innerWidth < 640);
    update();

    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [isOpen]);

  // Reset + center on open
  useEffect(() => {
    if (!isOpen) return;

    setRuc("");
    setName("");
    setEntityType("comercial");
    setEmail("");
    setAddress("");
    setPhone("");
    setError(null);
    setSaving(false);

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (vw < 640) {
      setPos({ x: MIN_MARGIN, y: MIN_MARGIN });
      return;
    }

    setPos({
      x: Math.max((vw - DESKTOP_W) / 2, MIN_MARGIN),
      y: Math.max((vh - DESKTOP_H) / 2, MIN_MARGIN),
    });
  }, [isOpen]);

  // Clamp on resize (desktop)
  useEffect(() => {
    if (!isOpen || isMobile) return;

    const clamp = () => {
      const rect = modalRef.current?.getBoundingClientRect();
      if (!rect) return;

      const maxX = window.innerWidth - rect.width - MIN_MARGIN;
      const maxY = window.innerHeight - rect.height - MIN_MARGIN;

      setPos((p) => ({
        x: Math.min(Math.max(p.x, MIN_MARGIN), Math.max(maxX, MIN_MARGIN)),
        y: Math.min(Math.max(p.y, MIN_MARGIN), Math.max(maxY, MIN_MARGIN)),
      }));
    };

    clamp();
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, [isOpen, isMobile]);

  // ESC closes modal
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [isOpen, onClose]);

  // Cleanup drag state
  useEffect(() => {
    if (isOpen) return;
    draggingRef.current = false;
    startRef.current = null;
    document.body.style.userSelect = "";
  }, [isOpen]);

  /* ======================================================
     Drag handlers
  ====================================================== */

  const onPointerDown = (e: React.PointerEvent) => {
    if (isMobile) return;

    draggingRef.current = true;
    startRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    document.body.style.userSelect = "none";
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current || !startRef.current) return;

    const nx = e.clientX - startRef.current.x;
    const ny = e.clientY - startRef.current.y;

    const rect = modalRef.current?.getBoundingClientRect();
    const w = rect?.width ?? DESKTOP_W;
    const h = rect?.height ?? DESKTOP_H;

    setPos({
      x: Math.min(Math.max(nx, MIN_MARGIN), window.innerWidth - w - MIN_MARGIN),
      y: Math.min(Math.max(ny, MIN_MARGIN), window.innerHeight - h - MIN_MARGIN),
    });
  };

  const stopDragging = () => {
    draggingRef.current = false;
    startRef.current = null;
    document.body.style.userSelect = "";
  };

  /* ======================================================
     Validation
  ====================================================== */

  const canCreate = useMemo(
    () =>
      ruc.trim() &&
      name.trim() &&
      email.trim() &&
      address.trim(),
    [ruc, name, email, address]
  );

  /* ======================================================
     Submit
  ====================================================== */

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canCreate || saving) return;

    try {
      setSaving(true);
      setError(null);

      await onCreate({
        ruc: ruc.trim(),
        name: name.trim(),
        entityType,
        email: email.trim(),
        address: address.trim(),
        phone: phone.trim() || undefined,
      });

      onClose();
    } catch (err) {
      console.error(err);
      setError("No se pudo crear la empresa. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  /* ======================================================
     Render
  ====================================================== */

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Window */}
      <div
        ref={modalRef}
        className="fixed z-50 bg-white rounded-xl shadow-lg overflow-hidden"
        style={{
          width: isMobile ? "92vw" : DESKTOP_W,
          left: isMobile ? MIN_MARGIN : pos.x,
          right: isMobile ? MIN_MARGIN : undefined,
          top: isMobile ? MIN_MARGIN : pos.y,
        }}
        onPointerMove={onPointerMove}
        onPointerUp={stopDragging}
      >
        {/* Header */}
        <div
          className={`px-4 py-3 bg-blue-600 text-white flex justify-between ${
            isMobile ? "" : "cursor-move"
          }`}
          onPointerDown={onPointerDown}
          onPointerUp={stopDragging}
        >
          <h2 className="font-semibold">➕ Agregar Empresa</h2>
          <button onClick={onClose} className="text-white/90 hover:text-white">
            ✕
          </button>
        </div>

        {/* Content */}
        <form onSubmit={submit} className="p-4 space-y-3">
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
              {error}
            </div>
          )}

          <input
            className="w-full border rounded px-3 py-2"
            placeholder="RUC"
            value={ruc}
            onChange={(e) => setRuc(e.target.value)}
            required
          />

          <input
            className="w-full border rounded px-3 py-2"
            placeholder="Nombre de la empresa"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <select
            className="w-full border rounded px-3 py-2"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value as EntityType)}
          >
            <option value="comercial">Comercial</option>
            <option value="industrial">Industrial</option>
            <option value="servicios">Servicios</option>
            <option value="construccion">Construcción</option>
            <option value="educacion">Educación</option>
          </select>

          <input
            type="email"
            className="w-full border rounded px-3 py-2"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            className="w-full border rounded px-3 py-2"
            placeholder="Dirección"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
          />

          <input
            className="w-full border rounded px-3 py-2"
            placeholder="Teléfono (opcional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canCreate || saving}
              className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}