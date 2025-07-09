

export const PUCExpenseStructure = {
    subtotal: { code: "60601", name: "Compras locales" },
    ice: { code: "53901", name: "Otros tributos" },
    iva: { code: "24301", name: "IVA crédito tributario" },
    total: { code: "21101", name: "Cuentas por pagar comerciales locales" },
  };

  // Full PUC chart (for use in UI dropdowns, validation, etc.)
  export const PUCAccountsFull = {
  "1140101": {
    "name": "IVA Crédito Tributario",
    "type": "asset",
    "usage": "Used for IVA paid on purchases (input tax credit)"
  },
  "2110101": {
    "name": "Cuentas por Pagar Comerciales - Nacionales",
    "type": "liability",
    "usage": "Used for total invoice payable to suppliers"
  },
  "5010101": {
    "name": "Compras de Mercaderías",
    "type": "expense",
    "usage": "Used for merchandise purchases"
  },
  "5020101": {
    "name": "Compras de Materia Prima",
    "type": "expense",
    "usage": "Used for raw material purchases"
  },
  "5020301": {
    "name": "Compras de Suministros",
    "type": "expense",
    "usage": "Used for supply purchases"
  },
  "5010199": {
    "name": "Otros Impuestos a la Producción y Consumo (ICE)",
    "type": "expense",
    "usage": "Used for ICE tax on purchases"
  }
};