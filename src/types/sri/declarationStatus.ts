// ============================================================================
// SRI Declaration Status Types
// ============================================================================

export type DeclarationStatusType =

    "pending" | "ready" | "generated";
  

export interface DeclarationStatus {

  module: "iva104" | "ret103" | "ats";

  status: DeclarationStatusType;

  message?: string;

}
