// src/pages/SriSettingsPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSelectedEntity } from "@/context/SelectedEntityContext";
import { db, storage } from "@/firebase-config";

import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import {
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";

interface SriSettingsForm {
  ambiente: "1" | "2";
  estab: string;
  ptoEmi: string;
  secuencialActual: number;
}

type StoredSriSettings = {
  ambiente: "1" | "2";
  estab: string;
  ptoEmi: string;
  secuencialActual: number;
  p12?: {
    storagePath: string;
    fileName?: string;
    uploadedAt?: any;
  };
  updatedAt?: any;
};

function onlyDigits3(value: string) {
  return value.replace(/\D/g, "").slice(0, 3);
}

export default function SriSettingsPage() {
  const { selectedEntity } = useSelectedEntity();
  const entityId = selectedEntity?.id ?? "";

  const [form, setForm] = useState<SriSettingsForm>({
    ambiente: "1",
    estab: "001",
    ptoEmi: "001",
    secuencialActual: 1,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [p12File, setP12File] = useState<File | null>(null);
  const [p12Password, setP12Password] = useState("");

  // Solo para UI: saber si ya hay P12 guardado
  const [storedP12Path, setStoredP12Path] = useState<string>("");

  const entityRef = useMemo(() => {
    if (!entityId) return null;
    return doc(db, "entities", entityId);
  }, [entityId]);

  /* -----------------------------
   Load existing settings
  ----------------------------- */
  useEffect(() => {
    if (!entityRef) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const snap = await getDoc(entityRef);
        if (!snap.exists()) return;

        const data = snap.data() as any;
        const sriSettings = data?.sriSettings as StoredSriSettings | undefined;

        if (!cancelled && sriSettings) {
          setForm({
            ambiente: sriSettings.ambiente ?? "1",
            estab: sriSettings.estab ?? "001",
            ptoEmi: sriSettings.ptoEmi ?? "001",
            secuencialActual: Number(sriSettings.secuencialActual ?? 1),
          });

          setStoredP12Path(sriSettings?.p12?.storagePath ?? "");
        }
      } catch (e) {
        console.error("Error loading SRI settings:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [entityRef]);

  const handleChange = useCallback(
    <K extends keyof SriSettingsForm>(key: K, value: SriSettingsForm[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  function validateForm(): string | null {
    if (!form.ambiente) return "Selecciona el ambiente.";
    if (!/^\d{3}$/.test(form.estab)) return "Estab debe tener 3 dígitos (ej: 001).";
    if (!/^\d{3}$/.test(form.ptoEmi)) return "PtoEmi debe tener 3 dígitos (ej: 001).";
    if (!Number.isFinite(form.secuencialActual) || form.secuencialActual < 1) {
      return "Secuencial actual debe ser >= 1.";
    }

    // Si el usuario sube P12, debe ingresar password (NO se guarda; solo para uso inmediato/backend)
    if (p12File && !p12Password) {
      return "Ingresa la contraseña del certificado (no se guardará).";
    }

    return null;
  }

  /* -----------------------------
   Save settings (Firestore + Storage)
  ----------------------------- */
  const handleSave = useCallback(async () => {
    if (!entityRef) return alert("Selecciona una empresa.");
    if (saving) return;

    const err = validateForm();
    if (err) return alert(err);

    try {
      setSaving(true);

      let p12Meta:
        | { storagePath: string; fileName: string; uploadedAt: any }
        | undefined;

      // 1) Upload P12 (optional)
      if (p12File) {
        const path = `entities/${entityId}/sri/p12/current.p12`;
        const fileRef = storageRef(storage, path);

        await uploadBytes(fileRef, p12File, {
          contentType: p12File.type || "application/x-pkcs12",
        });

        p12Meta = {
          storagePath: path,
          fileName: p12File.name,
          uploadedAt: serverTimestamp(),
        };

        setStoredP12Path(path);
      }

      // 2) Save Firestore
      const payload: any = {
        sriSettings: {
          ambiente: form.ambiente,
          estab: form.estab,
          ptoEmi: form.ptoEmi,
          secuencialActual: Number(form.secuencialActual),
          updatedAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      };

      if (p12Meta) {
        payload.sriSettings.p12 = p12Meta;
      }

      await updateDoc(entityRef, payload);

      // Limpia el file input luego de subir
      setP12File(null);

      alert("✅ Configuración SRI guardada.");
    } catch (e: any) {
      console.error("Error saving SRI settings:", e);
      alert(`❌ Error guardando configuración SRI: ${e?.message ?? "desconocido"}`);
    } finally {
      setSaving(false);
    }
  }, [entityRef, saving, validateForm, p12File, p12Password, form, storage, entityId]);

  if (!entityId) {
    return <div className="p-6">Selecciona una empresa.</div>;
  }

  if (loading) {
    return <div className="p-6">Cargando configuración SRI...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-[#0A3558]">Configuración SRI</h1>

      {/* Ambiente */}
      <section className="bg-white rounded-xl shadow p-6">
        <h2 className="font-semibold mb-4">Ambiente</h2>
        <select
          className="border rounded px-3 py-2"
          value={form.ambiente}
          onChange={(e) => handleChange("ambiente", e.target.value as "1" | "2")}
        >
          <option value="1">Pruebas</option>
          <option value="2">Producción</option>
        </select>
      </section>

      {/* Emisión */}
      <section className="bg-white rounded-xl shadow p-6">
        <h2 className="font-semibold mb-4">Datos de Emisión</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <input
            className="border rounded px-3 py-2"
            placeholder="Establecimiento (001)"
            value={form.estab}
            onChange={(e) => handleChange("estab", onlyDigits3(e.target.value))}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Punto de emisión (001)"
            value={form.ptoEmi}
            onChange={(e) => handleChange("ptoEmi", onlyDigits3(e.target.value))}
          />
          <input
            type="number"
            className="border rounded px-3 py-2"
            placeholder="Secuencial actual"
            value={form.secuencialActual}
            min={1}
            onChange={(e) => handleChange("secuencialActual", Number(e.target.value))}
          />
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Tip: estab y ptoEmi deben ser 3 dígitos (ej: 001). El secuencial se usa para la
          clave de acceso.
        </p>
      </section>

      {/* Certificado */}
      <section className="bg-white rounded-xl shadow p-6">
        <h2 className="font-semibold mb-2">Certificado Digital (P12)</h2>

        {storedP12Path ? (
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3 mb-4">
            ✅ Certificado ya cargado en Storage.
            <div className="text-xs text-green-800 mt-1 break-all">{storedP12Path}</div>
            <div className="text-xs text-gray-600 mt-2">
              Puedes subir uno nuevo para reemplazarlo (se guardará en la misma ruta).
            </div>
          </div>
        ) : (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3 mb-4">
            ⚠️ Aún no has subido un certificado P12.
          </div>
        )}

        <div className="space-y-3">
          <input
            type="file"
            accept=".p12"
            onChange={(e) => setP12File(e.target.files?.[0] ?? null)}
          />

          <input
            type="password"
            className="border rounded px-3 py-2 w-full"
            placeholder="Contraseña del certificado (no se guarda)"
            value={p12Password}
            onChange={(e) => setP12Password(e.target.value)}
          />

          <p className="text-xs text-gray-500">
            Importante: la contraseña NO se guarda en Firestore. Se usará solo cuando tu backend firme el XML.
          </p>
        </div>
      </section>

      {/* Actions */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-[#0A3558] text-white rounded disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar configuración SRI"}
        </button>
      </div>
    </div>
  );
}