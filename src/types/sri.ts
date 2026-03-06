// src/types/sri.ts

export type IvaDeclarationSummary = {
  period: string;

  ventas12: number;
  ventas0: number;
  ivaVentas: number;

  compras12: number;
  compras0: number;
  ivaCompras: number;

  retIvaRecibidas: number;
  saldoCreditoAnterior: number;

  totalCredito: number;
  ivaPagar: number;
  saldoArrastrar: number;

  warnings: string[];
};

export type IvaSourceRow = {
  id?: string;
  date?: string;
  account_code?: string;
  account_name?: string;
  debit?: number;
  credit?: number;
  source?: string;
  invoice_number?: string;
  entityId?: string;
};