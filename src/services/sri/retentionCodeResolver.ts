// ============================================================================
// CONTILISTO — SRI RETENTION CODE RESOLVER
// Maps accounting → SRI codes
// ============================================================================

export function resolveRentaCode(base: number, amount: number) {
  if (!base || !amount) return null;

  const percent = +(amount / base * 100).toFixed(2);

  // =========================
  // COMMON ECUADOR CODES
  // =========================
  if (percent === 1) return { code: "332", percent };
  if (percent === 1.75) return { code: "333", percent };
  if (percent === 2) return { code: "334", percent };
  if (percent === 8) return { code: "344", percent };
  if (percent === 10) return { code: "345", percent };

  return { code: "999", percent }; // fallback
}

export function resolveIvaCode(amount: number) {
  if (!amount) return null;

  // IVA retentions usually:
  // 30%, 50%, 70%, 100%
  // (but applied to IVA, not base)

  return {
    code: "441", // generic IVA retention
    percent: null,
  };
}