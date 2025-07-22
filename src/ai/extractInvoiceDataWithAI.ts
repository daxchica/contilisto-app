import { JournalEntry } from "../types/JournalEntry";
import { OpenAI } from "openai";
import { PUCAccounts } from "../../backend/utils/accountPUCMap";

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

const INCLUDE_ICE_IN_EXPENSE = true;

export async function extractInvoiceDataWithAI(fullText: string, userRUC: string): Promise<JournalEntry[]> {
  const today = new Date().toISOString().split("T")[0];

  const systemPrompt = `
You are an expert Ecuadorian accounting assistant.

Your task is to extract accounting data from OCR-scanned Ecuadorian invoices.

Return a list of journal entries with:
- date, description, account_code, account_name, debit or credit, type: "expense", and invoice_number.

Use these mappings:
- Subtotal → debit "${PUCAccounts.expense.subtotal.code}" (${PUCAccounts.expense.subtotal.name})
- ICE → debit "${PUCAccounts.expense.ice.code}" (${PUCAccounts.expense.ice.name})
- IVA → debit "${PUCAccounts.expense.iva.code}" (${PUCAccounts.expense.iva.name})
- Total → credit "${PUCAccounts.expense.total.code}" (${PUCAccounts.expense.total.name})

Only output JSON. Never use markdown formatting.
`;

  const userPrompt = `
RUC of the user's company: ${userRUC}
OCR Extracted Invoice Text:
"""${fullText}"""
Today's date: ${today}
`;

  // First try: cost-effective model
  const models = ["gpt-3.5-turbo", "gpt-4o"];

  for (const model of models) {
    try {
      const response = await openai.chat.completions.create({
        model,
        temperature: 0,
        messages: [
          { role: "system", content: systemPrompt.trim() },
          { role: "user", content: userPrompt.trim() }
        ],
      });

      const raw = response.choices[0].message.content ?? "";
      console.log(`🧠 AI Raw Response from ${model}:\n`, raw);

      // 🔧 Clean possible markdown formatting
      const cleaned = raw
        .replace(/^```json/, "")
        .replace(/^```/, "")
        .replace(/```$/, "")
        .trim();

      const parsed = JSON.parse(cleaned);
      const validEntries: JournalEntry[] = parsed.filter((entry: any) =>
        entry?.account_code && (entry?.debit || entry?.credit)
      );

      if (validEntries.length > 0) {
        return validEntries;
      }
    } catch (err) {
      console.warn(`⚠️ ${model} failed, trying fallback if available...`, err);
    }
  }

  console.error("❌ All AI models failed or returned no valid entries");
  return [];
}