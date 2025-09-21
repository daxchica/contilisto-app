// src/components/ui/MovableModal.tsx

import React, { useRef, useState, useEffect } from "react";
import { useDrag } from "@use-gesture/react";
import { animated, useSpring } from "@react-spring/web";
import { X } from "lucide-react";

export interface MovableModalProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  children: React.ReactNode;
}

export default function MovableModal({ 
    title, 
    isOpen, 
    onClose,
    onConfirm,
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    confirmDisabled = false,
    children 
}: MovableModalProps) {
  const modalRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const [{ x, y }, api] = useSpring(() => ({ x: 0, y: 0 }));

  useDrag(
    ({ down, movement: [mx, my] }) => {
      api.start({ x: down ? mx : 0, y: down ? my : 0 });
      setDragging(down);
    },
    { target: modalRef, eventOptions: { passive: false } }
  );

  // Reset modal position when closed
  useEffect(() => {
    if (!isOpen) {
      api.start({ x: 0, y: 0 });
    }
  }, [isOpen, api]);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div 
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
      <animated.div
        ref={modalRef}
        style={{ x, y, touchAction: "none" }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-2 relative"
      >
        {/* HEADER */}
        <div className="cursor-move bg-blue-700 text-white px-4 py-2 rounded-t-2xl flex justify-between items-center">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button 
            onClick={onClose} 
            className="hover:text-red-400 transition-colors duration-150"
            aria-label="Cerrar modal"
            >
            <X />
          </button>
        </div>

        {/* BODY */}
        <div className="p-4 max-h-[70vh] overflow-y-auto touch-pan-y">{children}</div>
        {/* FOOTER (Opcional) */}
        {onConfirm && (
          <div className="flex justify-end gap-4 p-4 border-t rounded-b-2xl bg-gray-50">
            <button
              onClick={onClose}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
            >
              {cancelLabel}
            </button>
            {onConfirm && (
              <button
                onClick={onConfirm}
                disabled={confirmDisabled}
                className={`px-4 py-2 rounded text-white ${
                  confirmDisabled
                    ? "bg-blue-300 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {confirmLabel}
              </button>
            )}
          </div>
        )}
      </animated.div>
    </div>
  );
}