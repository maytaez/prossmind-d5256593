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
export async function addBpmnDiagram(structureXml: string): Promise<string> {
  console.log("[addBpmnDiagram] Parsing structure XML...");

  // Parse the structure XML
  const { process, collaboration } = parseStructureXml(structureXml);

  console.log(
    `[addBpmnDiagram] Found ${process.elements.length} elements, ${process.flows.length} flows, ${process.lanes.length} lanes`,
  );

  let finalBoundsMap: Map<string, Bounds>;
  let laneLayouts: any[] = [];
  let totalHeight: number;
  let totalWidth: number;

  // Use lane-aware layout if lanes present
  if (process.lanes.length > 0) {
    console.log(`[addBpmnDiagram] Using lane-aware layout for ${process.lanes.length} lanes...`);

    // Import and use lane-aware layout
    const { calculateLaneAwareLayout } = await import("./bpmn-lane-layout.ts");

    const laneLayoutResult = calculateLaneAwareLayout(
      process.lanes,
      process.elements,
      process.flows,
      200, // startX - leave room for lane labels
      100, // startY
    );

    finalBoundsMap = laneLayoutResult.boundsMap;
    laneLayouts = laneLayoutResult.laneLayouts.map((lane) => ({
      id: lane.id,
      y: lane.y,
      height: lane.height,
    }));

    // Calculate total dimensions
    let maxX = 0;
    let maxY = 0;
    finalBoundsMap.forEach((bounds) => {
      maxX = Math.max(maxX, bounds.x + bounds.width);
      maxY = Math.max(maxY, bounds.y + bounds.height);
    });

    totalWidth = maxX - 200;
    totalHeight =
      laneLayoutResult.laneLayouts[laneLayoutResult.laneLayouts.length - 1]?.y +
      laneLayoutResult.laneLayouts[laneLayoutResult.laneLayouts.length - 1]?.height -
      100;
  } else {
    // No lanes - use standard layout
    console.log("[addBpmnDiagram] Using standard layout (no lanes)");

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

    finalBoundsMap = new Map<string, Bounds>();
    baseLayout.nodes.forEach((node, id) => {
      finalBoundsMap.set(id, node.bounds);
    });

    totalWidth = baseLayout.totalWidth;
    totalHeight = baseLayout.totalHeight;
  }

  // Handle boundary events (applies to both lane-aware and standard layouts)
  const boundaryEvents = process.elements.filter((el: any) => el.type === "boundaryEvent" && el.attachedToRef);

  if (boundaryEvents.length > 0) {
    console.log(`[addBpmnDiagram] Positioning ${boundaryEvents.length} boundary events...`);
    const boundaryBounds = positionBoundaryEvents(boundaryEvents, finalBoundsMap);
    boundaryBounds.forEach((bounds, id) => {
      finalBoundsMap.set(id, bounds);
    });
  }

  // Build layout object for DI generation
  const baseLayout =
    process.lanes.length === 0
      ? calculateLayout(
          { id: process.id, name: process.name, elements: process.elements, flows: process.flows } as any,
          200,
          100,
        )
      : { edges: new Map() }; // We'll need to recalculate edges for lane layout

  // For lane-aware layout, recalculate edges
  let edgesMap = baseLayout.edges;
  if (process.lanes.length > 0) {
    edgesMap = new Map();
    process.flows.forEach((flow) => {
      const sourceBounds = finalBoundsMap.get(flow.sourceRef);
      const targetBounds = finalBoundsMap.get(flow.targetRef);

      if (sourceBounds && targetBounds) {
        // Simple waypoint calculation
        const sourcePoint = {
          x: sourceBounds.x + sourceBounds.width,
          y: sourceBounds.y + sourceBounds.height / 2,
        };
        const targetPoint = {
          x: targetBounds.x,
          y: targetBounds.y + targetBounds.height / 2,
        };

        edgesMap.set(flow.id, {
          id: flow.id,
          flow,
          waypoints: [sourcePoint, targetPoint],
        });
      }
    });
  }

  const enhancedLayout = {
    nodes: finalBoundsMap,
    edges: edgesMap,
    totalWidth,
    totalHeight,
    lanes: laneLayouts,
    laneHeights: new Map(laneLayouts.map((l: any) => [l.id, l.height])),
    laneYPositions: new Map(laneLayouts.map((l: any) => [l.id, l.y])),
  };

  // Generate DI XML
  console.log("[addBpmnDiagram] Generating diagram XML...");
  const diagramXml = generateDiagramXml(
    enhancedLayout,
    process.id, // Always use process ID for BPMNPlane, not participant
    process.lanes,
  );

  // Insert into structure XML
  const completeXml = insertDiagram(structureXml, diagramXml);

  console.log(`[addBpmnDiagram] Complete! Generated ${completeXml.length} char XML`);

  return completeXml;
}
