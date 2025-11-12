// src/services/InvoiceUploaderImproved.tsx
import { v4 as uuidv4 } from "uuid";
import type { JournalEntry } from "@/types/JournalEntry";

interface ExtractionResponse {
  entries: JournalEntry[];
  metadata: {
    processedAt: string;
    durationMs: number;
    retries: number;
    entriesCount: number;
  };
}

/**
 * Extrae datos de factura usando OpenAI GPT-4
 * Versión mejorada con validación y retry
 */
export async function extractInvoiceDataWithAI(
  fullText: string | null,
  entityRUC: string,
  pdfBase64?: string,
  blocks?: any[]
): Promise<JournalEntry[]> {
  if (!fullText && !pdfBase64 && !blocks) {
    throw new Error("Se requiere fullText, pdfBase64, o blocks");
  }

  try {
    console.log("📤 Llamando a Netlify Function (OpenAI)...");
    console.log("🔹 Método:", pdfBase64 ? "PDF completo" : "Bloques de texto");
    
    const response = await fetch("/.netlify/functions/extract-invoice-openai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        blocks: blocks || (fullText ? [{ text: fullText }] : undefined),
        userRUC: entityRUC,
        pdfBase64 
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Manejo de errores específicos
      if (response.status === 422) {
        throw new Error(
          `Error de validación: ${errorData.details || errorData.error}`
        );
      }
      
      if (response.status === 429) {
        throw new Error(
          "Límite de API excedido. Por favor intenta nuevamente en unos momentos."
        );
      }
      
      throw new Error(
        errorData.error || `Error del servidor: ${response.status}`
      );
    }

    const data: ExtractionResponse = await response.json();

    if (!data.entries || !Array.isArray(data.entries)) {
      throw new Error("Respuesta inválida del servidor");
    }

    console.log(`✅ Recibidos ${data.entries.length} asientos`);
    console.log(`⏱️ Procesado en ${data.metadata.durationMs}ms`);
    console.log(`🔄 Reintentos: ${data.metadata.retries}`);

    // Validar balance en el cliente también
    const totalDebit = data.entries.reduce((s, e) => s + (e.debit || 0), 0);
    const totalCredit = data.entries.reduce((s, e) => s + (e.credit || 0), 0);
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      console.warn("⚠️ Asiento desbalanceado detectado en cliente");
    }

    // Agregar IDs únicos a cada entrada
    return data.entries.map((entry) => ({
      ...entry,
      id: uuidv4(),
      source: "ai" as const,
    }));

  } catch (err: any) {
    console.error("❌ Error en extractInvoiceDataWithAI:", err);
    throw err;
  }
}

/**
 * Convierte archivo PDF a base64
 */
export async function pdfToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    
    reader.onerror = () => reject(new Error("Error leyendo archivo PDF"));
    reader.readAsDataURL(file);
  });
}

/**
 * Procesa PDF directamente (método recomendado)
 */
export async function extractFromPDF(
  pdfFile: File,
  entityRUC: string
): Promise<JournalEntry[]> {
  try {
    console.log(`📄 Procesando PDF: ${pdfFile.name} (${(pdfFile.size / 1024).toFixed(1)} KB)`);
    
    const base64 = await pdfToBase64(pdfFile);
    return await extractInvoiceDataWithAI(null, entityRUC, base64);
    
  } catch (err: any) {
    console.error("❌ Error procesando PDF:", err);
    throw err;
  }
}

/**
 * Procesa usando bloques OCR (método legacy)
 */
export async function extractFromBlocks(
  blocks: any[],
  entityRUC: string
): Promise<JournalEntry[]> {
  try {
    console.log(`📋 Procesando ${blocks.length} bloques OCR`);
    
    return await extractInvoiceDataWithAI(null, entityRUC, undefined, blocks);
    
  } catch (err: any) {
    console.error("❌ Error procesando bloques:", err);
    throw err;
  }
}

/**
 * ============================
 * COMPONENTE REACT MEJORADO
 * ============================
 */

// src/components/InvoiceUploaderImproved.tsx
import React, { useState } from "react";

interface Props {
  entityRUC: string;
  onEntriesExtracted: (entries: JournalEntry[]) => void;
  onError?: (error: string) => void;
}

export function InvoiceUploaderImproved({ entityRUC, onEntriesExtracted, onError }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [progress, setProgress] = useState<string>("");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      const errMsg = "Por favor selecciona un archivo PDF válido";
      setError(errMsg);
      onError?.(errMsg);
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB
      const errMsg = "El archivo es demasiado grande (máximo 10MB)";
      setError(errMsg);
      onError?.(errMsg);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);
    setProgress("Leyendo archivo...");

    try {
      setProgress("Enviando a OpenAI...");
      const entries = await extractFromPDF(file, entityRUC);

      if (entries.length === 0) {
        throw new Error("No se pudieron extraer datos de la factura");
      }

      setProgress("Validando balance...");
      
      // Validar balance
      const totalDebit = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
      const totalCredit = entries.reduce((sum, e) => sum + (e.credit || 0), 0);

      console.log(`✅ ${entries.length} asientos extraídos`);
      console.log(`💰 Balance: D=${totalDebit.toFixed(2)}, C=${totalCredit.toFixed(2)}`);

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        console.warn("⚠️ Advertencia: Asiento ligeramente desbalanceado");
      }

      setProgress("¡Listo!");
      onEntriesExtracted(entries);
      setSuccess(true);

      // Limpiar el input
      e.target.value = "";

    } catch (err: any) {
      console.error("❌ Error:", err);
      const errMsg = err.message || "Error procesando la factura";
      setError(errMsg);
      onError?.(errMsg);
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(""), 2000);
    }
  };

  return (
    <div className="invoice-uploader-improved">
      <div className="upload-container">
        <label className={`upload-button ${loading ? "loading" : ""}`}>
          {loading ? (
            <span>
              <span className="spinner">⌛</span>
              {progress}
            </span>
          ) : (
            "📄 Subir Factura PDF"
          )}
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            disabled={loading}
            style={{ display: "none" }}
          />
        </label>
      </div>

      {error && (
        <div className="error-message" role="alert">
          <strong>⚠️ Error:</strong> {error}
        </div>
      )}

      {success && (
        <div className="success-message" role="status">
          ✅ Factura procesada correctamente
        </div>
      )}

      <style>{`
        .invoice-uploader-improved {
          padding: 1rem;
        }

        .upload-button {
          display: inline-block;
          padding: 0.75rem 1.5rem;
          background: #4F46E5;
          color: white;
          border-radius: 0.5rem;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }

        .upload-button:hover:not(.loading) {
          background: #4338CA;
          transform: translateY(-1px);
        }

        .upload-button.loading {
          background: #9CA3AF;
          cursor: wait;
        }

        .spinner {
          display: inline-block;
          animation: spin 1s linear infinite;
          margin-right: 0.5rem;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .error-message {
          margin-top: 1rem;
          padding: 0.75rem;
          background: #FEE2E2;
          border: 1px solid #EF4444;
          border-radius: 0.5rem;
          color: #991B1B;
        }

        .success-message {
          margin-top: 1rem;
          padding: 0.75rem;
          background: #D1FAE5;
          border: 1px solid #10B981;
          border-radius: 0.5rem;
          color: #065F46;
        }
      `}</style>
    </div>
  );
}

/**
 * ============================
 * COMPARACIÓN: ORIGINAL vs MEJORADO
 * ============================
 */

/*
╔══════════════════════════════════════════════════════════════════╗
║                   MEJORAS IMPLEMENTADAS                          ║
╠══════════════════════════════════════════════════════════════════╣
║ ✅ 1. VALIDACIÓN DE BALANCE (CRÍTICO)                           ║
║     Original: ❌ No validaba que débitos = créditos             ║
║     Mejorado: ✅ Valida con tolerancia de $0.01                 ║
║                                                                  ║
║ ✅ 2. LIMPIEZA DE JSON ROBUSTA                                  ║
║     Original: Regex agresivos que eliminaban contenido válido   ║
║     Mejorado: Limpieza precisa preservando el JSON              ║
║                                                                  ║
║ ✅ 3. RETRY LOGIC                                               ║
║     Original: ❌ Fallaba al primer error                        ║
║     Mejorado: ✅ Hasta 2 reintentos automáticos                 ║
║                                                                  ║
║ ✅ 4. MANEJO DE ERRORES ESPECÍFICOS                             ║
║     Original: Errores genéricos 500                             ║
║     Mejorado: Códigos HTTP apropiados (400, 422, 429, 500)      ║
║                                                                  ║
║ ✅ 5. LOGS DETALLADOS                                           ║
║     Original: Logs básicos                                       ║
║     Mejorado: Logs con timestamps, duración, intentos           ║
║                                                                  ║
║ ✅ 6. SOPORTE DUAL: PDF + BLOQUES                               ║
║     Original: Solo bloques OCR                                   ║
║     Mejorado: PDF directo (preferido) o bloques legacy          ║
║                                                                  ║
║ ✅ 7. VALIDACIÓN DE ESTRUCTURA                                  ║
║     Original: ❌ Asumía estructura correcta                     ║
║     Mejorado: ✅ Valida cada campo antes de retornar            ║
║                                                                  ║
║ ✅ 8. METADATA EN RESPUESTA                                     ║
║     Original: Solo los asientos                                  ║
║     Mejorado: + duración, reintentos, timestamp                 ║
║                                                                  ║
║ ✅ 9. CORS HEADERS                                              ║
║     Original: ❌ No incluidos                                   ║
║     Mejorado: ✅ Permite llamadas cross-origin                  ║
║                                                                  ║
║ ✅ 10. PROMPT MEJORADO                                          ║
║     Original: Instrucciones mezcladas                            ║
║     Mejorado: Estructura clara, ejemplos, énfasis en balance    ║
╚══════════════════════════════════════════════════════════════════╝

MIGRACIÓN PASO A PASO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣ RENOMBRAR TU FUNCIÓN ACTUAL
   - Renombra: extract-invoice-layout.ts → extract-invoice-layout-old.ts
   - Mantén como backup

2️⃣ CREAR LA NUEVA FUNCIÓN
   - Crea: extract-invoice-openai.ts
   - Copia el código mejorado de arriba

3️⃣ ACTUALIZAR LLAMADAS EN EL FRONTEND
   
   Antes:
   ```typescript
   const response = await fetch("/.netlify/functions/extract-invoice-layout", {
     method: "POST",
     body: JSON.stringify({ blocks, userRUC }),
   });
   ```

   Después (Método 1 - PDF directo, recomendado):
   ```typescript
   const pdfBase64 = await pdfToBase64(pdfFile);
   const response = await fetch("/.netlify/functions/extract-invoice-openai", {
     method: "POST",
     body: JSON.stringify({ pdfBase64, userRUC }),
   });
   ```

   Después (Método 2 - Bloques OCR, compatible con tu código actual):
   ```typescript
   const response = await fetch("/.netlify/functions/extract-invoice-openai", {
     method: "POST",
     body: JSON.stringify({ blocks, userRUC }),
   });
   ```

4️⃣ ACTUALIZAR MANEJO DE RESPUESTA
   
   Antes:
   ```typescript
   const parsed = await response.json(); // Array directo
   ```

   Después:
   ```typescript
   const data = await response.json();
   const parsed = data.entries; // Array dentro de objeto
   console.log(`Procesado en ${data.metadata.durationMs}ms`);
   ```

5️⃣ MEJORAR MANEJO DE ERRORES
   
   Antes:
   ```typescript
   if (!response.ok) throw new Error(`API error: ${response.status}`);
   ```

   Después:
   ```typescript
   if (!response.ok) {
     const errorData = await response.json().catch(() => ({}));
     
     if (response.status === 422) {
       alert(`Error de validación: ${errorData.details}`);
     } else if (response.status === 429) {
       alert("Límite de API excedido. Espera un momento.");
     } else {
       alert(`Error: ${errorData.error}`);
     }
     return;
   }
   ```

6️⃣ PROBAR CON TU FACTURA DE EJEMPLO
   - Usa la factura El Rosado de tu screenshot
   - Verifica que genere 3 asientos balanceados
   - Confirma balance: $5.23 = $5.19 + $0.04

7️⃣ MONITOREAR LOGS EN NETLIFY
   - Revisa los logs detallados
   - Verifica tiempos de respuesta
   - Confirma que no hay errores de balance

8️⃣ SI TODO FUNCIONA, ELIMINAR CÓDIGO VIEJO
   - Después de 1 semana de pruebas exitosas
   - Elimina extract-invoice-layout-old.ts

TESTING CHECKLIST:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

□ Factura con IVA 15% → Balance correcto
□ Factura con IVA 12% → Balance correcto  
□ Factura con IVA 0% → Sin cuenta IVA
□ Factura de compra → type: "expense"
□ Factura de venta → type: "income"
□ PDF grande (>1MB) → Procesa correctamente
□ PDF con imágenes → OCR funciona
□ Texto mal formateado → Reintentos exitosos
□ Error de API → Mensaje claro al usuario
□ Balance desbalanceado → Error 422 con detalles

TROUBLESHOOTING COMÚN:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ Error: "JSON inválido de OpenAI"
   → Revisar logs, GPT-4 agregó texto antes/después del JSON
   → Solución: cleanJSONResponse() lo maneja automáticamente

❌ Error: "Asiento desbalanceado"
   → GPT-4 calculó mal el IVA o el total
   → Solución: Reintentos automáticos (hasta 2)
   → Si persiste: Revisar el prompt, agregar más ejemplos

❌ Error: "Límite de API excedido" (429)
   → Has alcanzado el límite de OpenAI
   → Solución: Esperar o aumentar límite en OpenAI dashboard

❌ Débitos ≠ Créditos por $0.01
   → Error de redondeo normal
   → Solución: Tolerancia de $0.01 ya incluida

❌ Cuenta incorrecta asignada
   → GPT-4 no reconoció el tipo de gasto
   → Solución: Mejorar el mapeo en ACCOUNTING_PROMPT

PERFORMANCE ESPERADA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏱️ PDF directo: 3-8 segundos
⏱️ Bloques OCR: 2-5 segundos
⏱️ Con retry: +2-4 segundos adicionales
💰 Costo: ~$0.01-0.03 por factura (GPT-4o)

PRÓXIMOS PASOS RECOMENDADOS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Implementar caché para facturas ya procesadas
2. Agregar UI para corregir asientos antes de guardar
3. Implementar batch processing para múltiples PDFs
4. Agregar analytics: tiempo promedio, tasa de éxito, etc.
5. Crear dashboard para monitorear calidad de extracción
*/