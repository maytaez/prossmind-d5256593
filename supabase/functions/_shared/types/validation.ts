/**
 * Type definitions for Stage 3: Validation + Auto-fix
 */

export interface ValidationIssue {
  rule: string;
  severity: "error" | "warning";
  message: string;
  node_id?: string;
  flow_id?: string;
}

export interface ValidationResult {
  validation_status: "valid" | "auto_fixed" | "requires_manual_fix";
  issues_detected: ValidationIssue[];
  fixes_applied?: Array<{
    action: string;
    details: string[];
  }>;
  fixed_ir?: any; // BpmnIR type
}
