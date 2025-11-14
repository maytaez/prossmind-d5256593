// File: PidRenderer.ts

import BaseRenderer from 'diagram-js/lib/draw/BaseRenderer';
import { create as svgCreate, append as svgAppend, attr as svgAttr } from 'tiny-svg';
import { assign } from 'min-dash';

/**
 * PidRenderer: custom renderer for pid:symbol and pid:category
 *
 * Usage:
 *   const modeler = new BpmnModeler({
 *     container: '#canvas',
 *     additionalModules: [ PidRendererModule ]
 *   });
 *
 * Where PidRendererModule exports { __init__: ['pidRenderer'], pidRenderer: ['type', PidRenderer] }
 */

const DEFAULT_W = 100;
const DEFAULT_H = 60;

interface Waypoint {
  x: number;
  y: number;
}

interface DiagramElement {
  type?: string;
  id?: string;
  businessObject?: {
    $attrs?: Record<string, string>;
    name?: string;
  };
  width?: number;
  height?: number;
  waypoints?: Waypoint[];
}

class PidRenderer extends BaseRenderer {
  private bpmnRenderer: any;
  private styles: any;
  private _createDefs: boolean = false;
  private isPidMode: boolean = false;

  constructor(eventBus: any, bpmnRenderer: any, styles?: any) {
    super(eventBus, 5000); // very high priority to override default renderer (default is ~1000)
    this.bpmnRenderer = bpmnRenderer;
    this.styles = styles || {};
    this._createDefs = false;
    this.isPidMode = false;

    // Listen for XML import to detect P&ID mode
    eventBus.on('import.done', () => {
      // Check if any elements have pid attributes
      const canvas = bpmnRenderer?.get?.('canvas', false);
      if (canvas) {
        const rootElement = canvas.getRootElement();
        const elementRegistry = bpmnRenderer?.get?.('elementRegistry', false);
        if (elementRegistry) {
          const allElements = elementRegistry.getAll();
          const hasPidElements = allElements.some((el: any) => {
            const bo = el.businessObject;
            if (!bo) return false;
            const attrs = bo.$attrs || {};
            return !!(attrs['pid:symbol'] || attrs['pid:type'] || attrs['pid:category']);
          });
          this.isPidMode = hasPidElements;
        }
      }
    });

    // ensure markers/defs are created once per parent SVG
    eventBus.on('canvas.viewbox.changed', ({ element }: { element: any }) => {
      // no-op; ensures module is connected to eventBus
    });
  }

  canRender(element: DiagramElement): boolean {
    const bo = element.businessObject;
    if (!bo) {
      return false;
    }
    
    // Skip labels and other non-shape elements
    if (element.type === 'label' || element.id?.includes('_label') || element.id?.includes('_di')) {
      return false;
    }
    
    // Check if we're in P&ID mode
    if (!this.isPidMode) {
      // Only check for pid attributes if not in P&ID mode
      const attrs = bo.$attrs || {};
      const hasPidAttr = !!(attrs['pid:symbol'] || attrs['pid:type'] || 
                            attrs['pid:category']);
      if (hasPidAttr) {
        return true;
      }
      return false;
    }
    
    // We're in P&ID mode - be aggressive about rendering
    const name = bo.name || '';
    const elementType = (element.type || '').toLowerCase(); // Convert to lowercase for case-insensitive check
    const attrs = bo.$attrs || {};
    const hasPidAttr = !!(attrs['pid:symbol'] || attrs['pid:type'] || 
                          attrs['pid:category']);
    
    // Check element types that are commonly used for P&ID (case-insensitive)
    const isPidShapeElement = elementType.includes('task') || 
                              elementType.includes('exclusivegateway') ||
                              elementType.includes('dataobjectreference') ||
                              elementType.includes('subprocess') ||
                              elementType.includes('startevent');
    
    const isPidConnectionElement = elementType.includes('sequenceflow') ||
                                   elementType.includes('messageflow');
    
    // Render if:
    // 1. Has P&ID attributes, OR
    // 2. Is a P&ID shape element (task, gateway, etc.) with a name, OR  
    // 3. Is a P&ID connection element (sequenceFlow, messageFlow)
    if (hasPidAttr || (isPidShapeElement && name) || isPidConnectionElement) {
      return true;
    }
    
    return false;
  }

  drawShape(parentNode: SVGElement, element: DiagramElement): SVGElement {
    // parentNode is the SVG container for this element
    const bo = element.businessObject;
    const attrs = bo?.$attrs || {};
    let symbol = attrs['pid:symbol'] || 'unknown';
    let category = attrs['pid:category'] || 'mechanical';
    
    // If symbol is unknown but we're in P&ID mode, infer from element name
    if (symbol === 'unknown' && this.isPidMode) {
      const name = (bo?.name || '').toLowerCase();
      const elementType = element.type || '';
      
      // Infer symbol from name
      if (name.includes('tank') || name.includes('vessel') || name.includes('drum')) {
        symbol = 'tank';
      } else if (name.includes('pump')) {
        symbol = 'pump';
      } else if (name.includes('filter')) {
        symbol = 'filter';
      } else if (name.includes('valve')) {
        symbol = elementType.includes('Gateway') ? 'valve_control' : 'valve_gate';
      } else if (name.includes('transmitter') || name.includes('transducer')) {
        if (name.includes('level')) symbol = 'transmitter_level';
        else if (name.includes('flow')) symbol = 'transmitter_flow';
        else if (name.includes('pressure')) symbol = 'transmitter_pressure';
        else symbol = 'transmitter_level';
      } else if (name.includes('controller')) {
        symbol = 'controller_pid';
      } else if (name.includes('analyzer')) {
        symbol = 'analyzer';
      } else if (name.includes('exchanger') || name.includes('heater') || name.includes('cooler')) {
        symbol = 'heat_exchanger';
      }
      
      // Infer category
      if (symbol.includes('transmitter') || symbol.includes('analyzer') || symbol === 'controller_pid') {
        category = 'control';
      }
    }

    // ensure defs / markers exist on root <svg>
    this._ensureDefs(parentNode);

    // create a group to hold custom drawing
    const g = svgCreate('g');
    svgAttr(g, { class: 'pid-renderer-group' });
    svgAppend(parentNode, g);
    
    // Hide default BPMN rendering by hiding existing visual elements
    // The default renderer creates graphics with specific class names
    setTimeout(() => {
      Array.from(parentNode.children).forEach((child: any) => {
        if (child !== g && child.tagName === 'g') {
          const visual = child.querySelector('.djs-visual') || child;
          if (visual && !visual.classList.contains('pid-renderer-group')) {
            (visual as SVGElement).setAttribute('style', 'display: none !important;');
          }
        }
      });
    }, 0);

    // compute width/height from element (diagram-js provides element.width/height)
    const w = (element.width && element.width > 0) ? element.width : DEFAULT_W;
    const h = (element.height && element.height > 0) ? element.height : DEFAULT_H;

    // draw background or bounding shape depending on symbol
    switch (symbol) {
      // EQUIPMENT
      case 'tank':
      case 'mixing_tank':
      case 'storage_tank':
        this._drawTank(g, w, h);
        break;

      case 'pump':
      case 'pump_centrifugal':
        this._drawPump(g, w, h);
        break;

      case 'filter':
      case 'separator':
        this._drawFilter(g, w, h);
        break;

      case 'heat_exchanger':
      case 'condenser':
        this._drawHeatExchanger(g, w, h);
        break;

      case 'reactor':
        this._drawRectWithDoubleLine(g, w, h);
        break;

      // VALVES
      case 'valve_control':
      case 'valve_gate':
      case 'valve_globe':
      case 'valve_ball':
      case 'valve_butterfly':
      case 'valve_check':
      case 'valve_pressure_relief':
      case 'valve_solenoid':
      case 'valve_diaphragm':
      case 'valve_manual':
        this._drawValve(g, w, h, symbol);
        break;

      // INSTRUMENTS
      case 'transmitter_temp':
      case 'transmitter_pressure':
      case 'transmitter_flow':
      case 'transmitter_level':
      case 'transmitter_analyzer':
      case 'indicator_temp':
      case 'indicator_pressure':
      case 'indicator_flow':
      case 'indicator_level':
      case 'flow_meter':
      case 'pressure_gauge':
        this._drawInstrument(g, w, h, symbol);
        break;

      // CONTROLLERS
      case 'controller_pid':
      case 'controller_plc':
      case 'controller_dcs':
      case 'controller_local':
      case 'controller_remote':
      case 'controller_manual':
        this._drawController(g, w, h, symbol);
        break;

      // ACTUATORS / DRIVES
      case 'actuator_electric':
      case 'actuator_pneumatic':
      case 'actuator_hydraulic':
      case 'motor':
      case 'fan':
        this._drawActuator(g, w, h, symbol);
        break;

      // UTILITY / SPECIAL SYMBOLS
      case 'junction':
      case 'tee_connection':
      case 'analyzer_chamber':
      case 'relay':
      case 'control_panel':
      case 'display':
      case 'instrument_bubble':
        this._drawSmallSymbol(g, w, h, symbol);
        break;

      default:
        // Even for unknown symbols, render something if in P&ID mode
        if (this.isPidMode) {
          // Draw a basic shape to indicate it's a P&ID element
          this._drawRoundedRect(g, w, h, { fill: '#e8f4f8', stroke: '#333', rx: 8 });
        } else {
          // fallback to default bpmn renderer
          return this.bpmnRenderer.drawShape(parentNode, element);
        }
    }

    // draw label (name) if available - place under the shape
    if (bo && bo.name) {
      const label = svgCreate('text');
      svgAttr(label, {
        x: w / 2,
        y: h + 14,
        'text-anchor': 'middle',
        'font-family': 'Arial, Helvetica, sans-serif',
        'font-size': '12px',
        fill: '#222',
        'font-weight': 'normal'
      });
      label.textContent = bo.name;
      svgAppend(g, label);
    }

    return g;
  }

  drawConnection(parentNode: SVGElement, element: DiagramElement): SVGElement {
    // element is a connection element; element.businessObject.$attrs contains pid metadata
    const bo = element.businessObject;
    const category = (bo?.$attrs && bo.$attrs['pid:category']) || 'process';
    const style = (bo?.$attrs && bo.$attrs['pid:style']) || '';
    const stroke = (category === 'signal') ? '#999' : (category === 'electrical' ? '#666' : '#000');
    const dash = (style === 'dashed' || category === 'signal') ? '4 3' : (category === 'electrical' ? '2 2' : null);

    // ensure defs exist
    this._ensureDefs(parentNode);

    // create path using element.waypoints
    const path = svgCreate('path');

    // compute path d from waypoints (diagram-js connection waypoints are in element.waypoints)
    if (element.waypoints && element.waypoints.length > 0) {
      const d = element.waypoints.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
      svgAttr(path, { d });
    } else {
      // fallback to straight line between source/target bounds center - this is unlikely
      svgAttr(path, { d: 'M0 0 L10 10' });
    }

    svgAttr(path, {
      stroke,
      'stroke-width': 1.5,
      fill: 'none'
    });
    if (dash) svgAttr(path, { 'stroke-dasharray': dash });

    // marker based on process vs signal
    if (category === 'process') {
      svgAttr(path, { 'marker-end': 'url(#pid-arrow)' });
    } else {
      svgAttr(path, { 'marker-end': 'url(#pid-arrow-small)' });
    }

    svgAppend(parentNode, path);
    return path;
  }

  // -------------------------
  // Helper draw primitives
  // -------------------------

  _drawRoundedRect(g: SVGElement, w: number, h: number, opts: {
    rx?: number;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
  } = {}) {
    const rect = svgCreate('rect');
    svgAttr(rect, {
      x: 0,
      y: 0,
      width: w,
      height: h,
      rx: opts.rx || 10,
      ry: opts.rx || 10,
      fill: opts.fill || '#b3d9ff',
      stroke: opts.stroke || '#333',
      'stroke-width': opts.strokeWidth || 2
    });
    svgAppend(g, rect);
    return rect;
  }

  _drawRectWithDoubleLine(g: SVGElement, w: number, h: number) {
    // outer
    this._drawRoundedRect(g, w, h, { fill: '#fff', stroke: '#333', rx: 4, strokeWidth: 2 });
    // inner double line to indicate special equipment
    const inner = svgCreate('rect');
    svgAttr(inner, {
      x: 6,
      y: 6,
      width: w - 12,
      height: h - 12,
      rx: 3,
      stroke: '#333',
      'stroke-width': 1,
      fill: 'none'
    });
    svgAppend(g, inner);
  }

  _drawPump(g: SVGElement, w: number, h: number) {
    const r = Math.min(w, h) * 0.35;
    const cx = r + 8;
    const cy = h / 2;
    const circle = svgCreate('circle');
    svgAttr(circle, { cx, cy, r, stroke: '#333', 'stroke-width': 2, fill: '#e6f2ff' });
    svgAppend(g, circle);

    const arrow = svgCreate('polygon');
    const ax = cx + r * 0.2;
    const ay1 = cy - 8;
    const ay2 = cy + 8;
    svgAttr(arrow, { points: `${ax},${cy} ${ax + 22},${ay1} ${ax + 22},${ay2}`, fill: '#333' });
    svgAppend(g, arrow);
  }

  _drawTank(g: SVGElement, w: number, h: number) {
    // Draw a P&ID-style tank: rectangle with elliptical top and bottom
    const rx = w * 0.15; // horizontal radius for ellipses
    const ry = h * 0.15; // vertical radius for ellipses
    
    // Main rectangular body
    const body = svgCreate('rect');
    svgAttr(body, {
      x: rx,
      y: ry,
      width: w - 2 * rx,
      height: h - 2 * ry,
      fill: '#b3d9ff',
      stroke: '#333',
      'stroke-width': 2
    });
    svgAppend(g, body);
    
    // Top ellipse (cap)
    const topEllipse = svgCreate('ellipse');
    svgAttr(topEllipse, {
      cx: w / 2,
      cy: ry,
      rx: rx,
      ry: ry,
      fill: '#b3d9ff',
      stroke: '#333',
      'stroke-width': 2
    });
    svgAppend(g, topEllipse);
    
    // Bottom ellipse (cap) - slightly flattened for conical look
    const bottomEllipse = svgCreate('ellipse');
    svgAttr(bottomEllipse, {
      cx: w / 2,
      cy: h - ry,
      rx: rx,
      ry: ry * 0.7,
      fill: '#b3d9ff',
      stroke: '#333',
      'stroke-width': 2
    });
    svgAppend(g, bottomEllipse);
    
    // Optional: Add a liquid level line inside
    const levelLine = svgCreate('line');
    svgAttr(levelLine, {
      x1: rx + 5,
      y1: h * 0.6,
      x2: w - rx - 5,
      y2: h * 0.6,
      stroke: '#666',
      'stroke-width': 1,
      'stroke-dasharray': '3 3'
    });
    svgAppend(g, levelLine);
  }

  _drawFilter(g: SVGElement, w: number, h: number) {
    // P&ID filter: rectangle with diagonal filter lines
    const rect = svgCreate('rect');
    svgAttr(rect, { 
      x: 0, 
      y: 0, 
      width: w, 
      height: h, 
      rx: 6, 
      fill: '#eaf7ea', 
      stroke: '#333', 
      'stroke-width': 2 
    });
    svgAppend(g, rect);

    // Diagonal filter lines (more P&ID-like)
    const n = 5;
    const spacing = w / (n + 1);
    for (let i = 1; i <= n; i++) {
      const x = spacing * i;
      const line = svgCreate('line');
      svgAttr(line, { 
        x1: x - 8, 
        y1: 8, 
        x2: x + 8, 
        y2: h - 8, 
        stroke: '#333', 
        'stroke-width': 1.5 
      });
      svgAppend(g, line);
    }
  }

  _drawHeatExchanger(g: SVGElement, w: number, h: number) {
    // two parallel circles with connection lines
    const r = Math.min(w, h) * 0.22;
    const cx1 = r + 8;
    const cx2 = w - r - 8;
    const cy = h / 2;
    const c1 = svgCreate('circle');
    svgAttr(c1, { cx: cx1, cy, r, stroke: '#333', 'stroke-width': 1.5, fill: '#fff' });
    svgAppend(g, c1);
    const c2 = svgCreate('circle');
    svgAttr(c2, { cx: cx2, cy, r, stroke: '#333', 'stroke-width': 1.5, fill: '#fff' });
    svgAppend(g, c2);
    const ln = svgCreate('line');
    svgAttr(ln, { x1: cx1 + r, y1: cy, x2: cx2 - r, y2: cy, stroke: '#333', 'stroke-width': 1.2 });
    svgAppend(g, ln);
  }

  _drawValve(g: SVGElement, w: number, h: number, symbol: string) {
    // diamond sized smaller than w/h
    const size = Math.min(w, h) * 0.6;
    const cx = w / 2;
    const cy = h / 2;
    const half = size / 2;
    const points = `${cx},${cy - half} ${cx + half},${cy} ${cx},${cy + half} ${cx - half},${cy}`;
    const poly = svgCreate('polygon');
    svgAttr(poly, { points, stroke: '#000', 'stroke-width': 2, fill: 'none' });
    svgAppend(g, poly);

    // add inner details depending on valve type
    if (symbol === 'valve_control') {
      const cross1 = svgCreate('line');
      svgAttr(cross1, { x1: cx - half * 0.6, y1: cy - half * 0.6, x2: cx + half * 0.6, y2: cy + half * 0.6, stroke: '#000', 'stroke-width': 2 });
      svgAppend(g, cross1);
      const cross2 = svgCreate('line');
      svgAttr(cross2, { x1: cx + half * 0.6, y1: cy - half * 0.6, x2: cx - half * 0.6, y2: cy + half * 0.6, stroke: '#000', 'stroke-width': 2 });
      svgAppend(g, cross2);
    } else if (symbol === 'valve_check') {
      const semi = svgCreate('path');
      svgAttr(semi, { d: `M ${cx - half * 0.4} ${cy} q ${half * 0.4} ${-half * 0.4} ${half * 0.8} 0`, stroke: '#000', 'stroke-width': 1.8, fill: 'none' });
      svgAppend(g, semi);
    } else if (symbol === 'valve_gate') {
      const line = svgCreate('line');
      svgAttr(line, { x1: cx, y1: cy - half, x2: cx, y2: cy + half, stroke: '#000', 'stroke-width': 1.6 });
      svgAppend(g, line);
    } else {
      // small circle for manual/ball
      const c = svgCreate('circle');
      svgAttr(c, { cx, cy, r: Math.max(3, half * 0.25), fill: '#000' });
      svgAppend(g, c);
    }
  }

  _drawInstrument(g: SVGElement, w: number, h: number, symbol: string) {
    // render small circle (instrument bubble) and tag text to right
    const r = Math.min(20, Math.min(w, h) * 0.25);
    const cx = r + 4;
    const cy = h / 2;
    const circle = svgCreate('circle');
    svgAttr(circle, { cx, cy, r, stroke: '#333', 'stroke-width': 1.2, fill: '#fff' });
    svgAppend(g, circle);

    // instrument inner glyphs for analyzers, flow meter, gauge
    if (symbol === 'transmitter_analyzer') {
      const rect = svgCreate('rect');
      svgAttr(rect, { x: cx - r / 2, y: cy - r / 2, width: r, height: r, rx: 2, stroke: '#333', 'stroke-width': 1, fill: '#fff' });
      svgAppend(g, rect);
    } else if (symbol === 'flow_meter') {
      const line = svgCreate('line');
      svgAttr(line, { x1: cx - r + 2, y1: cy, x2: cx + r - 2, y2: cy, stroke: '#333', 'stroke-width': 1.2 });
      svgAppend(g, line);
    } else if (symbol === 'pressure_gauge') {
      const needle = svgCreate('line');
      svgAttr(needle, { x1: cx, y1: cy, x2: cx + r * 0.6, y2: cy - r * 0.4, stroke: '#333', 'stroke-width': 1.2 });
      svgAppend(g, needle);
    }

    // label abbreviation (e.g., TT, PT) if businessObject.name/tag present show on right
    // we rely on main label below; keep instrument simple here
  }

  _drawController(g: SVGElement, w: number, h: number, symbol: string) {
    // controller as rounded rect with PI/D mark
    const rect = svgCreate('rect');
    svgAttr(rect, { x: 0, y: 0, width: w, height: h, rx: 8, stroke: '#333', 'stroke-width': 1.6, fill: '#f9f9f9' });
    svgAppend(g, rect);
    // P I D glyphs: three vertical bars or a horizontal line
    const px = w / 2 - 18;
    const py = h / 2;
    for (let i = 0; i < 3; i++) {
      const line = svgCreate('line');
      svgAttr(line, { x1: px + i * 12, y1: py - 8, x2: px + i * 12, y2: py + 8, stroke: '#333', 'stroke-width': 1 });
      svgAppend(g, line);
    }
  }

  _drawActuator(g: SVGElement, w: number, h: number, symbol: string) {
    if (symbol === 'motor') {
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(w, h) * 0.28;
      const circle = svgCreate('circle');
      svgAttr(circle, { cx, cy, r, stroke: '#333', 'stroke-width': 1.6, fill: '#fff' });
      svgAppend(g, circle);
      const m = svgCreate('text');
      svgAttr(m, { x: cx, y: cy + 5, 'text-anchor': 'middle', 'font-size': '12px', fill: '#333' });
      m.textContent = 'M';
      svgAppend(g, m);
    } else if (symbol === 'actuator_pneumatic') {
      this._drawRoundedRect(g, w * 0.8, h * 0.5, { fill: '#fff', stroke: '#333', rx: 6 });
    } else {
      this._drawSmallSymbol(g, w, h, symbol);
    }
  }

  _drawSmallSymbol(g: SVGElement, w: number, h: number, symbol: string) {
    // small centered circle or square for junctions, tees
    const cx = w / 2;
    const cy = h / 2;
    if (symbol === 'junction' || symbol === 'tee_connection') {
      const c = svgCreate('circle');
      svgAttr(c, { cx, cy, r: 4, fill: '#333' });
      svgAppend(g, c);
    } else if (symbol === 'analyzer_chamber') {
      const rect = svgCreate('rect');
      svgAttr(rect, { x: cx - 12, y: cy - 10, width: 24, height: 20, rx: 4, stroke: '#333', fill: '#fff' });
      svgAppend(g, rect);
    } else {
      const c = svgCreate('circle');
      svgAttr(c, { cx, cy, r: 8, stroke: '#333', fill: '#fff' });
      svgAppend(g, c);
    }
  }

  _ensureDefs(parentNode: SVGElement) {
    // find topmost svg root
    let root: SVGElement | null = parentNode;
    while (root && root.nodeName && root.nodeName.toLowerCase() !== 'svg') {
      root = root.parentNode as SVGElement | null;
    }
    if (!root) return;
    if (this._createDefs) return; // single-shot

    // defs
    const defs = svgCreate('defs');

    // arrow marker (solid)
    const marker = svgCreate('marker');
    svgAttr(marker, { id: 'pid-arrow', markerWidth: 10, markerHeight: 10, refX: 8, refY: 3.5, orient: 'auto', markerUnits: 'strokeWidth' });
    const path = svgCreate('path');
    svgAttr(path, { d: 'M0,0 L8,3.5 L0,7 Z', fill: '#000' });
    svgAppend(marker, path);
    svgAppend(defs, marker);

    // smaller arrow for signal lines
    const marker2 = svgCreate('marker');
    svgAttr(marker2, { id: 'pid-arrow-small', markerWidth: 8, markerHeight: 8, refX: 6, refY: 3, orient: 'auto', markerUnits: 'strokeWidth' });
    const path2 = svgCreate('path');
    svgAttr(path2, { d: 'M0,0 L6,3 L0,6 Z', fill: '#666' });
    svgAppend(marker2, path2);
    svgAppend(defs, marker2);

    // dashed arrow (optional)
    svgAppend(root as SVGElement, defs);
    this._createDefs = true;
  }
}

// export as a DI module
export default {
  __init__: ['pidRenderer'],
  pidRenderer: ['type', ['eventBus', 'bpmnRenderer', PidRenderer]]
};
