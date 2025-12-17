/**
 * Lane-aware BPMN Layout Calculator
 *
 * Improved algorithm that properly assigns elements to lanes and creates clean left-to-right flow
 */

import { BPMNElement, BPMNSequenceFlow } from "./bpmn-json-schema.ts";
import { Bounds, Point, getElementSize } from "./bpmn-layout-calculator.ts";

interface LaneElements {
  laneId: string;
  laneName: string;
  elements: BPMNElement[];
  startNodes: BPMNElement[]; // Elements with no incoming edges from within this lane
}

/**
 * Calculate lane-aware layout with global level coordination
 * This ensures elements connected across lanes are aligned horizontally
 */
export function calculateLaneAwareLayout(
  lanes: Array<{ id: string; name: string; flowNodeRefs: string[] }>,
  elements: BPMNElement[],
  flows: BPMNSequenceFlow[],
  startX: number = 200,
  startY: number = 100,
): {
  boundsMap: Map<string, Bounds>;
  laneLayouts: Array<{ id: string; y: number; height: number }>;
} {
  const HORIZONTAL_SPACING = 150;
  const VERTICAL_SPACING = 80;
  const LANE_TOP_MARGIN = 50;
  const LANE_BOTTOM_MARGIN = 30;
  const MIN_LANE_HEIGHT = 150;

  // Build element lookup map
  const elementMap = new Map<string, BPMNElement>();
  elements.forEach((el) => elementMap.set(el.id, el));

  // Build element-to-lane mapping
  const elementToLane = new Map<string, string>();
  lanes.forEach((lane) => {
    lane.flowNodeRefs.forEach((ref) => {
      elementToLane.set(ref, lane.id);
    });
  });

  // STEP 1: Calculate GLOBAL levels considering ALL flows (including cross-lane)
  // This ensures connected elements across lanes are aligned horizontally
  const globalLevels = assignGlobalLevels(elements, flows);

  // Find max level to determine total width
  const maxLevel = Math.max(...Array.from(globalLevels.values()), 0);

  // STEP 2: Group elements by lane
  const laneGroups: LaneElements[] = lanes.map((lane) => ({
    laneId: lane.id,
    laneName: lane.name,
    elements: lane.flowNodeRefs.map((ref) => elementMap.get(ref)).filter((el) => el != null) as BPMNElement[],
    startNodes: [],
  }));

  // STEP 3: Layout lanes vertically, positioning elements based on global levels
  const boundsMap = new Map<string, Bounds>();
  const laneLayouts: Array<{ id: string; y: number; height: number }> = [];
  let currentY = startY;

  laneGroups.forEach((laneGroup) => {
    if (laneGroup.elements.length === 0) {
      // Empty lane
      laneLayouts.push({
        id: laneGroup.laneId,
        y: currentY,
        height: MIN_LANE_HEIGHT,
      });
      currentY += MIN_LANE_HEIGHT;
      return;
    }

    // Group elements by their global level
    const levelGroups = new Map<number, BPMNElement[]>();
    laneGroup.elements.forEach((element) => {
      const level = globalLevels.get(element.id) ?? 0;
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level)!.push(element);
    });

    // Layout elements within this lane
    let maxLaneHeight = 0;
    const laneStartY = currentY + LANE_TOP_MARGIN;

    // Sort levels to process them in order
    const sortedLevels = Array.from(levelGroups.keys()).sort((a, b) => a - b);

    sortedLevels.forEach((level) => {
      const levelElements = levelGroups.get(level)!;
      // Use standard element width (120) for consistent alignment across lanes
      const STANDARD_ELEMENT_WIDTH = 120;
      const levelX = startX + level * (STANDARD_ELEMENT_WIDTH + HORIZONTAL_SPACING);

      // Position elements at this level vertically within the lane
      let elementY = laneStartY;

      // If multiple elements at same level, stack them vertically
      levelElements.forEach((element) => {
        const size = getElementSize(element);

        boundsMap.set(element.id, {
          x: levelX,
          y: elementY,
          width: size.width,
          height: size.height,
        });

        elementY += size.height + VERTICAL_SPACING;
        maxLaneHeight = Math.max(maxLaneHeight, elementY - laneStartY);
      });
    });

    const laneHeight = Math.max(MIN_LANE_HEIGHT, maxLaneHeight + LANE_TOP_MARGIN + LANE_BOTTOM_MARGIN);

    laneLayouts.push({
      id: laneGroup.laneId,
      y: currentY,
      height: laneHeight,
    });

    currentY += laneHeight;
  });

  return { boundsMap, laneLayouts };
}

/**
 * Assign global levels to ALL elements considering ALL flows (including cross-lane)
 * This ensures elements connected across lanes are at the same horizontal level
 */
function assignGlobalLevels(
  elements: BPMNElement[],
  flows: BPMNSequenceFlow[],
): Map<string, number> {
  const levels = new Map<string, number>();
  const visited = new Set<string>();
  const queue: Array<{ element: BPMNElement; level: number }> = [];

  // Build element lookup
  const elementMap = new Map<string, BPMNElement>();
  elements.forEach((el) => elementMap.set(el.id, el));

  // Find start nodes (elements with no incoming flows)
  const incomingCount = new Map<string, number>();
  elements.forEach((el) => incomingCount.set(el.id, 0));
  flows.forEach((flow) => {
    const count = incomingCount.get(flow.targetRef) || 0;
    incomingCount.set(flow.targetRef, count + 1);
  });

  const startNodes = elements.filter((el) => (incomingCount.get(el.id) || 0) === 0);

  // If no clear start nodes, use first element
  if (startNodes.length === 0 && elements.length > 0) {
    startNodes.push(elements[0]);
  }

  // Initialize with start nodes
  startNodes.forEach((node) => {
    levels.set(node.id, 0);
    visited.add(node.id);
    queue.push({ element: node, level: 0 });
  });

  // BFS to assign levels globally
  while (queue.length > 0) {
    const { element, level } = queue.shift()!;

    // Find outgoing flows (including cross-lane)
    const outgoingFlows = flows.filter((flow) => flow.sourceRef === element.id);

    outgoingFlows.forEach((flow) => {
      const targetElement = elementMap.get(flow.targetRef);
      if (!targetElement) return;

      const newLevel = level + 1;
      const currentLevel = levels.get(targetElement.id);

      // Update level if this path is longer (ensures longest path determines level)
      if (currentLevel === undefined || currentLevel < newLevel) {
        levels.set(targetElement.id, newLevel);
      }

      if (!visited.has(targetElement.id)) {
        visited.add(targetElement.id);
        queue.push({ element: targetElement, level: newLevel });
      }
    });
  }

  // Handle unvisited elements (disconnected components)
  elements.forEach((element) => {
    if (!levels.has(element.id)) {
      // Try to find minimum level from any incoming flow
      const incomingFlows = flows.filter((flow) => flow.targetRef === element.id);
      if (incomingFlows.length > 0) {
        const minIncomingLevel = Math.min(
          ...incomingFlows.map((flow) => levels.get(flow.sourceRef) ?? 0),
        );
        levels.set(element.id, minIncomingLevel + 1);
      } else {
        levels.set(element.id, 0);
      }
    }
  });

  return levels;
}
