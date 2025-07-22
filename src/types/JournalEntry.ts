export interface JournalEntry {
    date: string;
    description?: string;
    account_code: string;
    account_name: string;
    debit?: number;
    credit?: number;
    type?: "income" | "expense";
    invoice_number?: string;
    transactionId?: string;
    uid?: string;
    userId?: string;
}
