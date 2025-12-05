// src/types/InvoiceItem.ts
export interface InvoiceItem {
  id: string; // uuid
  description: string;
  
  quantity: number;
  unitPrice: number;
  discount?: number;

  // TAX
  ivaRate: number;     // 0, 12, 15
  ivaValue: number;    // (quantity * unitPrice - discount) * ivaRate
  
  // Totals
  subtotal: number;    // (quantity * unitPrice - discount)
  total: number;       // subtotal + ivaValue
  
  // Options Catalog / SRI
  productCode?: string; 
  sriCode?: string;    // Código principal SRI (optional but recommended)
}