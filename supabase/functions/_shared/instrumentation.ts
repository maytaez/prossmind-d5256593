/// <reference lib="dom" />
/**
 * BPMN Instrumentation for Edge Functions
 * Adds Camunda execution listeners and monitoring attributes to BPMN elements.
 */

export interface InstrumentationResult {
  xml: string;
  warnings: string[];
  instrumentedElements: number;
}

const BPMN_NS = "http://www.omg.org/spec/BPMN/20100524/MODEL";
const CAMUNDA_NS = "http://camunda.org/schema/1.0/bpmn";
const MONITORING_NS = "https://schemas.prossmind.ai/monitoring";
const CASE_ID_FALLBACK = "${processInstanceId}";

const RELEVANT_LOCAL_NAMES = new Set([
  "task",
  "usertask",
  "servicetask",
  "scripttask",
  "callactivity",
  "subprocess",
]);

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';

const randomFragment = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  }
  return Math.random().toString(36).substring(2, 10);
};

const formatXml = (xml: string): string => {
  const PADDING = "  ";
  const reg = /(>)(<)(\/*)/g;
  const xmlWithBreaks = xml.replace(reg, "$1\n$2$3");
  const lines = xmlWithBreaks.split("\n");
  let pad = 0;
  return lines
    .map((line) => {
      let indent = 0;
      if (line.match(/.+<\/\w[^>]*>$/)) {
        indent = 0;
      } else if (line.match(/^<\/\w/)) {
        if (pad !== 0) {
          pad -= 1;
        }
      } else if (line.match(/^<\w([^>]*[^/])?>.*$/)) {
        indent = 1;
      }
      const padding = PADDING.repeat(pad);
      pad += indent;
      return padding + line.trim();
    })
    .join("\n");
};

const ensureNamespace = (definitions: Element, prefix: string, uri: string) => {
  const attr = `xmlns:${prefix}`;
  if (!definitions.hasAttribute(attr)) {
    definitions.setAttribute(attr, uri);
  }
};

const ensureExtensionElements = (
  doc: Document,
  element: Element,
  bpmnNamespace: string
): Element => {
  const existing = Array.from(element.children).find(
    (child: Element) => child.localName?.toLowerCase() === "extensionelements"
  );
  if (existing) {
    return existing;
  }
  const extensionElements = doc.createElementNS(
    bpmnNamespace,
    "bpmn:extensionElements"
  );
  if (element.firstChild) {
    element.insertBefore(extensionElements, element.firstChild);
  } else {
    element.appendChild(extensionElements);
  }
  return extensionElements;
};

const ensureExecutionListener = (
  doc: Document,
  extensionElements: Element,
  event: "start" | "end"
) => {
  const hasListener = Array.from(extensionElements.children).some(
    (child: Element) =>
      child.namespaceURI === CAMUNDA_NS &&
      child.localName === "executionListener" &&
      child.getAttribute("event") === event &&
      child.getAttribute("delegateExpression") === "${bpmnEventLogger}"
  );

  if (!hasListener) {
    const listener = doc.createElementNS(
      CAMUNDA_NS,
      "camunda:executionListener"
    );
    listener.setAttribute("event", event);
    listener.setAttribute("delegateExpression", "${bpmnEventLogger}");
    extensionElements.appendChild(listener);
  }
};

const setMonitoringAttributes = (
  element: Element,
  activityName: string,
  caseIdExpression: string
) => {
  element.setAttributeNS(MONITORING_NS, "monitoring:enabled", "true");
  element.setAttributeNS(MONITORING_NS, "monitoring:eventStart", "true");
  element.setAttributeNS(MONITORING_NS, "monitoring:eventEnd", "true");
  element.setAttributeNS(
    MONITORING_NS,
    "monitoring:activityName",
    activityName
  );
  element.setAttributeNS(
    MONITORING_NS,
    "monitoring:caseIdExpression",
    caseIdExpression || CASE_ID_FALLBACK
  );
};

export function instrumentBpmnXml(
  inputXml: string,
  options?: { caseIdExpression?: string }
): InstrumentationResult {
  if (!inputXml || typeof inputXml !== "string") {
    return { xml: inputXml, warnings: ["Empty BPMN XML"], instrumentedElements: 0 };
  }

  const warnings: string[] = [];
  let instrumented = 0;
  const caseIdExpression = options?.caseIdExpression || CASE_ID_FALLBACK;

  const parser = new DOMParser();
  const doc = parser.parseFromString(inputXml, "application/xml");
  const parseError = doc.getElementsByTagName("parsererror");
  if (parseError.length) {
    warnings.push("Unable to parse BPMN XML for instrumentation.");
    return { xml: inputXml, warnings, instrumentedElements: 0 };
  }

  const definitions = doc.documentElement;
  if (!definitions) {
    warnings.push("BPMN definitions element not found.");
    return { xml: inputXml, warnings, instrumentedElements: 0 };
  }

  const originalHasDeclaration = /^\s*<\?xml/i.test(inputXml);

  ensureNamespace(definitions, "camunda", CAMUNDA_NS);
  ensureNamespace(definitions, "monitoring", MONITORING_NS);

  const bpmnNamespace = definitions.namespaceURI || BPMN_NS;

  const usedIds = new Set<string>();
  Array.from(doc.querySelectorAll("[id]")).forEach((node: Element) => {
    const id = node.getAttribute("id");
    if (id) {
      usedIds.add(id);
    }
  });

  const generateId = (prefix: string) => {
    let candidate = `${prefix}_${randomFragment()}`;
    while (usedIds.has(candidate)) {
      candidate = `${prefix}_${randomFragment()}`;
    }
    usedIds.add(candidate);
    return candidate;
  };

  const allElements = Array.from(doc.getElementsByTagName("*"));
  allElements.forEach((element: Element) => {
    const localName = element.localName?.toLowerCase();
    if (!localName) return;
    if (!RELEVANT_LOCAL_NAMES.has(localName)) return;

    let elementId = element.getAttribute("id");
    if (!elementId || !elementId.trim()) {
      warnings.push(
        `Element "${element.getAttribute("name") || localName}" was missing an id. Generated stable id automatically.`
      );
      elementId = generateId(
        (element.prefix ? `${element.prefix}_` : "") + localName
      );
      element.setAttribute("id", elementId);
    }

    const activityName =
      element.getAttribute("name")?.trim() || elementId || "Unnamed Activity";

    const extensionElements = ensureExtensionElements(
      doc,
      element,
      bpmnNamespace
    );

    ensureExecutionListener(doc, extensionElements, "start");
    ensureExecutionListener(doc, extensionElements, "end");
    setMonitoringAttributes(element, activityName, caseIdExpression);
    instrumented += 1;
  });

  const hasStartEvent =
    doc.getElementsByTagName("bpmn:startEvent").length > 0 ||
    doc.getElementsByTagName("startEvent").length > 0;
  const hasEndEvent =
    doc.getElementsByTagName("bpmn:endEvent").length > 0 ||
    doc.getElementsByTagName("endEvent").length > 0;

  if (!hasStartEvent) {
    warnings.push("Diagram is missing a start event.");
  }
  if (!hasEndEvent) {
    warnings.push("Diagram is missing an end event.");
  }

  const serializer = new XMLSerializer();
  const serialized = serializer.serializeToString(doc);
  const formatted = formatXml(serialized);
  const outputXml = originalHasDeclaration
    ? `${XML_DECLARATION}\n${formatted.replace(XML_DECLARATION, "").trim()}`
    : `${XML_DECLARATION}\n${formatted}`;

  return { xml: outputXml.trim(), warnings, instrumentedElements: instrumented };
}
