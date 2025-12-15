/**
 * Type definitions for Stage 2: BPMN IR Generation
 */

export interface BpmnIR {
  process: {
    id: string;
    name: string;
  };
  lanes: Array<{
    id: string;
    name: string;
    actor_ref: string; // actor ID from semantic core
  }>;
  nodes: Array<{
    id: string;
    type: "start_event" | "user_task" | "service_task" | "manual_task" | "exclusive_gateway" | "parallel_gateway" | "inclusive_gateway" | "end_event";
    name: string;
    lane: string; // lane ID
    properties?: Record<string, any>; // additional BPMN properties
  }>;
  flows: Array<{
    from: string; // node ID
    to: string; // node ID
    condition?: string; // for gateway outcomes
    name?: string;
  }>;
}

export interface TemplateConstraints {
  template_id?: string;
  required_elements: {
    start_event: number;
    xor_gateway?: number;
    end_events: number;
  };
  structure_rules: string[];
}

export interface EnterpriseStyleProfile {
  task_naming: "Verb + Business Object" | "Action + Object" | "Custom";
  gateway_naming: "Question Form" | "Condition Form";
  service_task_prefix?: string;
  lane_policy: "lane_per_actor" | "lane_per_role" | "custom";
  end_event_policy: "explicit" | "implicit";
}

export interface Pattern {
  pattern_id: string;
  semantic_match: string;
  bpmn_hint: {
    task_type: "user_task" | "service_task" | "manual_task";
    gateway_type?: "exclusive" | "parallel" | "inclusive";
  };
}
