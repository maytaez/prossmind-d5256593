/**
 * Stage 3: Validation + Auto-fix
 * Validates BPMN IR and automatically fixes common issues
 */

import type { BpmnIR } from "./types/bpmn-ir.ts";
import type { ValidationResult, ValidationIssue } from "./types/validation.ts";

/**
 * Validate BPMN IR structure and BPMN compliance
 */
export function validateBpmnIR(ir: BpmnIR): ValidationResult {
  const issues: ValidationIssue[] = [];
  const fixes: Array<{ action: string; details: string[] }> = [];

  // 1. Structural Validation
  const startEvents = ir.nodes.filter(n => n.type === "start_event");
  const endEvents = ir.nodes.filter(n => n.type === "end_event");
  const gateways = ir.nodes.filter(n => n.type.includes("gateway"));
  const tasks = ir.nodes.filter(n => n.type.includes("task"));

  // Check for start event
  if (startEvents.length === 0) {
    issues.push({
      rule: "BPMN_START_EVENT_REQUIRED",
      severity: "error",
      message: "At least one start event is required",
    });
  }

  // Check for end events
  if (endEvents.length === 0) {
    issues.push({
      rule: "BPMN_END_EVENT_REQUIRED",
      severity: "error",
      message: "At least one end event is required",
    });
  }

  // Check for orphan nodes (nodes without incoming or outgoing flows)
  const nodeIds = new Set(ir.nodes.map(n => n.id));
  const flowSources = new Set(ir.flows.map(f => f.from));
  const flowTargets = new Set(ir.flows.map(f => f.to));

  for (const node of ir.nodes) {
    if (node.type === "start_event") {
      if (!flowSources.has(node.id)) {
        issues.push({
          rule: "BPMN_ORPHAN_START_EVENT",
          severity: "warning",
          message: `Start event ${node.id} has no outgoing flows`,
          node_id: node.id,
        });
      }
    } else if (node.type === "end_event") {
      if (!flowTargets.has(node.id)) {
        issues.push({
          rule: "BPMN_ORPHAN_END_EVENT",
          severity: "warning",
          message: `End event ${node.id} has no incoming flows`,
          node_id: node.id,
        });
      }
    } else {
      const hasIncoming = flowTargets.has(node.id);
      const hasOutgoing = flowSources.has(node.id);
      if (!hasIncoming && !hasOutgoing) {
        issues.push({
          rule: "BPMN_ORPHAN_NODE",
          severity: "error",
          message: `Node ${node.id} has no incoming or outgoing flows`,
          node_id: node.id,
        });
      }
    }
  }

  // Check for invalid flow references
  for (const flow of ir.flows) {
    if (!nodeIds.has(flow.from)) {
      issues.push({
        rule: "BPMN_INVALID_FLOW_SOURCE",
        severity: "error",
        message: `Flow references unknown source node: ${flow.from}`,
        flow_id: `${flow.from}_${flow.to}`,
      });
    }
    if (!nodeIds.has(flow.to)) {
      issues.push({
        rule: "BPMN_INVALID_FLOW_TARGET",
        severity: "error",
        message: `Flow references unknown target node: ${flow.to}`,
        flow_id: `${flow.from}_${flow.to}`,
      });
    }
  }

  // Check gateway split/join pairs
  for (const gateway of gateways) {
    const incomingFlows = ir.flows.filter(f => f.to === gateway.id);
    const outgoingFlows = ir.flows.filter(f => f.from === gateway.id);

    if (gateway.type === "parallel_gateway") {
      // Parallel gateways should have proper split/join pairs
      if (incomingFlows.length > 1 && outgoingFlows.length === 1) {
        // Join gateway - OK
      } else if (incomingFlows.length === 1 && outgoingFlows.length > 1) {
        // Split gateway - OK
      } else if (incomingFlows.length === 1 && outgoingFlows.length === 1) {
        issues.push({
          rule: "BPMN_INVALID_PARALLEL_GATEWAY",
          severity: "warning",
          message: `Parallel gateway ${gateway.id} should have multiple incoming or outgoing flows`,
          node_id: gateway.id,
        });
      }
    }
  }

  // Check lane references
  const laneIds = new Set(ir.lanes.map(l => l.id));
  for (const node of ir.nodes) {
    if (!laneIds.has(node.lane)) {
      issues.push({
        rule: "BPMN_INVALID_LANE_REFERENCE",
        severity: "error",
        message: `Node ${node.id} references unknown lane: ${node.lane}`,
        node_id: node.id,
      });
    }
  }

  // 2. Completeness checks (warnings)
  // Check if all paths have end events
  const nodesWithOutgoing = new Set(ir.flows.map(f => f.from));
  const nodesWithIncoming = new Set(ir.flows.map(f => f.to));
  const endEventIds = new Set(endEvents.map(e => e.id));

  // Find nodes that have outgoing flows but don't lead to end events
  const pathsWithoutEnd: string[] = [];
  for (const nodeId of nodesWithOutgoing) {
    if (nodeId && !endEventIds.has(nodeId)) {
      // Check if this path eventually reaches an end event
      const reachesEnd = checkPathReachesEnd(nodeId, ir.flows, endEventIds, new Set());
      if (!reachesEnd) {
        pathsWithoutEnd.push(nodeId);
      }
    }
  }

  if (pathsWithoutEnd.length > 0) {
    issues.push({
      rule: "BPMN_PATHS_WITHOUT_END",
      severity: "warning",
      message: `Some paths do not reach an end event`,
    });
  }

  // Determine validation status
  const hasErrors = issues.some(i => i.severity === "error");
  const hasWarnings = issues.some(i => i.severity === "warning");

  if (hasErrors) {
    return {
      validation_status: "requires_manual_fix",
      issues_detected: issues,
    };
  }

  // Try auto-fix for warnings
  if (hasWarnings) {
    const fixedIR = autoFixBpmnIR(ir, issues);
    if (fixedIR) {
      return {
        validation_status: "auto_fixed",
        issues_detected: issues,
        fixes_applied: fixes,
        fixed_ir: fixedIR,
      };
    }
  }

  return {
    validation_status: "valid",
    issues_detected: issues,
  };
}

/**
 * Check if a path from a node eventually reaches an end event
 */
function checkPathReachesEnd(
  nodeId: string,
  flows: BpmnIR["flows"],
  endEventIds: Set<string>,
  visited: Set<string>
): boolean {
  if (visited.has(nodeId)) return false; // Cycle detected
  if (endEventIds.has(nodeId)) return true;

  visited.add(nodeId);
  const outgoingFlows = flows.filter(f => f.from === nodeId);

  for (const flow of outgoingFlows) {
    if (checkPathReachesEnd(flow.to, flows, endEventIds, new Set(visited))) {
      return true;
    }
  }

  return false;
}

/**
 * Automatically fix common issues in BPMN IR
 */
export function autoFixBpmnIR(ir: BpmnIR, issues: ValidationIssue[]): BpmnIR | null {
  const fixedIR: BpmnIR = JSON.parse(JSON.stringify(ir)); // Deep clone
  const fixes: Array<{ action: string; details: string[] }> = [];
  let hasFixes = false;

  // Fix 1: Add missing start event
  const startEvents = fixedIR.nodes.filter(n => n.type === "start_event");
  if (startEvents.length === 0) {
    const firstLane = fixedIR.lanes[0];
    if (firstLane) {
      const startEventId = "start_1";
      fixedIR.nodes.unshift({
        id: startEventId,
        type: "start_event",
        name: "Start",
        lane: firstLane.id,
      });
      fixes.push({
        action: "added_start_event",
        details: [startEventId],
      });
      hasFixes = true;
    }
  }

  // Fix 2: Add missing end events for paths without explicit end
  const endEvents = fixedIR.nodes.filter(n => n.type === "end_event");
  const endEventIds = new Set(endEvents.map(e => e.id));
  const flowSources = new Set(fixedIR.flows.map(f => f.from));
  const flowTargets = new Set(fixedIR.flows.map(f => f.to));

  // Find nodes with outgoing flows that don't lead to end events
  const nodesNeedingEnd: string[] = [];
  for (const node of fixedIR.nodes) {
    if (node.type !== "end_event" && flowSources.has(node.id)) {
      const outgoingFlows = fixedIR.flows.filter(f => f.from === node.id);
      const allLeadToEnd = outgoingFlows.every(f => {
        return checkPathReachesEnd(f.to, fixedIR.flows, endEventIds, new Set());
      });
      if (!allLeadToEnd) {
        nodesNeedingEnd.push(node.id);
      }
    }
  }

  if (nodesNeedingEnd.length > 0 && endEvents.length === 0) {
    // Add at least one end event
    const lastLane = fixedIR.lanes[fixedIR.lanes.length - 1];
    if (lastLane) {
      const endEventId = "end_1";
      fixedIR.nodes.push({
        id: endEventId,
        type: "end_event",
        name: "End",
        lane: lastLane.id,
      });
      fixes.push({
        action: "added_end_events",
        details: [endEventId],
      });
      hasFixes = true;

      // Connect nodes without end to the new end event
      for (const nodeId of nodesNeedingEnd) {
        const existingFlow = fixedIR.flows.find(f => f.from === nodeId && f.to === endEventId);
        if (!existingFlow) {
          fixedIR.flows.push({
            from: nodeId,
            to: endEventId,
          });
        }
      }
    }
  }

  // Fix 3: Remove orphan nodes (nodes with no flows)
  const nodeIds = new Set(fixedIR.nodes.map(n => n.id));
  const orphanNodes = fixedIR.nodes.filter(node => {
    if (node.type === "start_event" || node.type === "end_event") {
      return false; // Keep start/end events even if orphaned
    }
    const hasIncoming = fixedIR.flows.some(f => f.to === node.id);
    const hasOutgoing = fixedIR.flows.some(f => f.from === node.id);
    return !hasIncoming && !hasOutgoing;
  });

  if (orphanNodes.length > 0) {
    const orphanIds = orphanNodes.map(n => n.id);
    fixedIR.nodes = fixedIR.nodes.filter(n => !orphanIds.includes(n.id));
    fixes.push({
      action: "removed_orphan_nodes",
      details: orphanIds,
    });
    hasFixes = true;
  }

  // Fix 4: Remove invalid flows
  const invalidFlows = fixedIR.flows.filter(flow => {
    return !nodeIds.has(flow.from) || !nodeIds.has(flow.to);
  });

  if (invalidFlows.length > 0) {
    const invalidFlowIds = invalidFlows.map(f => `${f.from}_${f.to}`);
    fixedIR.flows = fixedIR.flows.filter(flow => {
      return nodeIds.has(flow.from) && nodeIds.has(flow.to);
    });
    fixes.push({
      action: "removed_invalid_flows",
      details: invalidFlowIds,
    });
    hasFixes = true;
  }

  // Fix 5: Ensure start event has outgoing flow
  const startEvent = fixedIR.nodes.find(n => n.type === "start_event");
  if (startEvent) {
    const hasOutgoing = fixedIR.flows.some(f => f.from === startEvent.id);
    if (!hasOutgoing) {
      // Connect to first task in the same lane
      const firstTask = fixedIR.nodes.find(
        n => n.lane === startEvent.lane && n.type.includes("task")
      );
      if (firstTask) {
        fixedIR.flows.unshift({
          from: startEvent.id,
          to: firstTask.id,
        });
        fixes.push({
          action: "connected_start_event",
          details: [`${startEvent.id} -> ${firstTask.id}`],
        });
        hasFixes = true;
      }
    }
  }

  return hasFixes ? fixedIR : null;
}
