/**
 * Lane-aware BPMN Layout Calculator
 * 
 * Improved algorithm that properly assigns elements to lanes and creates clean left-to-right flow
 */

import { BPMNElement, BPMNSequenceFlow } from './bpmn-json-schema.ts';
import { Bounds, Point, getElementSize } from './bpmn-layout-calculator.ts';

interface LaneElements {
    laneId: string;
    laneName: string;
    elements: BPMNElement[];
    startNodes: BPMNElement[]; // Elements with no incoming edges from within this lane
}

/**
 * Calculate lane-aware layout by grouping elements by lane and laying out each lane independently
 */
export function calculateLaneAwareLayout(
    lanes: Array<{ id: string; name: string; flowNodeRefs: string[] }>,
    elements: BPMNElement[],
    flows: BPMNSequenceFlow[],
    startX: number = 200,
    startY: number = 100
): {
    boundsMap: Map<string, Bounds>;
    laneLayouts: Array<{ id: string; y: number; height: number }>;
} {
    const HORIZONTAL_SPACING = 200; // Increased significantly for better separation
    const VERTICAL_SPACING = 120;   // Increased for better vertical separation
    const LANE_TOP_MARGIN = 60;     // More space for lane label
    const LANE_BOTTOM_MARGIN = 40;
    const MIN_LANE_HEIGHT = 200;    // Taller minimum lanes

    // Build element lookup map
    const elementMap = new Map<string, BPMNElement>();
    elements.forEach(el => elementMap.set(el.id, el));

    // Group elements by lane
    const laneGroups: LaneElements[] = lanes.map(lane => ({
        laneId: lane.id,
        laneName: lane.name,
        elements: lane.flowNodeRefs
            .map(ref => elementMap.get(ref))
            .filter(el => el != null) as BPMNElement[],
        startNodes: []
    }));

    // For each lane, find start nodes (elements with no incoming edges from within the lane)
    laneGroups.forEach(laneGroup => {
        const laneElementIds = new Set(laneGroup.elements.map(el => el.id));

        laneGroup.elements.forEach(element => {
            // Check if this element has incoming flows from within the lane
            const hasIncomingFromLane = flows.some(flow =>
                flow.targetRef === element.id && laneElementIds.has(flow.sourceRef)
            );

            if (!hasIncomingFromLane) {
                laneGroup.startNodes.push(element);
            }
        });

        // If no start nodes found (circular reference), just use the first element
        if (laneGroup.startNodes.length === 0 && laneGroup.elements.length > 0) {
            laneGroup.startNodes.push(laneGroup.elements[0]);
        }
    });

    // Layout each lane independently
    const boundsMap = new Map<string, Bounds>();
    const laneLayouts: Array<{ id: string; y: number; height: number }> = [];
    let currentY = startY;

    laneGroups.forEach(laneGroup => {
        if (laneGroup.elements.length === 0) {
            // Empty lane
            laneLayouts.push({
                id: laneGroup.laneId,
                y: currentY,
                height: MIN_LANE_HEIGHT
            });
            currentY += MIN_LANE_HEIGHT;
            return;
        }

        // Build lane-local flow graph
        const laneElementIds = new Set(laneGroup.elements.map(el => el.id));
        const laneFlows = flows.filter(flow =>
            laneElementIds.has(flow.sourceRef) && laneElementIds.has(flow.targetRef)
        );

        // Assign levels using BFS from start nodes
        const levels = assignLevelsForLane(laneGroup.elements, laneFlows, laneGroup.startNodes);

        // Group by level
        const levelGroups = new Map<number, BPMNElement[]>();
        laneGroup.elements.forEach(element => {
            const level = levels.get(element.id) ?? 0;
            if (!levelGroups.has(level)) {
                levelGroups.set(level, []);
            }
            levelGroups.get(level)!.push(element);
        });

        // Layout elements left-to-right by level
        let maxLaneHeight = 0;
        const laneStartY = currentY + LANE_TOP_MARGIN;

        // Calculate max elements per level to determine vertical spacing
        const maxElementsPerLevel = Math.max(...Array.from(levelGroups.values()).map(arr => arr.length));
        const elementVerticalSpacing = maxElementsPerLevel > 1 ? VERTICAL_SPACING : VERTICAL_SPACING * 2;

        levelGroups.forEach((levelElements, level) => {
            const levelX = startX + level * 220; // Increased from 150 to 220 for more horizontal space
            let elementY = laneStartY;

            // If multiple elements at same level, spread them vertically within the lane
            const verticalGap = levelElements.length > 1 ? elementVerticalSpacing : 0;

            levelElements.forEach((element, elementIndex) => {
                const size = getElementSize(element);

                boundsMap.set(element.id, {
                    x: levelX,
                    y: elementY,
                    width: size.width,
                    height: size.height
                });

                elementY += size.height + verticalGap;
                maxLaneHeight = Math.max(maxLaneHeight, elementY - laneStartY);
            });
        });

        const laneHeight = Math.max(MIN_LANE_HEIGHT, maxLaneHeight + LANE_TOP_MARGIN + LANE_BOTTOM_MARGIN);

        laneLayouts.push({
            id: laneGroup.laneId,
            y: currentY,
            height: laneHeight
        });

        currentY += laneHeight;
    });

    return { boundsMap, laneLayouts };
}

/**
 * Assign levels (columns) to elements within a lane using BFS
 * Falls back to sequential distribution if BFS doesn't find enough levels
 */
function assignLevelsForLane(
    elements: BPMNElement[],
    flows: BPMNSequenceFlow[],
    startNodes: BPMNElement[]
): Map<string, number> {
    const levels = new Map<string, number>();
    const visited = new Set<string>();
    const queue: Array<{ element: BPMNElement; level: number }> = [];

    // Initialize with start nodes
    startNodes.forEach(node => {
        levels.set(node.id, 0);
        visited.add(node.id);
        queue.push({ element: node, level: 0 });
    });

    let maxLevel = 0;

    // BFS
    while (queue.length > 0) {
        const { element, level } = queue.shift()!;

        // Find outgoing flows
        const outgoingFlows = flows.filter(flow => flow.sourceRef === element.id);

        outgoingFlows.forEach(flow => {
            const targetElement = elements.find(el => el.id === flow.targetRef);
            if (!targetElement) return;

            const newLevel = level + 1;
            const currentLevel = levels.get(targetElement.id);

            // Update level if this path is longer
            if (currentLevel === undefined || currentLevel < newLevel) {
                levels.set(targetElement.id, newLevel);
                maxLevel = Math.max(maxLevel, newLevel);
            }

            if (!visited.has(targetElement.id)) {
                visited.add(targetElement.id);
                queue.push({ element: targetElement, level: newLevel });
            }
        });
    }

    // Handle unvisited elements (disconnected or only cross-lane flows)
    // Distribute them across levels to prevent vertical stacking
    const unassigned = elements.filter(el => !levels.has(el.id));

    if (unassigned.length > 0) {
        console.log(`[Lane Layout] ${unassigned.length} elements not reached by BFS, distributing across levels`);

        // If we found very few levels via BFS, distribute all elements more evenly
        const targetLevels = Math.max(maxLevel + 1, Math.ceil(Math.sqrt(elements.length)));

        unassigned.forEach((element, index) => {
            // Distribute unassigned elements across available levels
            const level = (maxLevel + 1) + (index % Math.max(2, targetLevels - maxLevel - 1));
            levels.set(element.id, level);
        });
    }

    return levels;
}
