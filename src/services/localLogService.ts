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

export function logProcessedInvoice(entityRUC: string, invoiceNumber: string) {
  const log = loadLog();
  if (!log[entityRUC]) log[entityRUC] = [];
  if (!log[entityRUC].includes(invoiceNumber)) {
    log[entityRUC].push(invoiceNumber);
    saveLog(log);
  }
}



export function getProcessedInvoices(entityRUC: string): Set<string> {
  const log = loadLog();
  return new Set(log[entityRUC] || []);
}

export function clearLocalLog() {
  localStorage.removeItem(LOCAL_LOG_KEY);
}

export function clearLocalLogForEntity(entityRUC: string): void {
    const log = loadLog();
    if (log[entityRUC]) {
        delete log[entityRUC];
        saveLog(log);
    }
}

export function getAllInvoicesForEntity(entityRUC: string): string[] {
  return getProcessedInvoices(entityRUC);
}