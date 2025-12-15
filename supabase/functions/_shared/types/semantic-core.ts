/**
 * Type definitions for Stage 1: Semantic Extraction
 */

export interface SemanticCore {
  process_metadata: {
    name: string;
    domain?: string;
  };
  actors: Array<{
    id: string;
    name: string;
    type: "external" | "human" | "system";
  }>;
  activities: Array<{
    id: string;
    actor: string; // actor ID reference
    action: string;
    object: string;
    semantic_type: "user_action" | "decision_preparation" | "automated_action" | "notification";
    confidence?: number;
  }>;
  decisions: Array<{
    id: string;
    question: string;
    based_on: string; // activity ID
    outcomes: string[];
  }>;
  control_flow: Array<{
    from: string; // activity/decision ID
    to: string; // activity/decision ID
    condition?: string; // for decision outcomes
    type?: "sequence" | "parallel" | "conditional";
  }>;
}

export interface NormalizedInput {
  content: string;
  language: { code: string; name: string };
  metadata?: {
    request_id?: string;
    enterprise_id?: string;
    project_id?: string;
  };
  options: {
    verbosity: "minimal" | "normal" | "detailed";
    return_intermediate: boolean;
  };
}

export interface NormalizationOptions {
  verbosity?: "minimal" | "normal" | "detailed";
  return_intermediate?: boolean;
  enterprise_id?: string;
  project_id?: string;
  request_id?: string;
}
