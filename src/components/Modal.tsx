// src/components/Modal.tsx
import React, { ReactNode, useEffect } from "react";

interface ModalProps {
  children: ReactNode;
  onClose?: () => void;
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
  maxWidthClass?: string; // opcional: "max-w-sm", "max-w-lg", etc.
}

export default function Modal({
  children,
  onClose,
  closeOnBackdrop = true,
  showCloseButton = true,
  maxWidthClass = "max-w-md",
}: ModalProps) {
  // 🔒 bloquear scroll del body
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // ⌨️ cerrar con ESC
  useEffect(() => {
    if (!onClose) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-3 sm:px-4 py-6"
      onMouseDown={() => {
        if (closeOnBackdrop && onClose) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={[
          "relative w-full", 
          maxWidthClass,
          "bg-white rounded-2xl shadow-xl",
          "max-h-[85vh] overflow-auto",
        ].join(" ")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {showCloseButton && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="absolute top-3 right-3 h-9 w-9 grid place-items-center rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition"
          >
            <span className="text-2xl leading-none">×</span>
          </button>
        )}

        {/* consistent padding mobile/desktop */}
        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}