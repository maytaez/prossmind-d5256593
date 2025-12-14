/**
 * BPMN Structure-to-Complete Diagram Converter
 *
 * Takes structure-only BPMN XML and adds complete diagram interchange (DI)
 */

import { parseStructureXml, generateDiagramXml, insertDiagram } from "./bpmn-xml-parser.ts";
import {
  calculateLayout,
  calculateLaneLayout,
  constrainElementsToLanes,
  positionBoundaryEvents,
  type Layout,
  type Bounds,
} from "./bpmn-layout-calculator.ts";

/**
 * Helper function to determine the size of a BPMN element.
 * This is a simplified version; a more robust implementation might
 * consider different element types and their typical dimensions.
 */
function getElementSize(element: any): { width: number; height: number } {
  switch (element.type) {
    case "startEvent":
    case "endEvent":
    case "intermediateCatchEvent":
    case "intermediateThrowEvent":
    case "boundaryEvent":
      return { width: 36, height: 36 }; // Standard event size
    case "exclusiveGateway":
    case "parallelGateway":
    case "inclusiveGateway":
      return { width: 50, height: 50 }; // Standard gateway size
    case "task":
    case "userTask":
    case "serviceTask":
    case "scriptTask":
    case "manualTask":
    case "sendTask":
    case "receiveTask":
    case "businessRuleTask":
    case "callActivity":
    case "subProcess":
      return { width: 100, height: 80 }; // Standard task/activity size
    default:
      return { width: 100, height: 80 }; // Default size for unknown elements
  }
}

/**
 * Main entry point: Add complete BPMN diagram to structure-only XML
 */
export function addBpmnDiagram(structureXml: string): string {
  console.log("[addBpmnDiagram] Parsing structure XML...");

  // Parse the structure XML
  const { process, collaboration } = parseStructureXml(structureXml);

  console.log(
    `[addBpmnDiagram] Found ${process.elements.length} elements, ${process.flows.length} flows, ${process.lanes.length} lanes`,
  );

  // LANE-AWARE LAYOUT: Group elements by lane and layout each lane independently
  const finalBoundsMap = new Map<string, Bounds>();
  const laneLayouts: any[] = [];

  if (process.lanes.length > 0) {
    console.log(`[addBpmnDiagram] Using lane-aware layout for ${process.lanes.length} lanes`);

    const LANE_START_X = 200;
    const LANE_START_Y = 100;
    const LANE_MIN_HEIGHT = 150;
    const ELEMENT_SPACING_X = 120;
    const ELEMENT_SPACING_Y = 30;

    let currentY = LANE_START_Y;

    // Process each lane
    process.lanes.forEach((lane) => {
      // Get elements assigned to this lane
      const laneElements = process.elements.filter((el: any) => lane.flowNodeRefs.includes(el.id));

      console.log(`[addBpmnDiagram] Lane "${lane.name}": ${laneElements.length} elements`);

      if (laneElements.length === 0) {
        // Empty lane - use minimum height
        laneLayouts.push({
          id: lane.id,
          name: lane.name,
          flowNodeRefs: lane.flowNodeRefs,
          y: currentY,
          height: LANE_MIN_HEIGHT,
        });
        currentY += LANE_MIN_HEIGHT;
        return;
      }

      // Build flow graph for this lane
      const laneElementIds = new Set(laneElements.map((el: any) => el.id));
      const laneFlows = process.flows.filter(
        (flow: any) => laneElementIds.has(flow.sourceRef) && laneElementIds.has(flow.targetRef),
      );

      // Simple left-to-right layout within lane
      // Find start elements (no incoming flows from within lane)
      const hasIncoming = new Set<string>();
      laneFlows.forEach((flow: any) => hasIncoming.add(flow.targetRef));

      const startElements = laneElements.filter((el: any) => !hasIncoming.has(el.id));
      const remainingElements = laneElements.filter((el: any) => hasIncoming.has(el.id));

      // Layout elements left to right
      let currentX = LANE_START_X;
      const laneY = currentY + ELEMENT_SPACING_Y;

      // Place start elements first
      startElements.forEach((el: any) => {
        const size = getElementSize(el);
        finalBoundsMap.set(el.id, {
          x: currentX,
          y: laneY,
          width: size.width,
          height: size.height,
        });
        currentX += size.width + ELEMENT_SPACING_X;
      });

      // Place remaining elements
      remainingElements.forEach((el: any) => {
        const size = getElementSize(el);
        finalBoundsMap.set(el.id, {
          x: currentX,
          y: laneY,
          width: size.width,
          height: size.height,
        });
        currentX += size.width + ELEMENT_SPACING_X;
      });

      // Calculate lane height
      const maxElementHeight = Math.max(...laneElements.map((el: any) => getElementSize(el).height), 0);
      const laneHeight = Math.max(maxElementHeight + ELEMENT_SPACING_Y * 2, LANE_MIN_HEIGHT);

      laneLayouts.push({
        id: lane.id,
        name: lane.name,
        flowNodeRefs: lane.flowNodeRefs,
        y: currentY,
        height: laneHeight,
      });

      currentY += laneHeight;
    });
  } else {
    // No lanes - use original simple layout
    const baseLayout = calculateLayout(
      {
        id: process.id,
        name: process.name,
        elements: process.elements,
        flows: process.flows,
      } as any,
      200,
      100,
    );

    baseLayout.nodes.forEach((node, id) => {
      finalBoundsMap.set(id, node.bounds);
    });
  }

  // Handle boundary events
  const boundaryEvents = process.elements.filter((el: any) => el.type === "boundaryEvent" && el.attachedToRef);

  if (boundaryEvents.length > 0) {
    console.log(`[addBpmnDiagram] Positioning ${boundaryEvents.length} boundary events...`);
    const boundaryBounds = positionBoundaryEvents(boundaryEvents, finalBoundsMap);
    boundaryBounds.forEach((bounds, id) => {
      finalBoundsMap.set(id, bounds);
    });
  }

  // Calculate edges with proper waypoints
  const edges = new Map<string, any>();
  process.flows.forEach((flow: any) => {
    const sourceBounds = finalBoundsMap.get(flow.sourceRef);
    const targetBounds = finalBoundsMap.get(flow.targetRef);

    if (sourceBounds && targetBounds) {
      const startPoint = {
        x: sourceBounds.x + sourceBounds.width,
        y: sourceBounds.y + sourceBounds.height / 2,
      };
      const endPoint = {
        x: targetBounds.x,
        y: targetBounds.y + targetBounds.height / 2,
      };

      // Simple two-point waypoints for clean flows
      edges.set(flow.id, {
        id: flow.id,
        flow,
        waypoints: [startPoint, endPoint],
      });
    }
  });

  // Calculate total dimensions
  let maxX = 0;
  let maxY = 0;
  finalBoundsMap.forEach((bounds) => {
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  });

  const totalHeight =
    laneLayouts.length > 0
      ? laneLayouts[laneLayouts.length - 1].y + laneLayouts[laneLayouts.length - 1].height - 100
      : maxY - 100;

  // Build enhanced layout object for DI generation
  const enhancedLayout = {
    nodes: finalBoundsMap,
    edges: edges,
    totalWidth: maxX - 200,
    totalHeight,
    lanes: laneLayouts,
    laneHeights: new Map(laneLayouts.map((l) => [l.id, l.height])),
    laneYPositions: new Map(laneLayouts.map((l) => [l.id, l.y])),
  };

  // Generate DI XML
  console.log("[addBpmnDiagram] Generating diagram XML...");
  const diagramXml = generateDiagramXml(enhancedLayout, collaboration?.id || process.id, process.lanes);

  // Insert into structure XML
  const completeXml = insertDiagram(structureXml, diagramXml);

  console.log(`[addBpmnDiagram] Complete! Generated ${completeXml.length} char XML`);

  return completeXml;
}
