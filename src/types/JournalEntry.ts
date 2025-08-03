export interface JournalEntry {
    id?: string;
    date: string;
    description?: string;
    account_code: string;
    account_name: string;
    debit?: number;
    credit?: number;
    type?: "income" | "expense" | "liability";
    invoice_number?: string;
    transactionId?: string;
    uid?: string;
    userId?: string;
}
