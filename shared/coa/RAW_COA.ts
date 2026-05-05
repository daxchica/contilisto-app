import type { RawAccount } from "@/types/AccountTypes";

// ============================================================================
// PLAN DE CUENTAS — ECUADOR (NIIF PARA PYMES / PUC SCVS)
// Versión completa para PYMES ecuatorianas
// IVA vigente: 15% (Decreto Ejecutivo No. 111, abril 2024)
// ============================================================================

const raw_coa: RawAccount[] = [

  // ==========================================================================
  // 1 — ACTIVO
  // ==========================================================================

  { code: "1", name: "ACTIVO", level: 1, parentCode: null },

  // ─────────────────────────────────────────────────────────────────────────
  // 101  ACTIVO CORRIENTE
  // ─────────────────────────────────────────────────────────────────────────

  { code: "101", name: "ACTIVO CORRIENTE", level: 2, parentCode: "1" },

  // 10101  Efectivo y equivalentes de efectivo
  { code: "10101", name: "EFECTIVO Y EQUIVALENTES DE EFECTIVO", level: 3, parentCode: "101" },
    { code: "1010101", name: "CAJA",                                   level: 4, parentCode: "10101", postable: true },
    { code: "1010102", name: "INSTITUCIONES FINANCIERAS PÚBLICAS",     level: 4, parentCode: "10101", postable: true },
    { code: "1010103", name: "INSTITUCIONES FINANCIERAS PRIVADAS",     level: 4, parentCode: "10101", postable: true, isBank: true },

  // 10102  Activos financieros a valor razonable
  { code: "10102", name: "ACTIVOS FINANCIEROS", level: 3, parentCode: "101" },

    { code: "1010201", name: "A VALOR RAZONABLE CON CAMBIOS EN RESULTADOS", level: 4, parentCode: "10102" },
      { code: "101020101", name: "RENTA VARIABLE", level: 5, parentCode: "1010201" },
        { code: "10102010101", name: "ACCIONES Y PARTICIPACIONES",                level: 6, parentCode: "101020101", postable: true },
        { code: "10102010102", name: "CUOTAS DE FONDOS COLECTIVOS",               level: 6, parentCode: "101020101", postable: true },
        { code: "10102010103", name: "VALORES DE TITULARIZACIÓN DE PARTICIPACIÓN",level: 6, parentCode: "101020101", postable: true },
        { code: "10102010104", name: "INVERSIONES EN EL EXTERIOR",                level: 6, parentCode: "101020101", postable: true },
      { code: "101020102", name: "RENTA FIJA", level: 5, parentCode: "1010201" },
        { code: "10102010201", name: "DEPÓSITOS A PLAZO",                         level: 6, parentCode: "101020102", postable: true },
        { code: "10102010202", name: "CERTIFICADOS DE DEPÓSITO",                  level: 6, parentCode: "101020102", postable: true },
        { code: "10102010203", name: "PÓLIZAS DE ACUMULACIÓN",                    level: 6, parentCode: "101020102", postable: true },
        { code: "10102010204", name: "BONOS DEL ESTADO",                          level: 6, parentCode: "101020102", postable: true },
        { code: "10102010205", name: "TÍTULOS DEL BANCO CENTRAL",                 level: 6, parentCode: "101020102", postable: true },
        { code: "10102010206", name: "LETRAS DE CAMBIO",                          level: 6, parentCode: "101020102", postable: true },
        { code: "10102010207", name: "PAGARÉS",                                   level: 6, parentCode: "101020102", postable: true },
        { code: "10102010208", name: "OTROS ACTIVOS FINANCIEROS DE RENTA FIJA",   level: 6, parentCode: "101020102", postable: true },

  // 10103  Cuentas y documentos por cobrar
  { code: "10103", name: "CUENTAS Y DOCUMENTOS POR COBRAR", level: 3, parentCode: "101" },

    { code: "1010301", name: "CLIENTES POR COBRAR", level: 4, parentCode: "10103" },
      { code: "101030101", name: "CLIENTES NACIONALES",   level: 5, parentCode: "1010301", postable: true, isReceivable: true },
      { code: "101030102", name: "CLIENTES DEL EXTERIOR", level: 5, parentCode: "1010301", postable: true },

    { code: "1010302", name: "OTRAS CUENTAS POR COBRAR", level: 4, parentCode: "10103" },
      { code: "101030201", name: "ANTICIPOS A EMPLEADOS",          level: 5, parentCode: "1010302", postable: true },
      { code: "101030202", name: "PRÉSTAMOS A ACCIONISTAS/SOCIOS",  level: 5, parentCode: "1010302", postable: true },
      { code: "101030203", name: "OTRAS CUENTAS POR COBRAR VARIAS", level: 5, parentCode: "1010302", postable: true },

    { code: "1010303", name: "(-) PROVISIÓN CUENTAS INCOBRABLES", level: 4, parentCode: "10103", postable: true },

  // 10104  Inventarios
  { code: "10104", name: "INVENTARIOS", level: 3, parentCode: "101" },
    { code: "1010401", name: "INVENTARIO DE MERCADERÍAS",           level: 4, parentCode: "10104", postable: true },
    { code: "1010402", name: "INVENTARIO DE MATERIAS PRIMAS",       level: 4, parentCode: "10104", postable: true },
    { code: "1010403", name: "INVENTARIO DE PRODUCTOS EN PROCESO",  level: 4, parentCode: "10104", postable: true },
    { code: "1010404", name: "INVENTARIO DE PRODUCTOS TERMINADOS",  level: 4, parentCode: "10104", postable: true },
    { code: "1010405", name: "INVENTARIO DE SUMINISTROS Y MATERIALES", level: 4, parentCode: "10104", postable: true },

  // 10105  Activos por impuestos corrientes y pagos anticipados
  { code: "10105", name: "ACTIVOS POR IMPUESTOS Y PAGOS ANTICIPADOS", level: 3, parentCode: "101" },
    { code: "1010501", name: "ANTICIPO IMPUESTO A LA RENTA",                level: 4, parentCode: "10105", postable: true },
    { code: "1010502", name: "CRÉDITO TRIBUTARIO IR AÑOS ANTERIORES",       level: 4, parentCode: "10105", postable: true },
    { code: "1010503", name: "ANTICIPO A PROVEEDORES",                       level: 4, parentCode: "10105", postable: true },
    { code: "1010504", name: "SEGUROS PAGADOS POR ANTICIPADO",               level: 4, parentCode: "10105", postable: true },
    { code: "1010505", name: "ARRIENDOS PAGADOS POR ANTICIPADO",             level: 4, parentCode: "10105", postable: true },
    { code: "1010506", name: "OTROS PAGOS ANTICIPADOS Y ACTIVOS CORRIENTES", level: 4, parentCode: "10105", postable: true },

  // ─────────────────────────────────────────────────────────────────────────
  // 102  ACTIVO NO CORRIENTE
  // ─────────────────────────────────────────────────────────────────────────

  { code: "102", name: "ACTIVO NO CORRIENTE", level: 2, parentCode: "1" },

  // 10201  Propiedades, planta y equipo
  { code: "10201", name: "PROPIEDADES, PLANTA Y EQUIPO", level: 3, parentCode: "102" },
    { code: "1020101", name: "TERRENOS",                    level: 4, parentCode: "10201", postable: true },
    { code: "1020102", name: "EDIFICIOS Y LOCALES",         level: 4, parentCode: "10201", postable: true },
    { code: "1020103", name: "MUEBLES Y ENSERES",           level: 4, parentCode: "10201", postable: true },
    { code: "1020104", name: "MAQUINARIA Y EQUIPO",         level: 4, parentCode: "10201", postable: true },
    { code: "1020105", name: "EQUIPOS DE COMPUTACIÓN",      level: 4, parentCode: "10201", postable: true },
    { code: "1020106", name: "VEHÍCULOS",                   level: 4, parentCode: "10201", postable: true },
    { code: "1020107", name: "OTROS ACTIVOS FIJOS",         level: 4, parentCode: "10201", postable: true },

    { code: "1020108", name: "(-) DEPRECIACIÓN ACUMULADA PROPIEDADES, PLANTA Y EQUIPO", level: 4, parentCode: "10201" },
      { code: "102010801", name: "(-) DEP. ACUM. EDIFICIOS Y LOCALES",      level: 5, parentCode: "1020108", postable: true },
      { code: "102010802", name: "(-) DEP. ACUM. MUEBLES Y ENSERES",        level: 5, parentCode: "1020108", postable: true },
      { code: "102010803", name: "(-) DEP. ACUM. MAQUINARIA Y EQUIPO",      level: 5, parentCode: "1020108", postable: true },
      { code: "102010804", name: "(-) DEP. ACUM. EQUIPOS DE COMPUTACIÓN",   level: 5, parentCode: "1020108", postable: true },
      { code: "102010805", name: "(-) DEP. ACUM. VEHÍCULOS",                level: 5, parentCode: "1020108", postable: true },
      { code: "102010806", name: "(-) DEP. ACUM. OTROS ACTIVOS FIJOS",      level: 5, parentCode: "1020108", postable: true },

  // 10202  Activos intangibles
  { code: "10202", name: "ACTIVOS INTANGIBLES", level: 3, parentCode: "102" },
    { code: "1020201", name: "MARCAS, PATENTES Y DERECHOS",           level: 4, parentCode: "10202", postable: true },
    { code: "1020202", name: "PROGRAMAS DE COMPUTADORA (SOFTWARE)",   level: 4, parentCode: "10202", postable: true },
    { code: "1020203", name: "(-) AMORTIZACIÓN ACUMULADA INTANGIBLES",level: 4, parentCode: "10202", postable: true },

  // 10203  Otros activos no corrientes
  { code: "10203", name: "OTROS ACTIVOS NO CORRIENTES", level: 3, parentCode: "102" },
    { code: "1020301", name: "INVERSIONES EN SUBSIDIARIAS Y ASOCIADAS", level: 4, parentCode: "10203", postable: true },
    { code: "1020302", name: "DEPÓSITOS EN GARANTÍA",                   level: 4, parentCode: "10203", postable: true },
    { code: "1020303", name: "ACTIVOS POR IMPUESTOS DIFERIDOS",         level: 4, parentCode: "10203", postable: true },
    { code: "1020304", name: "OTROS ACTIVOS NO CORRIENTES",             level: 4, parentCode: "10203", postable: true },

  // ─────────────────────────────────────────────────────────────────────────
  // 113  RETENCIONES EN LA FUENTE POR COBRAR
  // ─────────────────────────────────────────────────────────────────────────

  { code: "113", name: "RETENCIONES POR COBRAR", level: 2, parentCode: "1" },

    { code: "11302", name: "RETENCIONES CORRIENTES POR COBRAR", level: 3, parentCode: "113" },

      { code: "1130201", name: "RETENCIONES DE IMPUESTO A LA RENTA POR COBRAR", level: 4, parentCode: "11302" },
        { code: "113020101", name: "RETENCIÓN IR CLIENTES LOCALES",   level: 5, parentCode: "1130201", postable: true, isReceivable: true },
        { code: "113020102", name: "RETENCIÓN IR CLIENTES EXTERIOR",  level: 5, parentCode: "1130201", postable: true },

      { code: "1130202", name: "RETENCIONES DE IVA POR COBRAR", level: 4, parentCode: "11302" },
        { code: "113020201", name: "RETENCIÓN IVA CLIENTES LOCALES",  level: 5, parentCode: "1130202", postable: true, isReceivable: true },
        { code: "113020202", name: "RETENCIÓN IVA CLIENTES EXTERIOR", level: 5, parentCode: "1130202", postable: true },

  // ─────────────────────────────────────────────────────────────────────────
  // 133  IVA CRÉDITO TRIBUTARIO (ACTIVO)
  // ─────────────────────────────────────────────────────────────────────────

  { code: "133",   name: "IVA EN COMPRAS (CRÉDITO TRIBUTARIO)", level: 2, parentCode: "1" },
  { code: "13301", name: "IVA CRÉDITO EN COMPRAS",              level: 3, parentCode: "133" },
    { code: "1330101", name: "IVA CRÉDITO TRIBUTARIO EN COMPRAS 15%", level: 4, parentCode: "13301", postable: true },
    { code: "1330102", name: "IVA CRÉDITO TRIBUTARIO BIENES EXENTOS 0%", level: 4, parentCode: "13301", postable: true },
    { code: "1330103", name: "IVA CRÉDITO TRIBUTARIO EN IMPORTACIONES", level: 4, parentCode: "13301", postable: true },

  // ==========================================================================
  // 2 — PASIVO
  // ==========================================================================

  { code: "2",   name: "PASIVO",          level: 1, parentCode: null },
  { code: "201", name: "PASIVO CORRIENTE",level: 2, parentCode: "2" },

  // 20101  Cuentas y documentos por pagar (proveedores)
  { code: "20101", name: "PROVEEDORES POR PAGAR", level: 3, parentCode: "201" },
    { code: "2010101", name: "PROVEEDORES LOCALES",       level: 4, parentCode: "20101", postable: true, isPayable: true },
    { code: "2010102", name: "PROVEEDORES DEL EXTERIOR",  level: 4, parentCode: "20101", postable: true },

  // 20102  Obligaciones tributarias por pagar
  { code: "20102", name: "OBLIGACIONES TRIBUTARIAS POR PAGAR", level: 3, parentCode: "201" },

    { code: "2010201", name: "IVA POR PAGAR",           level: 4, parentCode: "20102" },
      { code: "201020101", name: "IVA DÉBITO EN VENTAS 15%",        level: 5, parentCode: "2010201", postable: true },
      { code: "201020102", name: "IVA DÉBITO EN VENTAS (LIQUIDACIÓN MIXTA)", level: 5, parentCode: "2010201", postable: true },

    { code: "2010202", name: "RETENCIONES EN LA FUENTE POR PAGAR",  level: 4, parentCode: "20102" },
      { code: "201020201", name: "RETENCIONES IR POR PAGAR",        level: 5, parentCode: "2010202", postable: true },
      { code: "201020202", name: "RETENCIONES IVA POR PAGAR",       level: 5, parentCode: "2010202", postable: true },

    { code: "2010203", name: "IMPUESTO A LA RENTA POR PAGAR",       level: 4, parentCode: "20102" },
      { code: "201020301", name: "IMPUESTO A LA RENTA CORRIENTE",   level: 5, parentCode: "2010203", postable: true },
      { code: "201020302", name: "PARTICIPACIÓN TRABAJADORES 15% POR PAGAR", level: 5, parentCode: "2010203", postable: true },

  // 20103  Cuentas y documentos por pagar (mantiene estructura existente)
  { code: "20103", name: "CUENTAS Y DOCUMENTOS POR PAGAR", level: 3, parentCode: "201" },
    { code: "2010301", name: "LOCALES", level: 4, parentCode: "20103" },
      { code: "201030101", name: "PRÉSTAMOS LOCALES",              level: 5, parentCode: "2010301", postable: true },
      { code: "201030102", name: "PROVEEDORES",                    level: 5, parentCode: "2010301", postable: true, isPayable: true },
      { code: "201030103", name: "ANTICIPO DE CLIENTES",           level: 5, parentCode: "2010301", postable: true },
    { code: "2010302", name: "DEL EXTERIOR", level: 4, parentCode: "20103" },
      { code: "201030201", name: "PROVEEDORES DEL EXTERIOR",       level: 5, parentCode: "2010302", postable: true },

  // 20104  Obligaciones con instituciones financieras CP
  { code: "20104", name: "OBLIGACIONES CON INSTITUCIONES FINANCIERAS C/P", level: 3, parentCode: "201" },
    { code: "2010401", name: "PRÉSTAMOS BANCARIOS CORTO PLAZO",    level: 4, parentCode: "20104", postable: true },
    { code: "2010402", name: "SOBREGIROS BANCARIOS",               level: 4, parentCode: "20104", postable: true },
    { code: "2010403", name: "PORCIÓN CORRIENTE DE DEUDAS LP",     level: 4, parentCode: "20104", postable: true },

  // 20105  Obligaciones con empleados
  { code: "20105", name: "OBLIGACIONES CON EMPLEADOS", level: 3, parentCode: "201" },
    { code: "2010501", name: "SUELDOS Y SALARIOS POR PAGAR",       level: 4, parentCode: "20105", postable: true },
    { code: "2010502", name: "DÉCIMO TERCER SUELDO POR PAGAR",     level: 4, parentCode: "20105", postable: true },
    { code: "2010503", name: "DÉCIMO CUARTO SUELDO POR PAGAR",     level: 4, parentCode: "20105", postable: true },
    { code: "2010504", name: "VACACIONES POR PAGAR",               level: 4, parentCode: "20105", postable: true },
    { code: "2010505", name: "PARTICIPACIÓN TRABAJADORES 15% POR PAGAR", level: 4, parentCode: "20105", postable: true },
    { code: "2010506", name: "FONDOS DE RESERVA POR PAGAR",        level: 4, parentCode: "20105", postable: true },
    { code: "2010507", name: "APORTE PATRONAL IESS POR PAGAR",     level: 4, parentCode: "20105", postable: true },
    { code: "2010508", name: "APORTE PERSONAL IESS POR PAGAR",     level: 4, parentCode: "20105", postable: true },
    { code: "2010509", name: "PRÉSTAMOS IESS POR PAGAR",           level: 4, parentCode: "20105", postable: true },
    { code: "2010510", name: "BONIFICACIONES Y COMISIONES POR PAGAR", level: 4, parentCode: "20105", postable: true },

  // ─────────────────────────────────────────────────────────────────────────
  // 202  PASIVO NO CORRIENTE
  // ─────────────────────────────────────────────────────────────────────────

  { code: "202", name: "PASIVO NO CORRIENTE", level: 2, parentCode: "2" },

  { code: "20201", name: "OBLIGACIONES CON INSTITUCIONES FINANCIERAS L/P", level: 3, parentCode: "202" },
    { code: "2020101", name: "PRÉSTAMOS BANCARIOS LARGO PLAZO",    level: 4, parentCode: "20201", postable: true },
    { code: "2020102", name: "PRÉSTAMOS DE SOCIOS O ACCIONISTAS",  level: 4, parentCode: "20201", postable: true },
    { code: "2020103", name: "OBLIGACIONES CON CFN/BNF",           level: 4, parentCode: "20201", postable: true },

  { code: "20202", name: "PROVISIONES POR BENEFICIOS A EMPLEADOS LP", level: 3, parentCode: "202" },
    { code: "2020201", name: "PROVISIÓN PARA JUBILACIÓN PATRONAL", level: 4, parentCode: "20202", postable: true },
    { code: "2020202", name: "PROVISIÓN PARA DESAHUCIO",           level: 4, parentCode: "20202", postable: true },

  { code: "20203", name: "PASIVOS POR IMPUESTOS DIFERIDOS", level: 3, parentCode: "202" },
    { code: "2020301", name: "PASIVO POR IMPUESTO DIFERIDO",       level: 4, parentCode: "20203", postable: true },

  { code: "20204", name: "OTRAS OBLIGACIONES NO CORRIENTES", level: 3, parentCode: "202" },
    { code: "2020401", name: "ANTICIPOS EN CONTRATOS LARGO PLAZO", level: 4, parentCode: "20204", postable: true },
    { code: "2020402", name: "GARANTÍAS RECIBIDAS",                level: 4, parentCode: "20204", postable: true },

  // ==========================================================================
  // 3 — PATRIMONIO NETO
  // ==========================================================================

  { code: "3", name: "PATRIMONIO NETO", level: 1, parentCode: null },

  { code: "301", name: "CAPITAL", level: 2, parentCode: "3" },
    { code: "30101", name: "CAPITAL SUSCRITO O ASIGNADO", level: 3, parentCode: "301", postable: true },
    { code: "30102", name: "CAPITAL PAGADO",              level: 3, parentCode: "301", postable: true },
    { code: "30103", name: "CAPITAL POR COBRAR",          level: 3, parentCode: "301", postable: true },

  { code: "302", name: "APORTES DE SOCIOS O ACCIONISTAS", level: 2, parentCode: "3" },
    { code: "30201", name: "APORTES PARA FUTURAS CAPITALIZACIONES", level: 3, parentCode: "302", postable: true },
    { code: "30202", name: "PRIMAS EN EMISIÓN DE ACCIONES",         level: 3, parentCode: "302", postable: true },

  { code: "303", name: "RESERVAS", level: 2, parentCode: "3" },
    { code: "30301", name: "RESERVA LEGAL",         level: 3, parentCode: "303", postable: true },
    { code: "30302", name: "RESERVAS ESTATUTARIAS", level: 3, parentCode: "303", postable: true },
    { code: "30303", name: "RESERVAS FACULTATIVAS", level: 3, parentCode: "303", postable: true },

  { code: "304", name: "SUPERÁVIT", level: 2, parentCode: "3" },
    { code: "30401", name: "SUPERÁVIT POR REVALUACIÓN DE ACTIVOS", level: 3, parentCode: "304", postable: true },
    { code: "30402", name: "SUPERÁVIT POR DONACIONES",             level: 3, parentCode: "304", postable: true },

  { code: "305", name: "RESULTADOS ACUMULADOS", level: 2, parentCode: "3" },
    { code: "30501", name: "UTILIDADES RETENIDAS",   level: 3, parentCode: "305", postable: true },
    { code: "30502", name: "PÉRDIDAS ACUMULADAS",    level: 3, parentCode: "305", postable: true },
    { code: "30503", name: "RESULTADOS POR ADOPCIÓN NIIF", level: 3, parentCode: "305", postable: true },

  { code: "307", name: "RESULTADOS DEL EJERCICIO", level: 2, parentCode: "3" },
    { code: "30701", name: "GANANCIA NETA DEL PERIODO",   level: 3, parentCode: "307", postable: true },
    { code: "30702", name: "(-) PÉRDIDA NETA DEL PERIODO",level: 3, parentCode: "307", postable: true },

  { code: "308", name: "DIVIDENDOS DECLARADOS", level: 2, parentCode: "3" },
    { code: "30801", name: "DIVIDENDOS POR PAGAR",        level: 3, parentCode: "308", postable: true },

  // ==========================================================================
  // 4 — INGRESOS
  // ==========================================================================

  { code: "4", name: "INGRESOS", level: 1, parentCode: null },

  // ─────────────────────────────────────────────────────────────────────────
  // 401  Ingresos de actividades ordinarias
  // ─────────────────────────────────────────────────────────────────────────

  { code: "401", name: "INGRESOS DE ACTIVIDADES ORDINARIAS", level: 2, parentCode: "4" },

  // 40101  Ventas de bienes
  { code: "40101", name: "VENTAS DE BIENES", level: 3, parentCode: "401" },
    { code: "4010101", name: "VENTAS LOCALES GRAVADAS 15% IVA",  level: 4, parentCode: "40101", postable: true },
    { code: "4010102", name: "VENTAS LOCALES TARIFA 0% IVA",     level: 4, parentCode: "40101", postable: true },
    { code: "4010103", name: "EXPORTACIONES",                    level: 4, parentCode: "40101", postable: true },
    { code: "4010104", name: "(-) DESCUENTOS EN VENTAS",         level: 4, parentCode: "40101", postable: true },
    { code: "4010105", name: "(-) DEVOLUCIONES EN VENTAS",       level: 4, parentCode: "40101", postable: true },

  // 40102  Prestación de servicios
  { code: "40102", name: "PRESTACIÓN DE SERVICIOS", level: 3, parentCode: "401" },

    { code: "4010201", name: "INGRESOS POR ASESORÍA", level: 4, parentCode: "40102" },
      { code: "401020101", name: "INGRESOS POR ASESORÍA CONTABLE",     level: 5, parentCode: "4010201", postable: true },
      { code: "401020102", name: "INGRESOS POR ASESORÍA TRIBUTARIA",   level: 5, parentCode: "4010201", postable: true },
      { code: "401020103", name: "INGRESOS POR ASESORÍA EMPRESARIAL",  level: 5, parentCode: "4010201", postable: true },

    { code: "4010202", name: "INGRESOS POR SERVICIOS PROFESIONALES", level: 4, parentCode: "40102" },
      { code: "401020201", name: "HONORARIOS PROFESIONALES FACTURADOS", level: 5, parentCode: "4010202", postable: true },
      { code: "401020202", name: "CONSULTORÍA Y AUDITORÍA",             level: 5, parentCode: "4010202", postable: true },

    { code: "4010203", name: "INGRESOS POR ARRENDAMIENTO", level: 4, parentCode: "40102" },
      { code: "401020301", name: "ARRENDAMIENTO DE LOCALES COMERCIALES", level: 5, parentCode: "4010203", postable: true },
      { code: "401020302", name: "ARRENDAMIENTO DE BIENES MUEBLES",      level: 5, parentCode: "4010203", postable: true },

    { code: "4010204", name: "INGRESOS POR CONTRATOS DE SERVICIOS", level: 4, parentCode: "40102" },
      { code: "401020401", name: "CONTRATOS DE MANTENIMIENTO",           level: 5, parentCode: "4010204", postable: true },
      { code: "401020402", name: "CONTRATOS DE GESTIÓN Y ADMINISTRACIÓN",level: 5, parentCode: "4010204", postable: true },

  // 40103  Ingresos por contratos de construcción
  { code: "40103", name: "CONTRATOS DE CONSTRUCCIÓN Y OBRA", level: 3, parentCode: "401" },
    { code: "4010301", name: "INGRESOS POR AVANCE DE OBRA",    level: 4, parentCode: "40103", postable: true },
    { code: "4010302", name: "INGRESOS POR CONTRATOS LLAVE EN MANO", level: 4, parentCode: "40103", postable: true },

  // ─────────────────────────────────────────────────────────────────────────
  // 402  Otros ingresos
  // ─────────────────────────────────────────────────────────────────────────

  { code: "402", name: "OTROS INGRESOS", level: 2, parentCode: "4" },

  { code: "40201", name: "INGRESOS FINANCIEROS", level: 3, parentCode: "402" },
    { code: "4020101", name: "INTERESES GANADOS EN CUENTAS BANCARIAS",  level: 4, parentCode: "40201", postable: true },
    { code: "4020102", name: "INTERESES EN INVERSIONES Y DEPÓSITOS",    level: 4, parentCode: "40201", postable: true },
    { code: "4020103", name: "RENDIMIENTOS FINANCIEROS",                level: 4, parentCode: "40201", postable: true },

  { code: "40202", name: "OTROS INGRESOS NO OPERACIONALES", level: 3, parentCode: "402" },
    { code: "4020201", name: "UTILIDAD EN VENTA DE ACTIVOS FIJOS",      level: 4, parentCode: "40202", postable: true },
    { code: "4020202", name: "INGRESOS POR DONACIONES Y SUBSIDIOS",     level: 4, parentCode: "40202", postable: true },
    { code: "4020203", name: "SOBRANTES DE CAJA",                       level: 4, parentCode: "40202", postable: true },
    { code: "4020204", name: "RECUPERACIÓN DE CARTERA CASTIGADA",       level: 4, parentCode: "40202", postable: true },
    { code: "4020205", name: "OTROS INGRESOS VARIOS",                   level: 4, parentCode: "40202", postable: true },

  // ==========================================================================
  // 5 — GASTOS
  // ==========================================================================

  { code: "5", name: "GASTOS", level: 1, parentCode: null },

  // ─────────────────────────────────────────────────────────────────────────
  // 501  Costo de ventas y producción
  // ─────────────────────────────────────────────────────────────────────────

  { code: "501", name: "COSTO DE VENTAS Y PRODUCCIÓN", level: 2, parentCode: "5" },

  { code: "50101", name: "COSTO DE VENTAS DE BIENES", level: 3, parentCode: "501" },
    { code: "5010101", name: "COSTO DE MERCADERÍAS VENDIDAS",       level: 4, parentCode: "50101", postable: true },
    { code: "5010102", name: "MATERIAS PRIMAS UTILIZADAS",          level: 4, parentCode: "50101", postable: true },
    { code: "5010103", name: "MANO DE OBRA DIRECTA",                level: 4, parentCode: "50101", postable: true },
    { code: "5010104", name: "COSTOS INDIRECTOS DE FABRICACIÓN",    level: 4, parentCode: "50101", postable: true },
    { code: "5010105", name: "(-) DEVOLUCIONES EN COMPRAS",         level: 4, parentCode: "50101", postable: true },

  { code: "50102", name: "COSTO DE SERVICIOS PRESTADOS", level: 3, parentCode: "501" },
    { code: "5010201", name: "COSTOS DIRECTOS DE SERVICIOS",        level: 4, parentCode: "50102", postable: true },
    { code: "5010202", name: "SUBCONTRATACIONES",                   level: 4, parentCode: "50102", postable: true },

  // ─────────────────────────────────────────────────────────────────────────
  // 502  Gastos operacionales
  // ─────────────────────────────────────────────────────────────────────────

  { code: "502", name: "GASTOS OPERACIONALES", level: 2, parentCode: "5" },

  // ── 50201  Gastos de ventas y comercialización ───────────────────────────

  { code: "50201", name: "GASTOS DE VENTAS Y COMERCIALIZACIÓN", level: 3, parentCode: "502" },

    { code: "5020101", name: "SUELDOS Y SALARIOS — VENTAS", level: 4, parentCode: "50201" },
      { code: "502010101", name: "SUELDOS Y SALARIOS PERSONAL DE VENTAS",     level: 5, parentCode: "5020101", postable: true },
      { code: "502010102", name: "COMISIONES A VENDEDORES",                   level: 5, parentCode: "5020101", postable: true },
      { code: "502010103", name: "HORAS EXTRAS PERSONAL DE VENTAS",           level: 5, parentCode: "5020101", postable: true },
      { code: "502010104", name: "BONIFICACIONES PERSONAL DE VENTAS",         level: 5, parentCode: "5020101", postable: true },

    { code: "5020102", name: "BENEFICIOS SOCIALES — VENTAS", level: 4, parentCode: "50201" },
      { code: "502010201", name: "DÉCIMO TERCER SUELDO VENTAS",               level: 5, parentCode: "5020102", postable: true },
      { code: "502010202", name: "DÉCIMO CUARTO SUELDO VENTAS",               level: 5, parentCode: "5020102", postable: true },
      { code: "502010203", name: "VACACIONES VENTAS",                         level: 5, parentCode: "5020102", postable: true },
      { code: "502010204", name: "FONDOS DE RESERVA VENTAS",                  level: 5, parentCode: "5020102", postable: true },
      { code: "502010205", name: "APORTE PATRONAL IESS — VENTAS",             level: 5, parentCode: "5020102", postable: true },

    { code: "5020103", name: "PUBLICIDAD Y MERCADEO", level: 4, parentCode: "50201" },
      { code: "502010301", name: "PUBLICIDAD EN MEDIOS TRADICIONALES",        level: 5, parentCode: "5020103", postable: true },
      { code: "502010302", name: "MARKETING DIGITAL Y REDES SOCIALES",        level: 5, parentCode: "5020103", postable: true },
      { code: "502010303", name: "MATERIAL PROMOCIONAL E IMPRESOS",           level: 5, parentCode: "5020103", postable: true },
      { code: "502010304", name: "EVENTOS Y PATROCINIOS",                     level: 5, parentCode: "5020103", postable: true },

    { code: "5020104", name: "GASTOS DE DISTRIBUCIÓN Y TRANSPORTE", level: 4, parentCode: "50201" },
      { code: "502010401", name: "TRANSPORTE Y FLETE DE MERCADERÍAS",         level: 5, parentCode: "5020104", postable: true },
      { code: "502010402", name: "MENSAJERÍA Y COURIER",                      level: 5, parentCode: "5020104", postable: true },

    { code: "5020105", name: "OTROS GASTOS DE VENTA", level: 4, parentCode: "50201" },
      { code: "502010501", name: "ATENCIÓN A CLIENTES",                       level: 5, parentCode: "5020105", postable: true },
      { code: "502010502", name: "GASTOS DE REPRESENTACIÓN",                  level: 5, parentCode: "5020105", postable: true },

  // ── 50202  Gastos administrativos ────────────────────────────────────────

  { code: "50202", name: "GASTOS ADMINISTRATIVOS", level: 3, parentCode: "502" },

    // 5020201: kept as general office/supply expenses — code 502020101 is the
    // default expense in SRI TXT imports; do not reassign this code to payroll.
    { code: "5020201", name: "GASTOS DE OFICINA Y SUMINISTROS", level: 4, parentCode: "50202" },
      { code: "502020101", name: "GASTOS GENERALES DE OFICINA",              level: 5, parentCode: "5020201", postable: true },
      { code: "502020102", name: "GASTOS DE ENVÍOS Y MENSAJERÍA",            level: 5, parentCode: "5020201", postable: true },
      { code: "502020103", name: "PAPELERÍA Y ÚTILES DE OFICINA",            level: 5, parentCode: "5020201", postable: true },
      { code: "502020104", name: "SUMINISTROS DE LIMPIEZA E HIGIENE",        level: 5, parentCode: "5020201", postable: true },
      { code: "502020105", name: "COMBUSTIBLES Y LUBRICANTES",               level: 5, parentCode: "5020201", postable: true },

    { code: "5020202", name: "SUELDOS Y SALARIOS — ADMINISTRATIVOS", level: 4, parentCode: "50202" },
      { code: "502020201", name: "SUELDOS Y SALARIOS PERSONAL ADMINISTRATIVO", level: 5, parentCode: "5020202", postable: true },
      { code: "502020202", name: "HORAS EXTRAS PERSONAL ADMINISTRATIVO",       level: 5, parentCode: "5020202", postable: true },
      { code: "502020203", name: "BONIFICACIONES PERSONAL ADMINISTRATIVO",     level: 5, parentCode: "5020202", postable: true },

    { code: "5020203", name: "BENEFICIOS SOCIALES — ADMINISTRATIVOS", level: 4, parentCode: "50202" },
      { code: "502020301", name: "DÉCIMO TERCER SUELDO ADMINISTRATIVO",        level: 5, parentCode: "5020203", postable: true },
      { code: "502020302", name: "DÉCIMO CUARTO SUELDO ADMINISTRATIVO",        level: 5, parentCode: "5020203", postable: true },
      { code: "502020303", name: "VACACIONES ADMINISTRATIVO",                  level: 5, parentCode: "5020203", postable: true },
      { code: "502020304", name: "FONDOS DE RESERVA ADMINISTRATIVO",           level: 5, parentCode: "5020203", postable: true },
      { code: "502020305", name: "APORTE PATRONAL IESS — ADMINISTRATIVO",      level: 5, parentCode: "5020203", postable: true },
      { code: "502020306", name: "APORTE PERSONAL IESS — ADMINISTRATIVO",      level: 5, parentCode: "5020203", postable: true },

    { code: "5020204", name: "HONORARIOS PROFESIONALES", level: 4, parentCode: "50202" },
      { code: "502020401", name: "HONORARIOS CONTABLES Y DE AUDITORÍA",        level: 5, parentCode: "5020204", postable: true },
      { code: "502020402", name: "HONORARIOS LEGALES Y JURÍDICOS",             level: 5, parentCode: "5020204", postable: true },
      { code: "502020403", name: "HONORARIOS MÉDICOS Y SALUD OCUPACIONAL",     level: 5, parentCode: "5020204", postable: true },
      { code: "502020404", name: "HONORARIOS EN TECNOLOGÍA Y SISTEMAS",        level: 5, parentCode: "5020204", postable: true },
      { code: "502020405", name: "OTROS HONORARIOS PROFESIONALES",             level: 5, parentCode: "5020204", postable: true },

    { code: "5020205", name: "ARRENDAMIENTOS", level: 4, parentCode: "50202" },
      { code: "502020501", name: "ARRENDAMIENTO DE LOCAL U OFICINA",           level: 5, parentCode: "5020205", postable: true },
      { code: "502020502", name: "ARRENDAMIENTO DE MAQUINARIA Y EQUIPOS",      level: 5, parentCode: "5020205", postable: true },
      { code: "502020503", name: "ARRENDAMIENTO DE VEHÍCULOS",                 level: 5, parentCode: "5020205", postable: true },

    { code: "5020206", name: "SERVICIOS BÁSICOS", level: 4, parentCode: "50202" },
      { code: "502020601", name: "ENERGÍA ELÉCTRICA",                          level: 5, parentCode: "5020206", postable: true },
      { code: "502020602", name: "AGUA POTABLE Y ALCANTARILLADO",              level: 5, parentCode: "5020206", postable: true },
      { code: "502020603", name: "TELECOMUNICACIONES Y TELEFONÍA",             level: 5, parentCode: "5020206", postable: true },
      { code: "502020604", name: "INTERNET Y CONECTIVIDAD",                    level: 5, parentCode: "5020206", postable: true },

    { code: "5020207", name: "MANTENIMIENTO Y REPARACIONES", level: 4, parentCode: "50202" },
      { code: "502020701", name: "MANTENIMIENTO DE EQUIPOS DE OFICINA",        level: 5, parentCode: "5020207", postable: true },
      { code: "502020702", name: "MANTENIMIENTO DE EQUIPOS DE COMPUTACIÓN",    level: 5, parentCode: "5020207", postable: true },
      { code: "502020703", name: "MANTENIMIENTO DE INSTALACIONES",             level: 5, parentCode: "5020207", postable: true },
      { code: "502020704", name: "MANTENIMIENTO Y REPARACIÓN DE VEHÍCULOS",    level: 5, parentCode: "5020207", postable: true },

    { code: "5020208", name: "SEGUROS", level: 4, parentCode: "50202" },
      { code: "502020801", name: "SEGUROS DE VIDA Y ACCIDENTES PERSONALES",    level: 5, parentCode: "5020208", postable: true },
      { code: "502020802", name: "SEGUROS DE BIENES MUEBLES E INMUEBLES",      level: 5, parentCode: "5020208", postable: true },
      { code: "502020803", name: "SEGUROS DE VEHÍCULOS",                       level: 5, parentCode: "5020208", postable: true },
      { code: "502020804", name: "SEGUROS MÉDICOS Y HOSPITALARIOS",            level: 5, parentCode: "5020208", postable: true },

    { code: "5020209", name: "DEPRECIACIONES Y AMORTIZACIONES", level: 4, parentCode: "50202" },
      { code: "502020901", name: "DEPRECIACIÓN EDIFICIOS Y LOCALES (5%)",      level: 5, parentCode: "5020209", postable: true },
      { code: "502020902", name: "DEPRECIACIÓN MUEBLES Y ENSERES (10%)",       level: 5, parentCode: "5020209", postable: true },
      { code: "502020903", name: "DEPRECIACIÓN MAQUINARIA Y EQUIPO (10%)",     level: 5, parentCode: "5020209", postable: true },
      { code: "502020904", name: "DEPRECIACIÓN EQUIPOS DE COMPUTACIÓN (33%)",  level: 5, parentCode: "5020209", postable: true },
      { code: "502020905", name: "DEPRECIACIÓN VEHÍCULOS (20%)",               level: 5, parentCode: "5020209", postable: true },
      { code: "502020906", name: "AMORTIZACIÓN DE ACTIVOS INTANGIBLES",        level: 5, parentCode: "5020209", postable: true },

    { code: "5020210", name: "VIÁTICOS Y GASTOS DE VIAJE", level: 4, parentCode: "50202" },
      { code: "502021001", name: "VIÁTICOS NACIONALES",                        level: 5, parentCode: "5020210", postable: true },
      { code: "502021002", name: "VIÁTICOS AL EXTERIOR",                       level: 5, parentCode: "5020210", postable: true },
      { code: "502021003", name: "PASAJES AÉREOS Y TERRESTRES",                level: 5, parentCode: "5020210", postable: true },
      { code: "502021004", name: "HOSPEDAJE Y ALIMENTACIÓN EN VIAJE",          level: 5, parentCode: "5020210", postable: true },

    { code: "5020211", name: "GASTOS BANCARIOS Y FINANCIEROS OPERATIVOS", level: 4, parentCode: "50202" },
      { code: "502021101", name: "SERVICIOS BANCARIOS Y COMISIONES",           level: 5, parentCode: "5020211", postable: true },
      { code: "502021102", name: "CHEQUERAS Y ESTADOS DE CUENTA",              level: 5, parentCode: "5020211", postable: true },

    { code: "5020212", name: "PROVISIONES OPERATIVAS", level: 4, parentCode: "50202" },
      { code: "502021201", name: "PROVISIÓN PARA CUENTAS INCOBRABLES",         level: 5, parentCode: "5020212", postable: true },
      { code: "502021202", name: "PROVISIÓN PARA JUBILACIÓN PATRONAL",         level: 5, parentCode: "5020212", postable: true },
      { code: "502021203", name: "PROVISIÓN PARA DESAHUCIO",                   level: 5, parentCode: "5020212", postable: true },

    { code: "5020213", name: "OTROS GASTOS ADMINISTRATIVOS", level: 4, parentCode: "50202" },
      { code: "502021301", name: "GASTOS DE REPRESENTACIÓN CORPORATIVA",       level: 5, parentCode: "5020213", postable: true },
      { code: "502021302", name: "SUSCRIPCIONES Y MEMBRESÍAS",                 level: 5, parentCode: "5020213", postable: true },
      { code: "502021303", name: "CAPACITACIÓN Y DESARROLLO DE PERSONAL",      level: 5, parentCode: "5020213", postable: true },
      { code: "502021304", name: "GASTOS LEGALES Y NOTARIALES",                level: 5, parentCode: "5020213", postable: true },
      { code: "502021305", name: "GASTOS DE ALIMENTACIÓN PERSONAL",            level: 5, parentCode: "5020213", postable: true },
      { code: "502021306", name: "UNIFORMES Y EQUIPOS DE PROTECCIÓN",          level: 5, parentCode: "5020213", postable: true },

  // ── 50203  Gastos financieros ─────────────────────────────────────────────

  { code: "50203", name: "GASTOS FINANCIEROS", level: 3, parentCode: "502" },

    { code: "5020301", name: "INTERESES Y CARGOS POR FINANCIAMIENTO", level: 4, parentCode: "50203" },
      { code: "502030101", name: "INTERESES POR PRÉSTAMOS BANCARIOS",          level: 5, parentCode: "5020301", postable: true },
      { code: "502030102", name: "INTERESES POR SOBREGIROS BANCARIOS",         level: 5, parentCode: "5020301", postable: true },
      { code: "502030103", name: "INTERESES POR MORA TRIBUTARIA",              level: 5, parentCode: "5020301", postable: true },
      { code: "502030104", name: "INTERESES POR PRÉSTAMOS DE SOCIOS",          level: 5, parentCode: "5020301", postable: true },

    { code: "5020302", name: "MULTAS Y SANCIONES", level: 4, parentCode: "50203" },
      { code: "502030201", name: "MULTAS E INTERESES SRI",                     level: 5, parentCode: "5020302", postable: true },
      { code: "502030202", name: "MULTAS SCVS E INSTITUCIONES DE CONTROL",     level: 5, parentCode: "5020302", postable: true },
      { code: "502030203", name: "OTRAS MULTAS Y RECARGOS",                    level: 5, parentCode: "5020302", postable: true },

    { code: "5020303", name: "PÉRDIDAS FINANCIERAS", level: 4, parentCode: "50203" },
      { code: "502030301", name: "PÉRDIDA EN CAMBIO DE MONEDA EXTRANJERA",     level: 5, parentCode: "5020303", postable: true },
      { code: "502030302", name: "PÉRDIDA EN VENTA DE ACTIVOS FINANCIEROS",    level: 5, parentCode: "5020303", postable: true },

  // ── 50204  Gastos tributarios ─────────────────────────────────────────────

  { code: "50204", name: "GASTOS TRIBUTARIOS E IMPUESTOS", level: 3, parentCode: "502" },
    { code: "5020401", name: "IMPUESTO A LA RENTA Y PARTICIPACIÓN TRABAJADORES", level: 4, parentCode: "50204" },
      { code: "502040101", name: "IMPUESTO A LA RENTA CAUSADO",                level: 5, parentCode: "5020401", postable: true },
      { code: "502040102", name: "PARTICIPACIÓN TRABAJADORES 15%",             level: 5, parentCode: "5020401", postable: true },
      { code: "502040103", name: "IMPUESTO A LOS ACTIVOS EN EL EXTERIOR",      level: 5, parentCode: "5020401", postable: true },

    { code: "5020402", name: "CONTRIBUCIONES Y TASAS", level: 4, parentCode: "50204" },
      { code: "502040201", name: "CONTRIBUCIÓN SCVS",                          level: 5, parentCode: "5020402", postable: true },
      { code: "502040202", name: "CONTRIBUCIÓN IESS SGRT (RIESGOS DEL TRABAJO)",level: 5, parentCode: "5020402", postable: true },
      { code: "502040203", name: "TASAS MUNICIPALES Y PATENTES",               level: 5, parentCode: "5020402", postable: true },
      { code: "502040204", name: "OTRAS CONTRIBUCIONES",                        level: 5, parentCode: "5020402", postable: true },

  // ── 50205  Otros gastos operacionales ────────────────────────────────────

  { code: "50205", name: "OTROS GASTOS OPERACIONALES", level: 3, parentCode: "502" },
    { code: "5020501", name: "GASTOS NO DEDUCIBLES", level: 4, parentCode: "50205" },
      { code: "502050101", name: "GASTOS PERSONALES NO DEDUCIBLES",            level: 5, parentCode: "5020501", postable: true },
      { code: "502050102", name: "MULTAS E INTERESES NO DEDUCIBLES",           level: 5, parentCode: "5020501", postable: true },
      { code: "502050103", name: "OTROS GASTOS NO DEDUCIBLES",                 level: 5, parentCode: "5020501", postable: true },

    { code: "5020502", name: "PÉRDIDAS EN VENTA DE ACTIVOS NO CORRIENTES", level: 4, parentCode: "50205" },
      { code: "502050201", name: "PÉRDIDA EN VENTA DE PROPIEDAD, PLANTA Y EQUIPO", level: 5, parentCode: "5020502", postable: true },

    { code: "5020503", name: "CUENTAS INCOBRABLES CASTIGADAS", level: 4, parentCode: "50205" },
      { code: "502050301", name: "CARTERA CASTIGADA",                          level: 5, parentCode: "5020503", postable: true },

    { code: "5020504", name: "DIFERENCIAS DE CAJA Y BANCOS", level: 4, parentCode: "50205" },
      { code: "502050401", name: "FALTANTES DE CAJA",                          level: 5, parentCode: "5020504", postable: true },
      { code: "502050402", name: "GASTOS NO CLASIFICADOS",                     level: 5, parentCode: "5020504", postable: true },

];

export default raw_coa;
