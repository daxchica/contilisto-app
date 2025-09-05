// src/utils/accountPUCMap.ts
// Bridge file so the frontend can use the canonical PUC helpers defined in the backend.
// It re-exports ONLY the functions/consts needed by the UI components.

export {
  // helpers the UI relies on:
  getAccountsForUI,      // -> Account[] for dropdowns (code + name canonical)
  canonicalCodeFrom,     // -> string | ''   (accepts 5d/7d code or alias/name)
  canonicalPair,         // -> { code, name } normalized
  normalizeEntry,        // -> JournalEntry patch {account_code, account_name}
} from '../../backend/utils/accountPUCMap'