import type { RawAccount } from "@/types/AccountTypes";

const RAW_COA: RawAccount[] = [
  // ===============================
  // 1 - ACTIVO
  // ===============================

  { code: "1", name: "ACTIVO", level: 1, parentCode: null },

  { code: "101", name: "ACTIVO CORRIENTE", level: 2, parentCode: "1" },

  { code: "10101", name: "EFECTIVO Y EQUIVALENTES DE EFECTIVO", level: 3, parentCode: "101" },

  { code: "1010101", name: "CAJA", level: 4, parentCode: "10101", postable: true },
  { code: "1010102", name: "INSTITUCIONES FINANCIERAS PÚBLICAS", level: 4, parentCode: "10101", postable: true },
  { code: "1010103", name: "INSTITUCIONES FINANCIERAS PRIVADAS", level: 4, parentCode: "10101", postable: true },

  { code: "10102", name: "ACTIVOS FINANCIEROS", level: 3, parentCode: "101" },

  { code: "1010201", name: "ACTIVOS FINANCIEROS A VALOR RAZONABLE CON CAMBIOS EN RESULTADOS", level: 4, parentCode: "10102" },

  { code: "101020101", name: "RENTA VARIABLE", level: 5, parentCode: "1010201" },
  { code: "10102010101", name: "ACCIONES Y PARTICIPACIONES", level: 6, parentCode: "101020101", postable: true },
  { code: "10102010102", name: "CUOTAS DE FONDOS COLECTIVOS", level: 6, parentCode: "101020101", postable: true },
  { code: "10102010103", name: "VALORES DE TITULARIZACIÓN DE PARTICIPACIÓN", level: 6, parentCode: "101020101", postable: true },
  { code: "10102010104", name: "UNIDADES DE PARTICIPACIÓN", level: 6, parentCode: "101020101", postable: true },
  { code: "10102010105", name: "INVERSIONES EN EL EXTERIOR", level: 6, parentCode: "101020101", postable: true },
  { code: "10102010106", name: "OTROS", level: 6, parentCode: "101020101", postable: true },

  { code: "101020102", name: "RENTA FIJA", level: 5, parentCode: "1010201" },
  { code: "10102010201", name: "AVALES", level: 6, parentCode: "101020102", postable: true },
  { code: "10102010202", name: "BONOS DEL ESTADO", level: 6, parentCode: "101020102", postable: true },
  { code: "10102010203", name: "BONOS DE PRENDA", level: 6, parentCode: "101020102", postable: true },
  { code: "10102010204", name: "CÉDULAS HIPOTECARIAS", level: 6, parentCode: "101020102", postable: true },
  { code: "10102010205", name: "CERTIFICADOS FINANCIEROS", level: 6, parentCode: "101020102", postable: true },
  { code: "10102010206", name: "CERTIFICADOS DE INVERSIÓN", level: 6, parentCode: "101020102", postable: true },
  { code: "10102010207", name: "CERTIFICADOS DE TESORERÍA", level: 6, parentCode: "101020102", postable: true },
  { code: "10102010208", name: "CERTIFICADOS DE DEPÓSITO", level: 6, parentCode: "101020102", postable: true },
  { code: "10102010209", name: "CUPONES", level: 6, parentCode: "101020102", postable: true },
  { code: "10102010210", name: "DEPÓSITOS A PLAZO", level: 6, parentCode: "101020102", postable: true },
  { code: "10102010211", name: "LETRAS DE CAMBIO", level: 6, parentCode: "101020102", postable: true },
  { code: "10102010212", name: "NOTAS DE CRÉDITO", level: 6, parentCode: "101020102", postable: true },
  { code: "10102010213", name: "OBLIGACIONES", level: 6, parentCode: "101020102", postable: true },
  { code: "10102010214", name: "FACTURAS COMERCIALES NEGOCIABLES", level: 6, parentCode: "101020102", postable: true },
  { code: "10102010215", name: "OVERNIGHTS", level: 6, parentCode: "101020102", postable: true },
  { code: "10102010216", name: "OBLIGACIONES CONVERTIBLES EN ACCIONES", level: 6, parentCode: "101020102", postable: true },
  { code: "10102010217", name: "PAPEL COMERCIAL", level: 6, parentCode: "101020102", postable: true },
  { code: "10102010218", name: "PAGARÉS", level: 6, parentCode: "101020102", postable: true },
  { code: "10102010219", name: "PÓLIZAS DE ACUMULACIÓN", level: 6, parentCode: "101020102", postable: true },
  { code: "10102010220", name: "TÍTULOS DEL BANCO CENTRAL", level: 6, parentCode: "101020102", postable: true },
  { code: "10102010221", name: "VALORES DE TITULARIZACIÓN", level: 6, parentCode: "101020102", postable: true },
  { code: "10102010222", name: "INVERSIONES EN EL EXTERIOR", level: 6, parentCode: "101020102", postable: true },
  { code: "10102010223", name: "OTROS", level: 6, parentCode: "101020102", postable: true },

  { code: "101020103", name: "DERIVADOS", level: 5, parentCode: "1010201" },
  { code: "10102010301", name: "FORWARD", level: 6, parentCode: "101020103", postable: true },
  { code: "10102010302", name: "FUTUROS", level: 6, parentCode: "101020103", postable: true },
  { code: "10102010303", name: "OPCIONES", level: 6, parentCode: "101020103", postable: true },
  { code: "10102010304", name: "OTROS", level: 6, parentCode: "101020103", postable: true },

  // -----------------------------
  // ACTIVO CORRIENTE CUENTAS POR COBRAR
  // -----------------------------

  { code: "10103", name: "Cuentas por cobrar", level: 3, parentCode: "101" },
  { code: "1010301",  name: "Clientes", level: 4, parentCode: "10103" },
  { code: "101030101", name: "Clientes nacionales", level: 5, parentCode: "1010301", postable: true },
  { code: "101030102", name: "Clientes del exterior", level: 5, parentCode: "1010301", postable: true },

  // ===============================
  // 13 - IMPUESTOS (ACTIVO)
  // ===============================

  { code: "13", name: "IMPUESTOS POR RECUPERAR", level: 2 },
  { code: "133", name: "IVA CRÉDITO TRIBUTARIO", level: 3 },
  { code: "13301", name: "IVA CRÉDITO EN COMPRAS", level: 4 },
  { code: "1330101", name: "IVA 12% CRÉDITO TRIBUTARIO", level: 5 },
  { code: "133010102", name: "IVA 12% CREDITO EN COMPRAS", level: 6, postable: true },
  { code: "1330102", name: "IVA 0% CRÉDITO TRIBUTARIO", level: 5, postable: true },

  // ===============================
  // 2 - PASIVO
  // ===============================

  { code: "2", name: "PASIVO", level: 1, parentCode: null },
  { code: "201", name: "PASIVO CORRIENTE", level: 2, parentCode: "2" },
  { code: "20102", name: "IMPUESTOS POR PAGAR", level: 3, parentCode: "201" },
  { code: "2010201", name: "IVA POR PAGAR", level: 4, parentCode: "20102" },
  { code: "201020101", name: "IVA DEBITO EN VENTAS", level: 5, parentCode: "2010201", postable: true },
  { code: "20103", name: "CUENTAS Y DOCUMENTOS POR PAGAR", level: 3, parentCode: "201" },
  { code: "2010301", name: "LOCALES", level: 4, parentCode: "20103" },
  { code: "201030101", name: "PRÉSTAMOS", level: 5, parentCode: "2010301", postable: true },
  { code: "201030102", name: "PROVEEDORES", level: 5, parentCode: "2010301", postable: true },
  


  // ===============================
  // 3 - PATRIMONIO
  // ===============================

  { code: "3", name: "PATRIMONIO NETO", level: 1, parentCode: null },

  // --------------------------------
  // 301 - CAPITAL
  // --------------------------------
  { code: "301", name: "CAPITAL", level: 2, parentCode: "3" },

  { code: "30101", name: "CAPITAL SUSCRITO O ASIGNADO", level: 3, parentCode: "301", postable: true },
  { code: "30102", name: "CAPITAL PAGADO", level: 3, parentCode: "301", postable: true },
  { code: "30103", name: "CAPITAL POR COBRAR", level: 3, parentCode: "301", postable: true },

  // --------------------------------
  // 302 - APORTES DE SOCIOS
  // --------------------------------
  { code: "302", name: "APORTES DE SOCIOS O ACCIONISTAS", level: 2, parentCode: "3" },

  { code: "30201", name: "APORTES PARA FUTURAS CAPITALIZACIONES", level: 3, parentCode: "302", postable: true },
  { code: "30202", name: "PRIMAS EN EMISIÓN DE ACCIONES", level: 3, parentCode: "302", postable: true },

  // --------------------------------
  // 303 - RESERVAS
  // --------------------------------
  { code: "303", name: "RESERVAS", level: 2, parentCode: "3" },

  { code: "30301", name: "RESERVA LEGAL", level: 3, parentCode: "303", postable: true },
  { code: "30302", name: "RESERVAS ESTATUTARIAS", level: 3, parentCode: "303", postable: true },
  { code: "30303", name: "RESERVAS FACULTATIVAS", level: 3, parentCode: "303", postable: true },

  // --------------------------------
  // 304 - SUPERÁVIT
  // --------------------------------
  { code: "304", name: "SUPERÁVIT", level: 2, parentCode: "3" },

  { code: "30401", name: "SUPERÁVIT POR REVALUACIÓN", level: 3, parentCode: "304", postable: true },
  { code: "30402", name: "SUPERÁVIT POR DONACIONES", level: 3, parentCode: "304", postable: true },

  // --------------------------------
  // 305 - RESULTADOS ACUMULADOS
  // --------------------------------
  { code: "305", name: "RESULTADOS ACUMULADOS", level: 2, parentCode: "3" },

  { code: "30501", name: "UTILIDADES RETENIDAS", level: 3, parentCode: "305", postable: true },
  { code: "30502", name: "PÉRDIDAS ACUMULADAS", level: 3, parentCode: "305", postable: true },

  // --------------------------------
  // 307 - RESULTADO DEL EJERCICIO
  // --------------------------------
  { code: "307", name: "RESULTADOS DEL EJERCICIO", level: 2, parentCode: "3" },

  { code: "30701", name: "GANANCIA NETA DEL PERIODO", level: 3, parentCode: "307", postable: true },
  { code: "30702", name: "(-) PÉRDIDA NETA DEL PERIODO", level: 3, parentCode: "307", postable: true },
  
  { code: "308", name: "DIVIDENDOS DECLARADOS", level: 2, parentCode: "3" },
  { code: "30801", name: "DIVIDENDOS POR PAGAR", level: 3, parentCode: "308", postable: true },
  
  // ===============================
  // 4 - INGRESOS
  // ===============================

  { code: "4", name: "INGRESOS", level: 1, parentCode: null },
  { code: "401", name: "INGRESOS DE ACTIVIDADES ORDINARIAS", level: 2, parentCode: "4" },
  { code: "40102", name: "PRESTACIÓN DE SERVICIOS", level: 3, parentCode: "401" },
  { code: "4010201", name: "INGRESOS POR ASESORÍA", level: 4, parentCode: "40102" },
  { code: "401020101", name: "INGRESOS POR ASESORÍA CONTABLE", level: 5, parentCode: "4010201", postable: true },
  

  // ===============================
  // 5 - GASTOS
  // ===============================

  { code: "5", name: "GASTOS", level: 1, parentCode: null },
  { code: "501", name: "COSTO DE VENTAS Y PRODUCCIÓN", level: 2, parentCode: "5" },
  { code: "50101", name: "MATERIALES UTILIZADOS O PRODUCTOS VENDIDOS", level: 3, parentCode: "501", postable: true },

  { code: "502", name: "GASTOS OPERACIONALES", level: 2, parentCode: "5" },
  { code: "50201", name: "GASTOS DE VENTA", level: 3, parentCode: "502" },
  { code: "5020101", name: "GASTOS EN SERVICIOS GENERALES", level: 4, parentCode: "50201" },
  { code: "502010101", name: "GASTOS EN ALIMENTACIÓN", level: 5, parentCode: "5020101", postable: true },

  { code: "50202", name: "GASTOS ADMINISTRATIVOS", level: 3, parentCode: "502" },
  { code: "5020201", name: "GASTOS DE OFICINA", level: 4, parentCode: "50202" },
  { code: "502020101", name: "GASTOS DE PAPELERÍA DE OFICINA", level: 5, parentCode: "5020201", postable: true },

  { code: "50203", name: "GASTOS FINANCIEROS", level: 3, parentCode: "502" },
  { code: "5020301", name: "INTERESES", level: 4, parentCode: "50203" },
  { code: "502030101", name: "INTERESES POR PRÉSTAMOS", level: 5, parentCode: "5020301", postable: true },
];

export default RAW_COA;