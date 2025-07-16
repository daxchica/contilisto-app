const LOCAL_LOG_KEY = "local_invoice_log";

interface LocalLog {
  [entityRUC: string]: string[];
}

function loadLog(): LocalLog {
  const raw = localStorage.getItem(LOCAL_LOG_KEY);
  return raw ? JSON.parse(raw) : {};
}

function saveLog(log: LocalLog) {
  localStorage.setItem(LOCAL_LOG_KEY, JSON.stringify(log));
}

// ✅ Registrar número de factura
export function logProcessedInvoice(entityRUC: string, invoiceNumber: string) {
  const log = loadLog();
  if (!log[entityRUC]) log[entityRUC] = [];
  if (!log[entityRUC].includes(invoiceNumber)) {
    log[entityRUC].push(invoiceNumber);
    saveLog(log);
  }
}

// ✅ Obtener facturas como Set
export function getProcessedInvoices(entityRUC: string): Set<string> {
  const log = loadLog();
  return new Set(log[entityRUC] || []);
}

// ✅ Obtener todas las facturas como array (alias opcional)
export function getAllInvoicesForEntity(entityRUC: string): string[] {
  return [...getProcessedInvoices(entityRUC)];
}

// ✅ Limpiar todos los logs
export function clearLocalLog() {
  localStorage.removeItem(LOCAL_LOG_KEY);
}

// ✅ Limpiar logs de una sola entidad
export function clearLocalLogForEntity(entityRUC: string): void {
  const log = loadLog();
  if (log[entityRUC]) {
    delete log[entityRUC];
    saveLog(log);
  }
}

// ✅ NUEVA: Eliminar facturas específicas de una entidad
export function deleteInvoicesFromLocalLog(entityRUC: string, invoicesToDelete: string[]): void {
  const log = loadLog();
  if (!log[entityRUC]) return;

  log[entityRUC] = log[entityRUC].filter(
    (invoice) => !invoicesToDelete.includes(invoice)
  );

  if (log[entityRUC].length === 0) {
    delete log[entityRUC];
  }

  saveLog(log);
}