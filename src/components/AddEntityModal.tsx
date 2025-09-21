import { useEffect, useMemo, useRef, useState } from "react";
import "../styles/AddEntityModal.css";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: { ruc: string; name: string }) => Promise<void> | void;
};

export default function AddEntityModal({ isOpen, onClose, onCreate }: Props) {
  const [ruc, setRuc] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  // ---- Drag state ----
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);


  // Centrar al abrir y limpiar campos
  useEffect(() => {
    if (!isOpen) return;
    setRuc("");
    setName("");
    // centra modal (usando viewport actual)
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // tamaño aproximado del modal (puedes medirlo si prefieres)
    const approxW = 480;
    const approxH = 280;
    setPos({ x: Math.max((vw - approxW) / 2, 12), y: Math.max((vh - approxH) / 2, 12) });
  }, [isOpen]);

  // Clamp a la ventana al redimensionar
  useEffect(() => {
    if (!isOpen) return;
    const clamp = () => {
      const rect = modalRef.current?.getBoundingClientRect();
      if (!rect) return;
      const maxX = window.innerWidth - rect.width - 12;
      const maxY = window.innerHeight - rect.height - 12;
      setPos((p) => ({
        x: Math.min(Math.max(p.x, 12), Math.max(maxX, 12)),
        y: Math.min(Math.max(p.y, 12), Math.max(maxY, 12)),
      }));
    };
    clamp();
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, [isOpen]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!isOpen) return;
    draggingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    document.body.style.userSelect = "none";
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current || !startRef.current) return;
    const nx = e.clientX - startRef.current.x;
    const ny = e.clientY - startRef.current.y;

    // clamp con el tamaño actual del modal
    const rect = modalRef.current?.getBoundingClientRect();
    const w = rect?.width ?? 480;
    const h = rect?.height ?? 280;
    const min = 12;
    const maxX = window.innerWidth - w - min;
    const maxY = window.innerHeight - h - min;

    setPos({
      x: Math.min(Math.max(nx, min), Math.max(maxX, min)),
      y: Math.min(Math.max(ny, min), Math.max(maxY, min)),
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    draggingRef.current = false;
    startRef.current = null;
    document.body.style.userSelect = "";
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const canCreate = useMemo(() => ruc.trim().length > 0 && name.trim().length > 0, [ruc, name]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canCreate || saving) return;
    try {
      setSaving(true);
      await onCreate({ ruc: ruc.trim(), name: name.trim() });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const onEsc = (ev: KeyboardEvent) => {
      if (ev.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-entity-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Window */}
      <div
        className={`fixed z-50 bg-white p-6 shadow-lg rounded-md`}
        style={{ left: `${pos.x}px`, top: `${pos.y}px`}}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* Drag handle (header) */}
        <div
          className={`cursor-move select-none rounded-t-xl px-4 py-3 bg-blue-600 text-white flex items-center justify-between`}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        >
          <h2 id="add-entity-title" className="font-semibold">
            ➕ Agregar Entidad
          </h2>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-white/90 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/70"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <form onSubmit={submit} className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">RUC</label>
            <input
              className="w-full border rounded px-3 py-2"
              placeholder="Ingresa el RUC"
              value={ruc}
              onChange={(e) => setRuc(e.target.value)}
              autoFocus
              inputMode="numeric"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Nombre de Empresa</label>
            <input
              className="w-full border rounded px-3 py-2"
              placeholder="Ingresa Nombre de Empresa"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded border bg-white hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canCreate || saving}
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}