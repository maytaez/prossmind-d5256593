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
 * Main entry point: Add complete BPMN diagram to structure-only XML
 */
export function addBpmnDiagram(structureXml: string): string {
  console.log("[addBpmnDiagram] Parsing structure XML...");

  //  Parse the structure XML
  const { process, collaboration } = parseStructureXml(structureXml);

  console.log(
    `[addBpmnDiagram] Found ${process.elements.length} elements, ${process.flows.length} flows, ${process.lanes.length} lanes`,
  );

  // Calculate base layout (without lanes constraint)
  const baseLayout = calculateLayout(
    {
      id: process.id,
      name: process.name,
      elements: process.elements,
      flows: process.flows,
    } as any,
    200, // startX - leave room for lane labels
    100, // startY
  );

  let finalBoundsMap = new Map<string, Bounds>();
  baseLayout.nodes.forEach((node, id) => {
    finalBoundsMap.set(id, node.bounds);
  });

  // Handle boundary events
  const boundaryEvents = process.elements.filter((el: any) => el.type === "boundaryEvent" && el.attachedToRef);

  if (boundaryEvents.length > 0) {
    console.log(`[addBpmnDiagram] Positioning ${boundaryEvents.length} boundary events...`);
    const boundaryBounds = positionBoundaryEvents(boundaryEvents, finalBoundsMap);
    boundaryBounds.forEach((bounds, id) => {
      finalBoundsMap.set(id, bounds);
    });
  }

  // Handle lanes if present
  let laneLayouts: any[] = [];
  let totalHeight = baseLayout.totalHeight;

  if (process.lanes.length > 0) {
    console.log(`[addBpmnDiagram] Calculating layout for ${process.lanes.length} lanes...`);

    // Calculate lane layout
    const laneResult = calculateLaneLayout(process.lanes, finalBoundsMap);
    laneLayouts = laneResult.lanes;
    totalHeight = laneResult.totalHeight;

    // Constrain elements to their lanes
    finalBoundsMap = constrainElementsToLanes(finalBoundsMap, laneLayouts);
  }

  // Build enhanced layout object for DI generation
  const enhancedLayout = {
    nodes: finalBoundsMap,
    edges: baseLayout.edges,
    totalWidth: baseLayout.totalWidth,
    totalHeight,
    lanes: laneLayouts,
    laneHeights: new Map(laneLayouts.map((l) => [l.id, l.height])),
    laneYPositions: new Map(laneLayouts.map((l) => [l.id, l.y])),
  };

  // Generate DI XML
  console.log("[addBpmnDiagram] Generating diagram XML...");
  const diagramXml = generateDiagramXml(
    enhancedLayout,
    collaboration?.participants[0]?.id || process.id,
    process.lanes,
  );

  // Insert into structure XML
  const completeXml = insertDiagram(structureXml, diagramXml);

  console.log(`[addBpmnDiagram] Complete! Generated ${completeXml.length} char XML`);

  return completeXml;
}
