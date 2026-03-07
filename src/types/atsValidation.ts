// ============================================================================
// ATS Validation Results
// ============================================================================

export type AtsValidationLevel =
  | "error"
  | "warning"
  | "info";

export interface AtsValidationIssue {

  level: AtsValidationLevel;

  code: string;

  message: string;

  documentId?: string;

}

export interface AtsValidationResult {

  valid: boolean;

  issues: AtsValidationIssue[];

}