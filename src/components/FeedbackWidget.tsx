// src/components/FeedbackWidget.tsx
// CONTILISTO — Floating feedback / suggestion box
// Saves to Firestore `feedback` collection (no server needed)

import React, { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase-config";
import { useAuth } from "@/context/AuthContext";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

type Category = "Sugerencia" | "Error / Bug" | "Pregunta" | "Elogio" | "Otro";

const CATEGORIES: Category[] = [
  "Sugerencia",
  "Error / Bug",
  "Pregunta",
  "Elogio",
  "Otro",
];

const CATEGORY_EMOJI: Record<Category, string> = {
  "Sugerencia":  "💡",
  "Error / Bug": "🐛",
  "Pregunta":    "❓",
  "Elogio":      "🌟",
  "Otro":        "💬",
};

// ---------------------------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------------------------

export default function FeedbackWidget() {
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>("Sugerencia");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const canSubmit = message.trim().length >= 10 && !sending;

  const handleOpen = () => {
    setOpen(true);
    setSent(false);
    setMessage("");
    setCategory("Sugerencia");
    setRating(0);
  };

  const handleClose = () => {
    setOpen(false);
    setSent(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSending(true);
    try {
      await addDoc(collection(db, "feedback"), {
        uid:         user?.uid ?? "anonymous",
        email:       user?.email ?? "",
        displayName: user?.displayName ?? "",
        category,
        message:     message.trim(),
        rating:      rating || null,
        createdAt:   serverTimestamp(),
        appVersion:  "1.0",
        url:         window.location.pathname,
      });
      setSent(true);
      setMessage("");
      setRating(0);
    } catch (err) {
      console.error("Feedback save failed:", err);
      alert("No se pudo enviar el mensaje. Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* ── Floating trigger button ── */}
      <button
        onClick={handleOpen}
        title="Buzón de sugerencias"
        className="fixed bottom-6 right-6 z-50 bg-[#0A3558] hover:bg-[#0d4a75] text-white w-13 h-13 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-400"
        style={{ width: 52, height: 52 }}
      >
        <span className="text-xl">💬</span>
      </button>

      {/* ── Modal ── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-end p-4 sm:items-center sm:justify-center bg-black/30"
          onClick={handleClose}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 mb-16 sm:mb-0"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-[#0A3558]">
                  💬 Buzón de sugerencias
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Tu opinión nos ayuda a mejorar Contilisto
                </p>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none font-bold"
              >
                ✕
              </button>
            </div>

            {sent ? (
              /* ── Success state ── */
              <div className="text-center py-8">
                <div className="text-5xl mb-3">🎉</div>
                <p className="text-lg font-bold text-green-700">¡Gracias por tu mensaje!</p>
                <p className="text-sm text-gray-500 mt-1">
                  Lo revisaremos pronto y trabajaremos en mejorarlo.
                </p>
                <button
                  onClick={handleClose}
                  className="mt-5 px-5 py-2 bg-[#0A3558] text-white rounded-lg text-sm font-semibold hover:bg-[#0d4a75] transition"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              /* ── Form ── */
              <div className="space-y-4">

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Categoría
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c}
                        onClick={() => setCategory(c)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                          category === c
                            ? "bg-[#0A3558] text-white border-[#0A3558]"
                            : "bg-white text-gray-600 border-gray-300 hover:border-[#0A3558]"
                        }`}
                      >
                        {CATEGORY_EMOJI[c]} {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Star rating */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Calificación <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setRating(star === rating ? 0 : star)}
                        className="text-2xl transition-transform hover:scale-110 focus:outline-none"
                        aria-label={`${star} estrella${star !== 1 ? "s" : ""}`}
                      >
                        {star <= (hoverRating || rating) ? "⭐" : "☆"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Mensaje <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    placeholder="Describe tu sugerencia, el error encontrado, o cualquier comentario que tengas…"
                    className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <p className={`text-xs mt-0.5 ${message.trim().length < 10 && message.length > 0 ? "text-red-500" : "text-gray-400"}`}>
                    {message.trim().length} / mín. 10 caracteres
                  </p>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-gray-400">
                    Enviado como <span className="font-medium">{user?.email ?? "anónimo"}</span>
                  </p>
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="px-5 py-2 bg-[#0A3558] text-white rounded-lg text-sm font-semibold hover:bg-[#0d4a75] transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {sending ? "Enviando…" : "Enviar 🚀"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
