// ============================================================================
// generateXML.ts
// Punto central para generar XML SRI Factura (DTE v1.1.0)
//
// Utiliza xmlBuilder.ts para armar el XML y devolver claveAcceso + XML.
// Este archivo es consumido por firmadores (signXML.ts) y luego por sendToSRI.ts
// ============================================================================

import {
  generateSriInvoiceXmlV2,
  type SriEmitterInfo,
  type SriClientInfo,
  type InvoiceForSri,
  type SriEnvironment
} from "./xmlBuilder";

// ============================================================================
// Tipos que provienen del sistema Contilisto (frontend + backend)
// Aquí puedes ajustar según tu modelo real de Factura y Empresa
// ============================================================================

export interface Empresa {
  id: string;
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  direccionMatriz: string;
  direccionEstablecimiento?: string;
  codigoEstablecimiento: string; // ej: "001"
  puntoEmision: string;          // ej: "001"
  contribuyenteEspecial?: string;
  obligadoContabilidad?: boolean;
  ambienteSri: SriEnvironment;   // 1 o 2
}

export interface Cliente {
  id: string;
  tipoIdentificacion: "04" | "05" | "06" | "07";
  identificacion: string;
  razonSocial: string;
  direccion?: string;
  email?: string;
  telefono?: string;
}

export interface ItemFactura {
  code?: string;
  productCode?: string;
  sriCode?: string;

  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento?: number;
  ivaRate: 0 | 12 | 15;
}

export interface Factura {
  internalId: string;
  fechaEmision: Date;
  moneda?: string;
  secuencial: string;        // "000000123"
  items: ItemFactura[];
  additionalInfo?: Record<string, string>;
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

export interface GenerateXMLResult {
  xml: string;
  accessKey: string;
}

export async function generateXML(
  empresa: Empresa,
  cliente: Cliente,
  factura: Factura
): Promise<GenerateXMLResult> {
  // -------------------------------------------------------------------------
  // 1) Mapear empresa → SriEmitterInfo
  // -------------------------------------------------------------------------
  const emitter: SriEmitterInfo = {
    ruc: empresa.ruc,
    businessName: empresa.razonSocial,
    tradeName: empresa.nombreComercial,
    mainAddress: empresa.direccionMatriz,
    establishmentAddress: empresa.direccionEstablecimiento,
    estabCode: empresa.codigoEstablecimiento,
    emissionPointCode: empresa.puntoEmision,
    specialContributorNumber: empresa.contribuyenteEspecial,
    accountingRequired: empresa.obligadoContabilidad ?? false,
  };

  // -------------------------------------------------------------------------
  // 2) Mapear cliente → SriClientInfo
  // -------------------------------------------------------------------------
  const client: SriClientInfo = {
    idType: cliente.tipoIdentificacion,
    idNumber: cliente.identificacion,
    name: cliente.razonSocial,
    address: cliente.direccion,
    email: cliente.email,
    phone: cliente.telefono,
  };

  // -------------------------------------------------------------------------
  // 3) Mapear factura → InvoiceForSri
  // -------------------------------------------------------------------------
  const invoice: InvoiceForSri = {
    internalId: factura.internalId,
    issueDate: factura.fechaEmision,
    currency: factura.moneda ?? "USD",
    items: factura.items.map((i) => ({
      code: i.code,
      productCode: i.productCode,
      sriCode: i.sriCode,
      description: i.descripcion,
      quantity: i.cantidad,
      unitPrice: i.precioUnitario,
      discount: i.descuento,
      ivaRate: i.ivaRate,
    })),
    sequential: factura.secuencial,
    additionalInfo: factura.additionalInfo,
  };

  // -------------------------------------------------------------------------
  // 4) Llamar al motor xmlBuilder
  // -------------------------------------------------------------------------
  const { xml, accessKey } = generateSriInvoiceXmlV2({
    environment: empresa.ambienteSri,
    emissionType: "1",
    documentType: "01",
    emitter,
    client,
    invoice,
  });

  // -------------------------------------------------------------------------
  // 5) Retornar resultado
  // -------------------------------------------------------------------------
  return { xml, accessKey };
}