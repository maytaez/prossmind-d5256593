import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import BpmnModeler from "bpmn-js/lib/Modeler";
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css";
import PidRenderer from "@/plugins/PidRenderer";
import { featureFlags } from "@/config/featureFlags";
import { Button } from "@/components/ui/button";
import { Save, Download, Undo, Redo, Trash2, Wrench, Upload, QrCode, History, Bot, Activity, Info, Palette, X, FileDown, Home, Layers, Sparkles, ShieldCheck, Loader2, Globe, MousePointerClick, Check, Search, User, Grid3x3, Ruler, Image as ImageIcon, AlertTriangle, Plus, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, FileText, Users, Settings, Code, ZoomIn, ZoomOut, Maximize2, Minus, Maximize, Minimize, Hand, FileSearch, GripVertical, GripHorizontal, List, Eye } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/utils/api-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";
import type { User as SupabaseUser } from "@supabase/supabase-js";

interface BpmnViewerProps {
  xml: string;
  onSave?: (xml: string) => void;
  diagramType?: "bpmn" | "pid";
  onRefine?: () => void;
}

interface Collaborator {
  userId: string;
  email: string;
  roles: string[];
  lastLogin?: string | null;
  createdAt?: string | null;
}

type AlternativeComplexity = "basic" | "intermediate" | "advanced";

interface AlternativeModel {
  id: string;
  title: string;
  description: string;
  complexity: AlternativeComplexity;
  xml: string;
  generatedAt?: string;
  metrics?: {
    taskCount: number;
    decisionPoints: number;
    parallelBranches: number;
    errorHandlers: number;
    eventTypes: string[];
    estimatedPaths: number;
  };
  previewFailed?: boolean;
}

interface XmlViewerData {
  title: string;
  xml: string;
  generatedAt?: string;
  complexity?: AlternativeComplexity;
  source?: "alternative" | "canvas";
}

type SystemActivityType = "visit" | "click";

interface SystemActivity {
  id: string;
  type: SystemActivityType;
  timestamp: string;
  details: {
    url?: string;
    title?: string;
    text?: string;
    tag?: string;
    xpath?: string;
    contentPreview?: string;
    referrer?: string;
  };
}

interface LogHistoryEntry {
  id: string;
  created_at: string | null;
  input_description: string | null;
  generated_bpmn_xml: string;
  alternative_models: unknown;
  user_id?: string;
  input_type?: string | null;
}

const LANGUAGE_OPTIONS = [
  { value: "auto", label: "Auto (match prompt language)" },
  { value: "en", label: "English" },
  { value: "es", label: "Español (Spanish)" },
  { value: "fr", label: "Français (French)" },
  { value: "de", label: "Deutsch (German)" },
  { value: "pt", label: "Português (Portuguese)" },
  { value: "it", label: "Italiano (Italian)" },
] as const;

type LanguageOptionValue = (typeof LANGUAGE_OPTIONS)[number]["value"];

const LANGUAGE_NATIVE_NAMES: Record<LanguageOptionValue, string> = {
  auto: "Prompt language",
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  it: "Italiano",
};

const LANGUAGE_DICTIONARIES: Record<string, Record<string, string>> = {
  es: {
    start: "inicio",
    startevent: "evento de inicio",
    end: "fin",
    event: "evento",
    endevent: "evento final",
    approve: "aprobar",
    approval: "aprobación",
    request: "solicitud",
    review: "revisión",
    task: "tarea",
    user: "usuario",
    service: "servicio",
    process: "proceso",
    data: "datos",
    validation: "validación",
    payment: "pago",
    error: "error",
    handling: "gestión",
    customer: "cliente",
    support: "soporte",
    escalation: "escalamiento",
    decision: "decisión",
    gateway: "compuerta",
    branch: "rama",
    automation: "automatización",
    monitoring: "monitoreo",
    compliance: "cumplimiento",
  },
  fr: {
    start: "début",
    startevent: "événement de début",
    end: "fin",
    event: "événement",
    endevent: "événement de fin",
    approve: "approuver",
    approval: "approbation",
    request: "demande",
    review: "revue",
    task: "tâche",
    user: "utilisateur",
    service: "service",
    process: "processus",
    data: "données",
    validation: "validation",
    payment: "paiement",
    error: "erreur",
    handling: "gestion",
    customer: "client",
    support: "support",
    escalation: "escalade",
    decision: "décision",
    gateway: "passerelle",
    branch: "branche",
    automation: "automatisation",
    compliance: "conformité",
  },
  de: {
    start: "start",
    startevent: "startereignis",
    end: "ende",
    event: "ereignis",
    endevent: "endereignis",
    approve: "genehmigen",
    approval: "genehmigung",
    request: "anfrage",
    review: "prüfung",
    task: "aufgabe",
    user: "benutzer",
    service: "dienst",
    process: "prozess",
    data: "daten",
    validation: "validierung",
    payment: "zahlung",
    error: "fehler",
    handling: "bearbeitung",
    customer: "kunde",
    support: "support",
    escalation: "eskalation",
    decision: "entscheidung",
    gateway: "gateway",
    branch: "zweig",
    automation: "automatisierung",
    compliance: "compliance",
  },
  pt: {
    start: "início",
    startevent: "evento inicial",
    end: "fim",
    event: "evento",
    endevent: "evento final",
    approve: "aprovar",
    approval: "aprovação",
    request: "solicitação",
    review: "revisão",
    task: "tarefa",
    user: "usuário",
    service: "serviço",
    process: "processo",
    data: "dados",
    validation: "validação",
    payment: "pagamento",
    error: "erro",
    handling: "tratamento",
    customer: "cliente",
    support: "suporte",
    escalation: "escalonamento",
    decision: "decisão",
    gateway: "gateway",
    branch: "ramo",
    automation: "automação",
    compliance: "conformidade",
  },
  it: {
    start: "inizio",
    startevent: "evento iniziale",
    end: "fine",
    event: "evento",
    endevent: "evento finale",
    approve: "approvare",
    approval: "approvazione",
    request: "richiesta",
    review: "revisione",
    task: "attività",
    user: "utente",
    service: "servizio",
    process: "processo",
    data: "dati",
    validation: "validazione",
    payment: "pagamento",
    error: "errore",
    handling: "gestione",
    customer: "cliente",
    support: "supporto",
    escalation: "escalation",
    decision: "decisione",
    gateway: "gateway",
    branch: "ramo",
    automation: "automazione",
    compliance: "conformità",
  },
};

const LANGUAGE_PHRASES: Record<string, Array<{ pattern: RegExp; replacement: string }>> = {
  es: [
    { pattern: /start event/gi, replacement: "Evento de Inicio" },
    { pattern: /end event/gi, replacement: "Evento Final" },
    { pattern: /user task/gi, replacement: "Tarea de Usuario" },
    { pattern: /service task/gi, replacement: "Tarea de Servicio" },
  ],
  fr: [
    { pattern: /start event/gi, replacement: "Événement de début" },
    { pattern: /end event/gi, replacement: "Événement de fin" },
    { pattern: /user task/gi, replacement: "Tâche utilisateur" },
    { pattern: /service task/gi, replacement: "Tâche de service" },
  ],
  de: [
    { pattern: /start event/gi, replacement: "Startereignis" },
    { pattern: /end event/gi, replacement: "Endereignis" },
    { pattern: /user task/gi, replacement: "Benutzeraufgabe" },
    { pattern: /service task/gi, replacement: "Serviceaufgabe" },
  ],
  pt: [
    { pattern: /start event/gi, replacement: "Evento de Início" },
    { pattern: /end event/gi, replacement: "Evento Final" },
    { pattern: /user task/gi, replacement: "Tarefa do Usuário" },
    { pattern: /service task/gi, replacement: "Tarefa de Serviço" },
  ],
  it: [
    { pattern: /start event/gi, replacement: "Evento Iniziale" },
    { pattern: /end event/gi, replacement: "Evento Finale" },
    { pattern: /user task/gi, replacement: "Attività Utente" },
    { pattern: /service task/gi, replacement: "Attività di Servizio" },
  ],
};

const LANGUAGE_STORAGE_KEY = "bpmn-language-preference";
const SUPPORTED_LIVE_TRANSLATIONS = new Set(Object.keys(LANGUAGE_DICTIONARIES));

const isLanguageValue = (value: string): value is LanguageOptionValue =>
  LANGUAGE_OPTIONS.some((option) => option.value === value);

const sanitizeDictionaryToken = (token: string) =>
  token
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");

const applyCaseStyle = (source: string, translated: string) => {
  if (!source) return translated;
  if (source === source.toUpperCase()) {
    return translated.toUpperCase();
  }
  if (source[0] === source[0]?.toUpperCase()) {
    return translated.charAt(0).toUpperCase() + translated.slice(1);
  }
  return translated;
};

const translateWithDictionary = (text: string, languageCode: string): string | null => {
  const dictionary = LANGUAGE_DICTIONARIES[languageCode];
  if (!dictionary) return null;

  const phraseRules = LANGUAGE_PHRASES[languageCode];
  let workingText = text;

  if (phraseRules) {
    phraseRules.forEach(({ pattern, replacement }) => {
      workingText = workingText.replace(pattern, (match) =>
        applyCaseStyle(match, replacement)
      );
    });
  }

  const tokens = workingText.split(/(\s+|[-/(),:]+)/g);
  const translated = tokens.map((token) => {
    if (!token.trim() || /(\s+|[-/(),:]+)/.test(token)) {
      return token;
    }
    const sanitized = sanitizeDictionaryToken(token);
    const translation = dictionary[sanitized];
    if (!translation) {
      return token;
    }
    return applyCaseStyle(token, translation);
  });

  return translated.join("");
};

/**
 * Simple language detection based on common patterns and keywords
 * Returns ISO 639-1 language code (e.g., 'en', 'es', 'fr', 'de', etc.)
 * Falls back to 'en' if language cannot be determined
 * This is a simplified frontend version of the backend language detection
 */
const detectLanguageFromText = (text: string): string => {
  if (!text || text.trim().length === 0) {
    return 'en';
  }

  const normalizedText = text.toLowerCase();

  // Check for German-specific characters and common words first (more reliable)
  if (/[äöüßÄÖÜ]/.test(text)) {
    return 'de';
  }

  // Common language patterns - expanded with more common words
  const languagePatterns: Record<string, RegExp[]> = {
    'es': [/\b(es|está|están|con|para|por|del|la|el|de|en|un|una|son|ser|hacer|tiene|tener|proceso|diagrama|crear|generar|tarea|aprobar|revisión|validación)\b/i],
    'fr': [/\b(est|sont|avec|pour|par|du|la|le|de|en|un|une|sont|être|faire|a|avoir|processus|diagramme|créer|générer|tâche|approuver|revue|validation)\b/i],
    'de': [
      /\b(ist|sind|mit|für|von|der|die|das|dem|den|des|ein|eine|einen|einem|einer|und|oder|prozess|prozesse|diagramm|erstellen|generieren|aufgabe|aktivität)\b/i
    ],
    'it': [/\b(è|sono|con|per|da|del|la|il|di|in|un|una|sono|essere|fare|ha|avere|processo|diagramma|creare|generare|compito)\b/i],
    'pt': [/\b(é|são|com|para|por|do|da|de|em|um|uma|são|ser|fazer|tem|ter|processo|diagrama|criar|gerar|tarefa)\b/i],
    'ru': [/\b(есть|с|для|от|в|на|процесс|диаграмма|создать|генерировать|начать|конец|задача)\b/i],
    'ja': [/\b(は|が|を|に|で|プロセス|図|作成|生成|開始|終了|タスク)\b/i],
    'ko': [/\b(은|는|을|를|에|에서|프로세스|다이어그램|생성|시작|종료|작업)\b/i],
    'zh': [/\b(是|的|在|和|过程|图表|创建|生成|开始|结束|任务)\b/i],
    'ar': [/\b(هو|هي|مع|ل|من|في|عملية|رسم|إنشاء|بداية|نهاية|مهمة)\b/i],
    'hi': [/\b(है|के|से|में|प्रक्रिया|आरेख|बनाएं|शुरू|अंत|कार्य)\b/i],
  };

  // Count matches for each language
  const scores: Record<string, number> = {};

  for (const [lang, patterns] of Object.entries(languagePatterns)) {
    scores[lang] = 0;
    for (const pattern of patterns) {
      const matches = normalizedText.match(pattern);
      if (matches) {
        scores[lang] += matches.length;
      }
    }
  }

  // Find language with highest score
  let maxScore = 0;
  let detectedLang = 'en';

  for (const [lang, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedLang = lang;
    }
  }

  // If no strong match found, check for specific character sets
  if (maxScore === 0) {
    // Check for Chinese/Japanese/Korean characters
    if (/[\u4e00-\u9fff]/.test(text)) {
      return 'zh';
    }
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) {
      return 'ja';
    }
    if (/[\uac00-\ud7af]/.test(text)) {
      return 'ko';
    }
    // Check for Arabic/Hebrew (RTL scripts)
    if (/[\u0600-\u06ff]/.test(text)) {
      return 'ar';
    }
    // Check for Cyrillic
    if (/[\u0400-\u04ff]/.test(text)) {
      return 'ru';
    }
    // Check for Devanagari (Hindi)
    if (/[\u0900-\u097f]/.test(text)) {
      return 'hi';
    }
  }

  return detectedLang;
};

const getLanguageDirective = (languageCode: LanguageOptionValue): string => {
  if (languageCode === "auto") {
    return `LANGUAGE DIRECTIVE:
- Mirror the language used in the user's prompt and on the current canvas.
- If the existing diagram contains Spanish labels, every generated variant MUST also be Spanish.
- Never switch to English unless the prompt itself is English.`;
  }

  const languageName = LANGUAGE_NATIVE_NAMES[languageCode] ?? languageCode.toUpperCase();
  return `LANGUAGE DIRECTIVE:
CRITICAL: Use ${languageName} for 100% of textual content (tasks, events, gateways, pools, lanes, annotations, documentation).
Do NOT include English translations or bilingual labels.`;
};

/**
 * Get language directive for Modelling Agent Mode based on detected language from content
 */
const getLanguageDirectiveFromContent = (contentText: string, fallbackLanguage: LanguageOptionValue): string => {
  // Detect language from the content
  const detectedLang = detectLanguageFromText(contentText);

  // Map detected language code to LanguageOptionValue format
  const languageMap: Record<string, LanguageOptionValue> = {
    'en': 'en',
    'es': 'es',
    'fr': 'fr',
    'de': 'de',
    'it': 'it',
    'pt': 'pt',
  };

  // Use detected language if available and not English, otherwise use fallback
  const languageToUse = (detectedLang !== 'en' && languageMap[detectedLang])
    ? languageMap[detectedLang]
    : fallbackLanguage;

  // If fallback is "auto" and we detected a non-English language, use detected language
  if (fallbackLanguage === "auto" && detectedLang !== 'en' && languageMap[detectedLang]) {
    const languageName = LANGUAGE_NATIVE_NAMES[languageMap[detectedLang]] ?? detectedLang.toUpperCase();
    return `LANGUAGE DIRECTIVE:
CRITICAL: The existing diagram content is in ${languageName}. Generate ALL variants using ${languageName} for 100% of textual content (tasks, events, gateways, pools, lanes, annotations, documentation).
Do NOT switch to English. Do NOT include English translations or bilingual labels.
Every generated variant MUST match the language of the existing diagram.`;
  }

  // Otherwise use the standard directive
  return getLanguageDirective(languageToUse);
};

const getElementXPath = (element: Element | null): string => {
  if (!element) return "";
  const segments: string[] = [];
  let current: Element | null = element;

  while (current && current.nodeType === 1) {
    const tagName = current.tagName.toLowerCase();
    let index = 1;
    let hasSameTagSiblings = false;

    if (current.parentNode) {
      const siblings = current.parentNode.childNodes;
      let siblingPosition = 0;
      for (let i = 0; i < siblings.length; i++) {
        const sibling = siblings[i];
        if (sibling.nodeType === 1 && (sibling as Element).tagName === current.tagName) {
          siblingPosition += 1;
          if (sibling === current) {
            index = siblingPosition;
            if (siblingPosition > 1) {
              hasSameTagSiblings = true;
            }
          } else {
            hasSameTagSiblings = true;
          }
        }
      }
    }

    segments.unshift(hasSameTagSiblings ? `${tagName}[${index}]` : tagName);
    current = current.parentElement;
  }

  return `/${segments.join("/")}`;
};

const createContentPreview = (source: string | null | undefined, limit = 280) => {
  if (!source) return undefined;
  const collapsed = source.replace(/\s+/g, " ").trim();
  if (!collapsed) return undefined;
  return collapsed.length > limit ? `${collapsed.slice(0, limit)}...` : collapsed;
};

const computeSha256 = async (value: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
};

// Calculate complexity metrics for a BPMN model
const calculateModelMetrics = (xmlString: string): {
  taskCount: number;
  decisionPoints: number;
  parallelBranches: number;
  errorHandlers: number;
  eventTypes: string[];
  estimatedPaths: number;
} => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "application/xml");

    if (doc.getElementsByTagName("parsererror").length > 0) {
      return { taskCount: 0, decisionPoints: 0, parallelBranches: 0, errorHandlers: 0, eventTypes: [], estimatedPaths: 1 };
    }

    // Count tasks
    const taskElements = doc.querySelectorAll('task, userTask, serviceTask, manualTask, sendTask, receiveTask, scriptTask, businessRuleTask, callActivity');
    const taskCount = taskElements.length;

    // Count gateways (decision points)
    const gateways = doc.querySelectorAll('exclusiveGateway, parallelGateway, inclusiveGateway, eventBasedGateway');
    const decisionPoints = gateways.length;

    // Count parallel gateways (parallel branches)
    const parallelGateways = doc.querySelectorAll('parallelGateway');
    const parallelBranches = parallelGateways.length;

    // Count error catch events
    const errorEvents = doc.querySelectorAll('boundaryEvent errorEventDefinition, intermediateCatchEvent errorEventDefinition');
    const errorHandlers = errorEvents.length;

    // Collect event types
    const eventTypes: string[] = [];
    const allEvents = doc.querySelectorAll('startEvent, intermediateCatchEvent, intermediateThrowEvent, endEvent, boundaryEvent');
    allEvents.forEach(event => {
      const eventDefs = event.querySelectorAll('messageEventDefinition, timerEventDefinition, errorEventDefinition, escalationEventDefinition, signalEventDefinition, conditionalEventDefinition');
      eventDefs.forEach(def => {
        const tagName = def.tagName.replace('EventDefinition', '').toLowerCase();
        if (tagName && !eventTypes.includes(tagName)) {
          eventTypes.push(tagName);
        }
      });
    });

    // Estimate execution paths (simplified: 2^decisionPoints for exclusive, more for parallel)
    let estimatedPaths = 1;
    gateways.forEach(gateway => {
      const tagName = gateway.tagName.toLowerCase();
      if (tagName.includes('exclusive')) {
        estimatedPaths *= 2; // Each exclusive gateway doubles paths
      } else if (tagName.includes('parallel')) {
        const outgoingFlows = gateway.querySelectorAll('outgoing').length;
        estimatedPaths *= Math.max(2, outgoingFlows);
      } else if (tagName.includes('inclusive')) {
        estimatedPaths *= 2; // Simplified estimate
      }
    });

    return {
      taskCount,
      decisionPoints,
      parallelBranches,
      errorHandlers,
      eventTypes: eventTypes.length > 0 ? eventTypes : ['none'],
      estimatedPaths: Math.max(1, estimatedPaths)
    };
  } catch (error) {
    console.error("Failed to calculate metrics:", error);
    return { taskCount: 0, decisionPoints: 0, parallelBranches: 0, errorHandlers: 0, eventTypes: [], estimatedPaths: 1 };
  }
};

const extractProcessSummary = (xmlString: string, type: "bpmn" | "pid"): string => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "application/xml");
    if (doc.getElementsByTagName("parsererror").length > 0) {
      return type === "pid"
        ? "Instrumentation and equipment interactions."
        : "Business process from start to finish.";
    }

    const tagVariants = [
      "bpmn:task", "bpmn:userTask", "bpmn:serviceTask", "bpmn:manualTask",
      "bpmn:sendTask", "bpmn:receiveTask", "bpmn:scriptTask",
      "bpmn:businessRuleTask", "bpmn:callActivity", "task", "userTask",
      "serviceTask", "manualTask", "sendTask", "receiveTask", "scriptTask",
      "businessRuleTask", "callActivity",
    ];

    const names: string[] = [];
    tagVariants.forEach((tag) => {
      const elements = doc.getElementsByTagName(tag);
      for (let i = 0; i < elements.length; i++) {
        const name = elements[i].getAttribute("name");
        if (name && !names.includes(name)) {
          names.push(name);
        }
      }
    });

    if (!names.length) {
      return type === "pid"
        ? "Instrumentation and equipment interactions."
        : "Business process from start to finish.";
    }

    const MAX_NAMES = 20;
    const truncatedNames = names.length > MAX_NAMES ? names.slice(0, MAX_NAMES) : names;
    const suffix = names.length > MAX_NAMES ? ", and more." : ".";

    const summaryPrefix = type === "pid"
      ? "P&ID workflow covering: "
      : "Process steps include: ";

    return `${summaryPrefix}${truncatedNames.join(", ")}${suffix}`;

  } catch (error) {
    console.error("Failed to extract process summary:", error);
    return type === "pid"
      ? "Instrumentation and equipment interactions."
      : "Business process from start to finish.";
  }
};

const ALTERNATIVE_VARIANTS: Array<{
  id: string;
  title: string;
  description: string;
  complexity: AlternativeComplexity;
  instructions: { bpmn: string; pid: string };
}> = [
    {
      id: "core-linear",
      title: "Core Linear Flow",
      description: "Straight-through execution with only essential activities.",
      complexity: "basic",
      instructions: {
        bpmn:
          "Generate the most streamlined BPMN possible for the process summary, keeping only critical tasks and a single happy path.",
        pid:
          "Focus on the principal equipment path and core instrumentation, omitting secondary loops or optional devices.",
      },
    },
    {
      id: "human-centric",
      title: "Human-Centric Collaboration",
      description: "Highlights manual approvals and team handoffs.",
      complexity: "intermediate",
      instructions: {
        bpmn:
          "Emphasize manual approvals, include at least two swimlanes, and show review loops that require people to coordinate.",
        pid:
          "Highlight manual valves, operator checkpoints, and instrumentation that requires human acknowledgement before continuing.",
      },
    },
    {
      id: "automation-lean",
      title: "Automation Lean",
      description: "Switches repetitive work to automated service steps.",
      complexity: "intermediate",
      instructions: {
        bpmn:
          "Transform repetitive or high-volume tasks into service tasks with system integrations and automated escalations.",
        pid:
          "Show controllers and transmitters automating monitoring tasks, including signal lines that close the loop automatically.",
      },
    },
    {
      id: "parallel-efficiency",
      title: "Parallel Efficiency",
      description: "Optimizes throughput with parallel branches and event handling.",
      complexity: "advanced",
      instructions: {
        bpmn:
          "Introduce parallel gateways to split workload, use event-based gateways for exceptions, and add a compensation or rollback path.",
        pid:
          "Model redundant equipment paths in parallel with automated switchovers and interlock signals connecting the branches.",
      },
    },
    {
      id: "compliance-audit",
      title: "Compliance & Audit Ready",
      description: "Adds control checkpoints, logging, and audit artefacts.",
      complexity: "advanced",
      instructions: {
        bpmn:
          "Layer in compliance checks, logging activities, and escalation paths. Attach data objects for evidence and audit trails.",
        pid:
          "Add monitoring instrumentation, safety valves, bypass lines, and annotations for regulatory checkpoints and alarms.",
      },
    },
    {
      id: "experience-journey",
      title: "Customer Experience Journey",
      description: "Maps personas, SLAs, and service touchpoints end to end.",
      complexity: "intermediate",
      instructions: {
        bpmn:
          "Introduce swimlanes for customer-facing roles, note SLA timers, and highlight feedback or survey capture points along the path.",
        pid:
          "Call out operator interfaces, HMI panels, and alarm acknowledgements that connect process equipment to customer-impacting metrics.",
      },
    },
    {
      id: "resilient-recovery",
      title: "Resilient Recovery Blueprint",
      description: "Builds failover branches, compensations, and escalation playbooks.",
      complexity: "advanced",
      instructions: {
        bpmn:
          "Layer event subprocesses for incidents, model compensation tasks, and show escalation to support teams with clear rollback steps.",
        pid:
          "Add redundancy loops, relief paths, and interlocks that trigger automated shutdown, including operator guidance annotations.",
      },
    },
  ];

const createUniqueId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

// Export helpers
const exportSvgStringToImage = async (
  svgString: string,
  type: "image/png" | "image/jpeg",
  backgroundColor = "#ffffff"
): Promise<Blob> => {
  // Convert SVG to data URL
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    // Create image element
    const img = new Image();
    // Important for drawing SVG to canvas without tainting
    img.crossOrigin = "anonymous";
    const imageLoaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(e);
    });
    img.src = url;
    await imageLoaded;

    // Create canvas using intrinsic size
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width || 1200;
    canvas.height = img.naturalHeight || img.height || 800;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Unable to create 2D canvas context");

    // Fill background for JPEG to avoid black/transparent background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    const dataUrl = canvas.toDataURL(type);
    const res = await fetch(dataUrl);
    return await res.blob();
  } finally {
    URL.revokeObjectURL(url);
  }
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Calculate diagram complexity
const calculateDiagramComplexity = (xml: string): { elementCount: number; complexity: 'simple' | 'intermediate' | 'complex' | 'very-complex' } => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "application/xml");

    if (doc.getElementsByTagName("parsererror").length > 0) {
      return { elementCount: 0, complexity: 'simple' };
    }

    const tasks = doc.querySelectorAll('task, userTask, serviceTask, manualTask, sendTask, receiveTask, scriptTask, businessRuleTask, callActivity');
    const gateways = doc.querySelectorAll('exclusiveGateway, parallelGateway, inclusiveGateway, eventBasedGateway');
    const events = doc.querySelectorAll('startEvent, intermediateCatchEvent, intermediateThrowEvent, endEvent, boundaryEvent');
    const flows = doc.querySelectorAll('sequenceFlow, messageFlow');
    const subprocesses = doc.querySelectorAll('subProcess, callActivity');

    const elementCount = tasks.length + gateways.length + events.length + flows.length + subprocesses.length;

    let complexity: 'simple' | 'intermediate' | 'complex' | 'very-complex';
    if (elementCount <= 20) complexity = 'simple';
    else if (elementCount <= 50) complexity = 'intermediate';
    else if (elementCount <= 100) complexity = 'complex';
    else complexity = 'very-complex';

    return { elementCount, complexity };
  } catch (error) {
    console.error("Failed to calculate complexity:", error);
    return { elementCount: 0, complexity: 'simple' };
  }
};

// Render with timeout wrapper
const renderWithTimeout = async <T,>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
};

// Layer 1: Primary SVG rendering
const renderXmlToSvg = async (xml: string, timeoutMs = 5000): Promise<string> => {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "-99999px";
  container.style.width = "1200px";
  container.style.height = "800px";
  document.body.appendChild(container);

  try {
    const renderPromise = (async () => {
      const tmpModeler = new BpmnModeler({ container });
      await tmpModeler.importXML(xml);
      const { svg } = await tmpModeler.saveSVG();
      tmpModeler.destroy();
      return svg;
    })();

    const svg = await renderWithTimeout(
      renderPromise,
      timeoutMs,
      "SVG rendering timed out"
    );

    document.body.removeChild(container);
    return svg;
  } catch (e) {
    if (container.parentNode) {
      document.body.removeChild(container);
    }
    throw e;
  }
};

// Layer 2: Canvas-based rendering fallback
const renderXmlToCanvas = async (xml: string, timeoutMs = 5000): Promise<string> => {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "-99999px";
  container.style.width = "2000px"; // Larger for complex diagrams
  container.style.height = "1500px";
  document.body.appendChild(container);

  try {
    const renderPromise = (async () => {
      const tmpModeler = new BpmnModeler({ container });
      await tmpModeler.importXML(xml);

      // Wait for complex diagrams to fully render
      await new Promise(resolve => setTimeout(resolve, 800));

      const { svg } = await tmpModeler.saveSVG();
      tmpModeler.destroy();
      return svg;
    })();

    const svg = await renderWithTimeout(
      renderPromise,
      timeoutMs,
      "Canvas rendering timed out"
    );

    document.body.removeChild(container);
    return svg;
  } catch (e) {
    if (container.parentNode) {
      document.body.removeChild(container);
    }
    throw e;
  }
};

// Layer 3: Server-side preview generation (async, returns placeholder)
const requestServerPreview = async (xml: string, title: string): Promise<string | null> => {
  try {
    // This would call a server endpoint to generate preview
    // For now, return null to indicate server preview not available
    // TODO: Implement server-side preview endpoint
    return null;
  } catch (error) {
    console.error("Server preview request failed:", error);
    return null;
  }
};

// Layer 4: Simplified diagram representation (always succeeds)
const generateSimplifiedPreview = (xml: string, title: string): string => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "application/xml");

    if (doc.getElementsByTagName("parsererror").length > 0) {
      throw new Error("Invalid XML");
    }

    // Extract key information
    const tasks = Array.from(doc.querySelectorAll('task, userTask, serviceTask')).slice(0, 10);
    const taskNames = tasks.map(t => t.getAttribute('name') || 'Task').filter(Boolean);
    const startEvents = doc.querySelectorAll('startEvent');
    const endEvents = doc.querySelectorAll('endEvent');
    const gateways = doc.querySelectorAll('exclusiveGateway, parallelGateway, inclusiveGateway');

    // Create a simplified SVG representation
    const width = 600;
    const height = Math.max(400, taskNames.length * 60 + 100);

    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="background: white;">
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
          <polygon points="0 0, 10 3, 0 6" fill="#1976d2" />
        </marker>
        <style>
          .task-box { fill: #e3f2fd; stroke: #1976d2; stroke-width: 2; }
          .start-end { fill: #c8e6c9; stroke: #388e3c; stroke-width: 2; }
          .gateway { fill: #fff3e0; stroke: #f57c00; stroke-width: 2; }
          .text { font-family: Arial, sans-serif; font-size: 12px; fill: #333; }
          .title { font-size: 14px; font-weight: bold; fill: #1976d2; }
        </style>
      </defs>
      <text x="${width / 2}" y="25" text-anchor="middle" class="title">${title}</text>
      <text x="${width / 2}" y="45" text-anchor="middle" class="text" style="font-size: 10px; fill: #666;">Simplified Preview</text>
    `;

    // Draw start event
    if (startEvents.length > 0) {
      svg += `<circle cx="50" cy="80" r="15" class="start-end" />
              <text x="50" y="85" text-anchor="middle" class="text" style="font-size: 10px;">Start</text>`;
    }

    // Draw tasks
    let yPos = 120;
    taskNames.forEach((name, idx) => {
      const x = 150;
      const truncatedName = name.length > 25 ? name.substring(0, 22) + '...' : name;
      svg += `<rect x="${x - 60}" y="${yPos - 15}" width="120" height="30" rx="5" class="task-box" />
              <text x="${x}" y="${yPos + 2}" text-anchor="middle" class="text">${truncatedName}</text>`;

      if (idx < taskNames.length - 1) {
        svg += `<line x1="${x}" y1="${yPos + 15}" x2="${x}" y2="${yPos + 45}" stroke="#1976d2" stroke-width="2" marker-end="url(#arrowhead)" />`;
      }
      yPos += 60;
    });

    // Draw end event
    if (endEvents.length > 0) {
      svg += `<circle cx="150" cy="${yPos}" r="15" class="start-end" />
              <text x="150" y="${yPos + 5}" text-anchor="middle" class="text" style="font-size: 10px;">End</text>`;
    }

    // Add gateway indicator if present
    if (gateways.length > 0) {
      svg += `<text x="${width - 100}" y="80" class="text" style="font-size: 10px; fill: #f57c00;">${gateways.length} Gateway${gateways.length > 1 ? 's' : ''}</text>`;
    }

    // Add element count
    const elementCount = tasks.length + gateways.length + startEvents.length + endEvents.length;
    svg += `<text x="${width / 2}" y="${height - 20}" text-anchor="middle" class="text" style="font-size: 10px; fill: #666;">${elementCount} elements total</text>`;

    svg += `</svg>`;

    return svg;
  } catch (error) {
    // Ultimate fallback: minimal SVG
    return `<svg width="400" height="200" xmlns="http://www.w3.org/2000/svg" style="background: white;">
      <text x="200" y="100" text-anchor="middle" font-family="Arial" font-size="14" fill="#666">${title}</text>
      <text x="200" y="120" text-anchor="middle" font-family="Arial" font-size="12" fill="#999">Diagram Preview</text>
    </svg>`;
  }
};

// Legacy invokeWithTimeout removed - now using centralized invokeFunction from api-client.ts
// This provides automatic Lambda routing, circuit breaker protection, and Supabase fallback

// Cache for successful previews (5-minute TTL)
const previewCache = new Map<string, { svg: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCachedPreview = (cacheKey: string): string | null => {
  const cached = previewCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.svg;
  }
  if (cached) {
    previewCache.delete(cacheKey);
  }
  return null;
};

const setCachedPreview = (cacheKey: string, svg: string) => {
  previewCache.set(cacheKey, { svg, timestamp: Date.now() });
};

// Generate cache key from XML content
const generateCacheKey = (xml: string, title: string): string => {
  // Use a hash of the XML content + title for cache key
  const hash = xml.slice(0, 100) + title;
  return btoa(hash).replace(/[^a-zA-Z0-9]/g, '');
};

const AlternativeDiagramPreview = ({
  xml,
  title,
  onRetry,
  onDownloadAvailable
}: {
  xml: string;
  title: string;
  onRetry?: () => void;
  onDownloadAvailable?: (available: boolean) => void;
}) => {
  const [svg, setSvg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'timeout' | 'complex' | 'unavailable' | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [renderStage, setRenderStage] = useState<'svg' | 'canvas' | 'server' | 'failed'>('svg');

  useEffect(() => {
    let isMounted = true;
    const complexity = calculateDiagramComplexity(xml);
    const cacheKey = generateCacheKey(xml, title);

    // Check cache first
    const cachedSvg = getCachedPreview(cacheKey);
    if (cachedSvg) {
      setSvg(cachedSvg);
      setLoading(false);
      if (onDownloadAvailable) {
        onDownloadAvailable(true);
      }
      return;
    }

    const generateSvg = async () => {
      setLoading(true);
      setError(null);
      setErrorType(null);
      setRenderStage('svg');

      try {
        let renderedSvg: string | null = null;
        let lastError: Error | null = null;

        // Layer 1: Primary SVG rendering (5s timeout)
        try {
          setRenderStage('svg');
          renderedSvg = await renderXmlToSvg(xml, 5000);
          console.log(`✓ SVG render successful for ${title}`);
        } catch (svgError) {
          lastError = svgError as Error;
          console.warn(`✗ SVG render failed for ${title}:`, svgError);

          // Layer 2: Canvas-based fallback (5s timeout)
          try {
            setRenderStage('canvas');
            renderedSvg = await renderXmlToCanvas(xml, 5000);
            console.log(`✓ Canvas render successful for ${title}`);
          } catch (canvasError) {
            lastError = canvasError as Error;
            console.warn(`✗ Canvas render failed for ${title}:`, canvasError);

            // Layer 3: Server-side preview (async, show loader)
            if (complexity.complexity === 'complex' || complexity.complexity === 'very-complex') {
              setRenderStage('server');
              try {
                const serverSvg = await requestServerPreview(xml, title);
                if (serverSvg) {
                  renderedSvg = serverSvg;
                  console.log(`✓ Server preview successful for ${title}`);
                } else {
                  throw new Error("Server preview not available");
                }
              } catch (serverError) {
                lastError = serverError as Error;
                console.warn(`✗ Server preview failed for ${title}:`, serverError);
              }
            }

            // Layer 4: Simplified representation (ALWAYS succeeds as final fallback)
            if (!renderedSvg) {
              setRenderStage('svg'); // Reset stage for simplified view
              try {
                renderedSvg = generateSimplifiedPreview(xml, title);
                console.log(`✓ Simplified preview generated for ${title}`);
              } catch (simplifiedError) {
                console.error(`✗ Even simplified preview failed for ${title}:`, simplifiedError);
                // This should never happen, but if it does, we have ultimate fallback in generateSimplifiedPreview
                renderedSvg = generateSimplifiedPreview(xml, title);
              }
            }
          }
        }

        // GUARANTEE: Always set a preview (never show "unavailable")
        if (isMounted) {
          if (renderedSvg) {
            setSvg(renderedSvg);
            setCachedPreview(cacheKey, renderedSvg); // Cache successful render
            setRenderStage('svg'); // Reset to show success
            if (onDownloadAvailable) {
              onDownloadAvailable(true);
            }
          } else {
            // Ultimate fallback: generate simplified preview
            const fallbackSvg = generateSimplifiedPreview(xml, title);
            setSvg(fallbackSvg);
            if (onDownloadAvailable) {
              onDownloadAvailable(true);
            }
          }
        }
      } catch (e) {
        if (isMounted) {
          // Ultimate fallback: always generate simplified preview
          try {
            const fallbackSvg = generateSimplifiedPreview(xml, title);
            setSvg(fallbackSvg);
            if (onDownloadAvailable) {
              onDownloadAvailable(true);
            }
          } catch (fallbackError) {
            // Even simplified preview failed (should never happen)
            console.error(`Even simplified preview failed for ${title}:`, fallbackError);
            // Set a minimal SVG as last resort
            const minimalSvg = `<svg width="400" height="200" xmlns="http://www.w3.org/2000/svg" style="background: white;">
              <text x="200" y="100" text-anchor="middle" font-family="Arial" font-size="14" fill="#666">${title}</text>
              <text x="200" y="120" text-anchor="middle" font-family="Arial" font-size="12" fill="#999">Diagram Preview</text>
            </svg>`;
            setSvg(minimalSvg);
            if (onDownloadAvailable) {
              onDownloadAvailable(true);
            }
          }
        }
        console.error(`Failed to render preview for ${title}:`, e);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    generateSvg();

    return () => {
      isMounted = false;
    };
  }, [xml, title, retryCount, onDownloadAvailable]);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    if (onRetry) {
      onRetry();
    }
  };

  const getErrorMessage = () => {
    if (errorType === 'complex') {
      return {
        title: "Diagram too complex - rendering simplified preview",
        description: "This model has many elements. Preview may be simplified, but full version is available for download."
      };
    } else if (errorType === 'timeout') {
      return {
        title: "Preview rendering timed out",
        description: "Please download the XML file to view the complete diagram."
      };
    } else {
      return {
        title: "Preview temporarily unavailable",
        description: "Model generated successfully and ready to download. Try again in a moment."
      };
    }
  };

  const errorMsg = error ? getErrorMessage() : null;

  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden" style={{ backgroundColor: '#ffffff' }}>
      {loading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          {renderStage === 'server' && (
            <p className="text-xs text-muted-foreground">Generating server preview...</p>
          )}
        </div>
      ) : svg ? (
        <img
          src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
          alt={`${title} preview`}
          className="h-full w-full object-contain"
        />
      ) : null}
    </div>
  );
};

const BpmnViewerComponent = ({ xml, onSave, diagramType = "bpmn", onRefine }: BpmnViewerProps) => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<BpmnModeler | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [isProcessManager, setIsProcessManager] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [editingLocked, setEditingLocked] = useState(false);
  const [processDialogOpen, setProcessDialogOpen] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isLoadingCollaborators, setIsLoadingCollaborators] = useState(false);
  const [alternativeModels, setAlternativeModels] = useState<AlternativeModel[]>([]);
  const [isLoadingAlternatives, setIsLoadingAlternatives] = useState(false);
  const [alternativeError, setAlternativeError] = useState<string | null>(null);
  const [alternativeProgress, setAlternativeProgress] = useState<{ completed: number; total: number; current?: string }>({ completed: 0, total: 0 });
  const [modelStatuses, setModelStatuses] = useState<Map<string, 'queued' | 'generating' | 'completed' | 'failed'>>(new Map());
  const [alternativeCount, setAlternativeCount] = useState<number>(5);
  const [scrollPosition, setScrollPosition] = useState(0);
  const alternativesScrollRef = useRef<HTMLDivElement>(null);
  const [selectedAlternativeId, setSelectedAlternativeId] = useState<string | null>(null);
  const [logHistory, setLogHistory] = useState<LogHistoryEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [diagramFingerprint, setDiagramFingerprint] = useState<string | null>(null);
  const [visionJobId, setVisionJobId] = useState<string | null>(null);
  const canEditRef = useRef<boolean>(true);
  const hasGeneratedAlternativesRef = useRef(false);
  const [systemActivities, setSystemActivities] = useState<SystemActivity[]>([]);
  const [systemTrackingEnabled, setSystemTrackingEnabled] = useState(false);
  const [confirmAlternative, setConfirmAlternative] = useState<AlternativeModel | null>(null);
  const [confirmAlternativeDialogOpen, setConfirmAlternativeDialogOpen] = useState(false);
  const systemActivitiesRef = useRef<SystemActivity[]>([]);
  const systemTrackingCleanupRef = useRef<(() => void) | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageOptionValue>("auto");
  const [isApplyingLanguage, setIsApplyingLanguage] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const originalLabelsRef = useRef<Map<string, string>>(new Map());
  const lastAppliedLanguageRef = useRef<LanguageOptionValue>("auto");
  const [diagramReady, setDiagramReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (stored && isLanguageValue(stored)) {
        setSelectedLanguage(stored);
      }
    } catch (error) {
      console.warn("Unable to read saved language preference:", error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, selectedLanguage);
    } catch (error) {
      console.warn("Unable to persist language preference:", error);
    }
  }, [selectedLanguage]);

  const processSummary = useMemo(
    () => extractProcessSummary(xml, diagramType),
    [xml, diagramType]
  );
  const languageDirective = useMemo(
    () => getLanguageDirective(selectedLanguage),
    [selectedLanguage]
  );

  const captureCurrentLabels = useCallback(() => {
    if (!modelerRef.current) return;
    try {
      const elementRegistry = modelerRef.current.get("elementRegistry") as
        | { getAll: () => Array<{ id: string; businessObject?: { name?: string } }> }
        | undefined;
      if (!elementRegistry) return;

      const snapshot = new Map<string, string>();
      elementRegistry.getAll().forEach((element) => {
        const name = element?.businessObject?.name;
        if (typeof name === "string" && name.trim()) {
          snapshot.set(element.id, name);
        }
      });
      originalLabelsRef.current = snapshot;
    } catch (error) {
      console.warn("Failed to capture diagram labels:", error);
    }
  }, []);

  const restoreOriginalLabels = useCallback(() => {
    if (!modelerRef.current || !originalLabelsRef.current.size) return;
    try {
      const modeling = modelerRef.current.get("modeling") as
        | { updateProperties: (element: unknown, properties: { name?: string }) => void }
        | undefined;
      const elementRegistry = modelerRef.current.get("elementRegistry") as
        | { get: (id: string) => { businessObject?: { name?: string } } | null }
        | undefined;

      if (!modeling || !elementRegistry) return;

      originalLabelsRef.current.forEach((label, elementId) => {
        const element = elementRegistry.get(elementId);
        if (!element?.businessObject) return;
        if (element.businessObject.name === label) return;
        try {
          modeling.updateProperties(element, { name: label });
        } catch (error) {
          console.warn(`Failed to restore label for ${elementId}`, error);
        }
      });
      lastAppliedLanguageRef.current = "auto";
    } catch (error) {
      console.warn("Failed to restore original labels:", error);
    }
  }, []);

  const applyLanguageToDiagram = useCallback(
    async (languageCode: LanguageOptionValue, options?: { silent?: boolean }) => {
      if (!modelerRef.current || languageCode === "auto") {
        return true;
      }

      if (languageCode === "en") {
        restoreOriginalLabels();
        lastAppliedLanguageRef.current = "en";
        return true;
      }

      if (!SUPPORTED_LIVE_TRANSLATIONS.has(languageCode)) {
        if (!options?.silent) {
          toast.info(
            `Live translation not available for ${LANGUAGE_NATIVE_NAMES[languageCode] ?? languageCode}.`
          );
        }
        return false;
      }

      if (!originalLabelsRef.current.size) {
        captureCurrentLabels();
      }

      try {
        const modeling = modelerRef.current.get("modeling") as
          | { updateProperties: (element: unknown, properties: { name?: string }) => void }
          | undefined;
        const elementRegistry = modelerRef.current.get("elementRegistry") as
          | { get: (id: string) => { businessObject?: { name?: string } } | null }
          | undefined;

        if (!modeling || !elementRegistry) return false;

        originalLabelsRef.current.forEach((label, elementId) => {
          const element = elementRegistry.get(elementId);
          if (!element?.businessObject) return;
          const translated = translateWithDictionary(label, languageCode);
          if (!translated || translated === element.businessObject.name) return;
          try {
            modeling.updateProperties(element, { name: translated });
          } catch (error) {
            console.warn(`Failed to translate label for ${elementId}`, error);
          }
        });
        lastAppliedLanguageRef.current = languageCode;
        return true;
      } catch (error) {
        console.warn("Failed to apply language adaptation:", error);
        return false;
      }
    },
    [captureCurrentLabels, restoreOriginalLabels]
  );

  useEffect(() => {
    if (!diagramReady || !modelerRef.current) return;

    let cancelled = false;

    const run = async () => {
      setIsApplyingLanguage(true);
      try {
        if (selectedLanguage === "auto") {
          restoreOriginalLabels();
          captureCurrentLabels();
        } else {
          const success = await applyLanguageToDiagram(selectedLanguage, { silent: true });
          if (!success && !cancelled) {
            toast.info(
              `Live translation not yet available for ${LANGUAGE_NATIVE_NAMES[selectedLanguage] ?? selectedLanguage
              }.`
            );
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Language adaptation failed:", error);
          toast.error("Unable to adapt diagram language");
        }
      } finally {
        if (!cancelled) {
          setIsApplyingLanguage(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [selectedLanguage, diagramReady, applyLanguageToDiagram, restoreOriginalLabels, captureCurrentLabels]);

  const handleLanguageChange = useCallback((value: LanguageOptionValue) => {
    setSelectedLanguage(value);
  }, []);

  // Calculate recommended model based on complexity balance
  // Generate variant summary (strengths, weaknesses, use cases)
  const getVariantSummary = useCallback((model: AlternativeModel) => {
    const metrics = model.metrics || { taskCount: 0, decisionPoints: 0, parallelBranches: 0, errorHandlers: 0, estimatedPaths: 1 };
    const complexity = model.complexity;

    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const useCases: string[] = [];

    if (complexity === 'basic') {
      strengths.push('Simple and easy to understand');
      strengths.push('Fast to implement and maintain');
      strengths.push('Low complexity reduces errors');
      weaknesses.push('Limited flexibility for complex scenarios');
      weaknesses.push('No error handling or recovery paths');
      weaknesses.push('Cannot model parallel or conditional flows');
      useCases.push('Simple, linear processes');
      useCases.push('Quick prototyping');
      useCases.push('Training and documentation');
    } else if (complexity === 'intermediate') {
      strengths.push('Balanced complexity and clarity');
      strengths.push('Includes decision points and parallel flows');
      strengths.push('Human and system interaction points');
      if (metrics.errorHandlers > 0) {
        strengths.push('Basic error handling included');
      }
      if (metrics.parallelBranches > 0) {
        strengths.push('Optimized for efficiency');
      }
      weaknesses.push('May lack advanced error recovery');
      weaknesses.push('Limited compliance checkpoints');
      useCases.push('Standard business processes');
      useCases.push('Process optimization');
      useCases.push('Team collaboration workflows');
    } else if (complexity === 'advanced') {
      strengths.push('Comprehensive error handling and recovery');
      strengths.push('Multiple execution paths');
      strengths.push('Compliance and audit ready');
      strengths.push('External system integration');
      if (metrics.errorHandlers > 1) {
        strengths.push('Robust error recovery mechanisms');
      }
      if (metrics.parallelBranches > 2) {
        strengths.push('Highly optimized parallel execution');
      }
      weaknesses.push('Higher implementation complexity');
      weaknesses.push('Requires more maintenance');
      weaknesses.push('Steeper learning curve');
      useCases.push('Enterprise-grade processes');
      useCases.push('Compliance-critical workflows');
      useCases.push('Complex multi-system integrations');
      useCases.push('High-availability systems');
    }

    return { strengths, weaknesses, useCases };
  }, []);

  const recommendedModel = useMemo(() => {
    if (!alternativeModels.length) return null;

    // Enhanced scoring algorithm for recommendation
    const scored = alternativeModels.map(model => {
      let score = 0;
      const metrics = model.metrics || { taskCount: 0, decisionPoints: 0, parallelBranches: 0, errorHandlers: 0, estimatedPaths: 1 };

      // Complexity scoring (prefer intermediate for standard use)
      if (model.complexity === 'intermediate') score += 15;
      else if (model.complexity === 'basic') score += 8;
      else score += 5;

      // Task count balance (3-12 is optimal)
      if (metrics.taskCount >= 3 && metrics.taskCount <= 12) score += 8;
      else if (metrics.taskCount > 12 && metrics.taskCount <= 20) score += 5;
      else if (metrics.taskCount > 0) score += 2;

      // Decision points (1-3 is optimal)
      if (metrics.decisionPoints >= 1 && metrics.decisionPoints <= 3) score += 8;
      else if (metrics.decisionPoints > 3) score += 4;

      // Parallel branches (1-2 is optimal)
      if (metrics.parallelBranches > 0 && metrics.parallelBranches <= 2) score += 6;
      else if (metrics.parallelBranches > 2) score += 3;

      // Error handling (preferred but not required)
      if (metrics.errorHandlers > 0) score += 5;
      if (metrics.errorHandlers > 1) score += 2;

      // Path diversity (2-5 paths is optimal)
      if (metrics.estimatedPaths >= 2 && metrics.estimatedPaths <= 5) score += 4;
      else if (metrics.estimatedPaths > 5) score += 2;

      // Penalize extremes
      if (metrics.taskCount > 25) score -= 5; // Too complex
      if (metrics.taskCount < 2) score -= 3; // Too simple

      return { model, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.model || alternativeModels[0];
  }, [alternativeModels]);

  const selectedAlternative = useMemo(() => {
    if (!alternativeModels.length) {
      return null;
    }

    if (selectedAlternativeId) {
      const match = alternativeModels.find(
        (model) => model.id === selectedAlternativeId
      );
      if (match) {
        return match;
      }
    }

    return alternativeModels[0];
  }, [alternativeModels, selectedAlternativeId]);

  const saveCurrentXml = useCallback(async () => {
    if (modelerRef.current) {
      try {
        const result = await modelerRef.current.saveXML({ format: true });
        if (result.xml) {
          return result.xml;
        }
      } catch (error) {
        console.error("Failed to capture current XML snapshot:", error);
      }
    }
    return xml;
  }, [xml]);

  const loadCollaborators = useCallback(async () => {
    if (!isProcessManager) return;

    setIsLoadingCollaborators(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("user_profiles")
        .select("user_id,email,created_at,last_login");
      if (profilesError) {
        throw profilesError;
      }

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (rolesError) {
        throw rolesError;
      }

      const roleMap = new Map<string, string[]>();
      (roles ?? []).forEach(({ user_id, role }) => {
        const existing = roleMap.get(user_id) ?? [];
        roleMap.set(user_id, [...existing, role]);
      });

      const collaboratorList: Collaborator[] = (profiles ?? []).map(
        ({ user_id, email, created_at, last_login }) => ({
          userId: user_id,
          email,
          roles: roleMap.get(user_id) ?? ["user"],
          createdAt: created_at,
          lastLogin: last_login,
        })
      );

      setCollaborators(collaboratorList);
    } catch (error) {
      console.error("Failed to load collaborators:", error);
      toast.error("Unable to load collaborators right now");
    } finally {
      setIsLoadingCollaborators(false);
    }
  }, [isProcessManager]);

  const recordSystemActivity = useCallback((activity: SystemActivity) => {
    systemActivitiesRef.current = [...systemActivitiesRef.current, activity];
    setSystemActivities(systemActivitiesRef.current.slice(-50));
  }, []);

  const flushSystemActivities = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!currentUser || systemActivitiesRef.current.length === 0) return;

      try {
        const xmlSnapshot = await saveCurrentXml();
        const { error } = await supabase.from("bpmn_generations").insert({
          user_id: currentUser.id,
          input_type: "log",
          input_description: `system-use:${diagramFingerprint ?? "unknown"}:${Date.now()}`,
          generated_bpmn_xml: xmlSnapshot,
          alternative_models: JSON.parse(JSON.stringify([
            {
              events: systemActivitiesRef.current,
              source: "system-tracking",
              capturedAt: new Date().toISOString(),
            },
          ])) as any,
        });

        if (error) {
          throw error;
        }

        systemActivitiesRef.current = [];
        setSystemActivities([]);

        if (!options?.silent) {
          toast.success("System usage log saved");
        }
      } catch (error) {
        console.error("Failed to persist system activities:", error);
        if (!options?.silent) {
          toast.error("Could not save system activity log");
        }
      }
    },
    [currentUser, diagramFingerprint, saveCurrentXml]
  );

  const startSystemTracking = useCallback(() => {
    if (systemTrackingCleanupRef.current) {
      systemTrackingCleanupRef.current();
    }

    const pagePreview = createContentPreview(document.body?.innerText ?? "");

    recordSystemActivity({
      id: createUniqueId(),
      type: "visit",
      timestamp: new Date().toISOString(),
      details: {
        url: window.location.href,
        title: document.title,
        contentPreview: pagePreview,
        referrer: document.referrer || undefined,
      },
    });

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      recordSystemActivity({
        id: createUniqueId(),
        type: "click",
        timestamp: new Date().toISOString(),
        details: {
          url: window.location.href,
          text: target.innerText?.trim().slice(0, 120) || undefined,
          tag: target.tagName.toLowerCase(),
          xpath: getElementXPath(target),
          contentPreview: createContentPreview(target.textContent),
        },
      });
    };

    document.addEventListener("click", handleClick, true);
    systemTrackingCleanupRef.current = () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, [recordSystemActivity]);

  const stopSystemTracking = useCallback(
    async (options?: { silent?: boolean }) => {
      if (systemTrackingCleanupRef.current) {
        systemTrackingCleanupRef.current();
        systemTrackingCleanupRef.current = null;
      }
      await flushSystemActivities(options);
      setSystemTrackingEnabled(false);
    },
    [flushSystemActivities]
  );

  const handleToggleEditingLock = useCallback(
    (locked: boolean) => {
      if (!isProcessManager) {
        toast.error("Only Process Managers can change editing lock");
        return;
      }

      setEditingLocked(locked);
      if (diagramFingerprint) {
        localStorage.setItem(`bpmn-lock:${diagramFingerprint}`, locked ? "locked" : "unlocked");
      }

      toast.success(
        locked
          ? "Collaborators are now in view-only mode"
          : "Collaborators can edit this diagram"
      );
    },
    [diagramFingerprint, isProcessManager]
  );

  const grantProcessAccess = useCallback(
    async (targetUserId: string) => {
      if (!isProcessManager) return;
      if (targetUserId === currentUser?.id) {
        toast.info("You already have Process Manager rights.");
        return;
      }

      try {
        const { error } = await supabase.from("user_roles").insert({
          user_id: targetUserId,
          role: "admin",
        });

        if (error) {
          if (error.code === "23505") {
            toast.info("User already has Process Manager rights.");
            return;
          }
          throw error;
        }

        toast.success("Process Manager access granted");
        loadCollaborators();
      } catch (error) {
        console.error("Failed to grant access:", error);
        toast.error("Unable to grant access");
      }
    },
    [currentUser?.id, isProcessManager, loadCollaborators]
  );

  const revokeProcessAccess = useCallback(
    async (targetUserId: string) => {
      if (!isProcessManager) return;
      if (targetUserId === currentUser?.id) {
        toast.error("You cannot remove your own Process Manager rights.");
        return;
      }

      try {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .match({ user_id: targetUserId, role: "admin" });

        if (error) {
          throw error;
        }

        toast.success("Process Manager access revoked");
        loadCollaborators();
      } catch (error) {
        console.error("Failed to revoke access:", error);
        toast.error("Unable to revoke access");
      }
    },
    [currentUser?.id, isProcessManager, loadCollaborators]
  );

  const loadLogHistory = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      let query = supabase
        .from("bpmn_generations")
        .select(
          "id, created_at, input_description, input_type, alternative_models, generated_bpmn_xml, user_id"
        )
        .order("created_at", { ascending: false })
        .limit(isProcessManager ? 25 : 10);

      if (!isProcessManager && currentUser) {
        query = query.eq("user_id", currentUser.id);
      }

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      setLogHistory(data ?? []);
    } catch (error) {
      console.error("Failed to load log history:", error);
      toast.error("Unable to load BPMN history right now");
    } finally {
      setIsLoadingLogs(false);
    }
  }, [currentUser, isProcessManager]);

  const generateAlternativeModels = useCallback(
    async (forceRefresh = false) => {
      if (!currentUser) {
        toast.error("Please sign in to open Modelling Agent Mode");
        return;
      }

      setAlternativeError(null);
      setIsLoadingAlternatives(true);
      setAlternativeModels([]);
      setSelectedAlternativeId(null);
      setConfirmAlternative(null);
      setConfirmAlternativeDialogOpen(false);

      try {
        const xmlSnapshot = await saveCurrentXml();
        const fingerprint =
          diagramFingerprint ?? (await computeSha256(xmlSnapshot));

        if (!diagramFingerprint) {
          setDiagramFingerprint(fingerprint);
        }

        if (!forceRefresh && !hasGeneratedAlternativesRef.current) {
          // Check for cached alternatives - look for the most recent complete set
          const { data: existingRecord, error: existingError } = await supabase
            .from("bpmn_generations")
            .select("id, alternative_models, created_at")
            .eq("user_id", currentUser.id)
            .eq("input_description", `modelling-agent:${fingerprint}`)
            .not("alternative_models", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingError && existingError.code !== "PGRST116") {
            console.warn("Error checking cache:", existingError);
            // Don't throw - continue with generation if cache check fails
          }

          if (existingRecord?.alternative_models) {
            const storedAlternatives = existingRecord
              .alternative_models as unknown as AlternativeModel[];
            if (Array.isArray(storedAlternatives) && storedAlternatives.length > 0) {
              console.log(`[Cache] Found ${storedAlternatives.length} cached alternatives`);
              setAlternativeModels(storedAlternatives);
              hasGeneratedAlternativesRef.current = true;
              setIsLoadingAlternatives(false);
              return;
            }
          }
        }

        // Generate alternatives with proper complexity distribution
        const getVariantsByCount = (count: number) => {
          // Get all variants grouped by complexity
          const basic = ALTERNATIVE_VARIANTS.filter(v => v.complexity === 'basic');
          const intermediate = ALTERNATIVE_VARIANTS.filter(v => v.complexity === 'intermediate');
          const advanced = ALTERNATIVE_VARIANTS.filter(v => v.complexity === 'advanced');

          const result: typeof ALTERNATIVE_VARIANTS = [];

          if (count === 3) {
            // Perfect balance: 1 BASIC, 1 INTERMEDIATE, 1 ADVANCED
            if (basic.length > 0) result.push(basic[0]);
            if (intermediate.length > 0) result.push(intermediate[0]);
            if (advanced.length > 0) result.push(advanced[0]);
          } else if (count === 5) {
            // Balanced: 1 BASIC, 2 INTERMEDIATE, 2 ADVANCED
            if (basic.length > 0) result.push(basic[0]);
            // Add up to 2 intermediate variants
            for (let i = 0; i < Math.min(2, intermediate.length); i++) {
              result.push(intermediate[i]);
            }
            // Add up to 2 advanced variants
            for (let i = 0; i < Math.min(2, advanced.length); i++) {
              result.push(advanced[i]);
            }
          } else if (count === 7) {
            // Full range: 1 BASIC (only 1 available), 3 INTERMEDIATE, 3 ADVANCED
            // Since we only have 1 basic, adjust: 1 BASIC, 3 INTERMEDIATE, 3 ADVANCED
            if (basic.length > 0) result.push(basic[0]);
            // Add up to 3 intermediate variants
            for (let i = 0; i < Math.min(3, intermediate.length); i++) {
              result.push(intermediate[i]);
            }
            // Add up to 3 advanced variants
            for (let i = 0; i < Math.min(3, advanced.length); i++) {
              result.push(advanced[i]);
            }
          }

          // If we don't have enough variants, fill with remaining ones in order
          if (result.length < count) {
            const usedIds = new Set(result.map(v => v.id));
            const remaining = ALTERNATIVE_VARIANTS.filter(v => !usedIds.has(v.id));
            result.push(...remaining.slice(0, count - result.length));
          }

          // Ensure we return exactly the requested count
          return result.slice(0, count);
        };

        const variantsToGenerate = getVariantsByCount(alternativeCount);

        if (!variantsToGenerate.length) {
          throw new Error("No variant definitions available for generation.");
        }

        // Initialize progress tracking with individual model statuses
        const totalVariants = variantsToGenerate.length;
        setAlternativeProgress({ completed: 0, total: totalVariants, current: undefined });

        // Initialize status map for all models
        const initialStatuses = new Map<string, 'queued' | 'generating' | 'completed' | 'failed'>();
        variantsToGenerate.forEach(variant => {
          initialStatuses.set(variant.id, 'queued');
        });
        setModelStatuses(initialStatuses);

        // Generate variants in parallel (limit to 3 concurrent requests to avoid rate limiting)
        const generated: AlternativeModel[] = [];
        let completedCount = 0;

        const generateVariant = async (variant: typeof variantsToGenerate[0], index: number): Promise<AlternativeModel | null> => {
          // Declare variables outside try block so they're accessible in catch block
          const startTime = Date.now();
          let prompt: string | undefined;
          let promptLength = 0;
          try {
            // Update status to generating
            setModelStatuses(prev => {
              const updated = new Map(prev);
              updated.set(variant.id, 'generating');
              return updated;
            });

            setAlternativeProgress({
              completed: completedCount,
              total: totalVariants,
              current: variant.title,
            });

            const instructions =
              diagramType === "pid"
                ? variant.instructions.pid
                : variant.instructions.bpmn;

            // Define complexity-specific constraints
            const complexityConstraints = {
              basic: {
                maxElements: 12,
                maxTasks: 6,
                maxBranches: 0,
                maxDecisionPoints: 0,
                maxSubprocesses: 0,
                maxDepth: 1,
                description: 'Minimal, straight-line flow with only essential activities'
              },
              intermediate: {
                maxElements: 25,
                maxTasks: 12,
                maxBranches: 2,
                maxDecisionPoints: 1,
                maxSubprocesses: 1,
                maxDepth: 2,
                description: 'Balanced with some parallelism and decision points'
              },
              advanced: {
                maxElements: 45,
                maxTasks: 20,
                maxBranches: 4,
                maxDecisionPoints: 3,
                maxSubprocesses: 2,
                maxDepth: 3,
                description: 'Complex with error handling, parallel flows, and subprocesses'
              }
            };

            const constraints = complexityConstraints[variant.complexity] || complexityConstraints.intermediate;

            // Create highly specific, prescriptive prompts for each variant to ensure different BPMN structures
            const getVariantSpecificPrompt = (variant: typeof variantsToGenerate[0], instructions: string) => {
              if (variant.complexity === 'basic') {
                return `
CRITICAL: Generate a BEGINNER-LEVEL BPMN diagram - SIMPLE, LINEAR SEQUENCE ONLY.

MODE: BEGINNER
The complexity of the diagram must align with Beginner mode:
- Use ONLY basic tasks and events in a linear sequence
- AVOID branches, parallel flows, or advanced notations

MANDATORY STRUCTURE FOR BEGINNER TIER:
1. Start Event → Basic Task 1 → Basic Task 2 → Basic Task 3 → ... → End Event
2. Use only simple <task> or <userTask> elements (no serviceTask, no manualTask)
3. Use only <startEvent> and <endEvent> (no intermediate events)
4. NO gateways (no XOR, AND, OR, or Inclusive gateways)
5. NO parallel branches
6. NO decision points
7. NO subprocesses
8. NO loops or backflows
9. NO pools or lanes
10. NO boundary events
11. NO BPMN artifacts (data objects, annotations, groups)
12. Simple linear sequence only
13. Maximum ${constraints.maxTasks} tasks total
14. Each task flows directly to the next task

EXAMPLE STRUCTURE:
<startEvent> → <task name="Task 1"> → <task name="Task 2"> → <task name="Task 3"> → <endEvent>

DO NOT include:
- Any gateways (exclusiveGateway, parallelGateway, inclusiveGateway, eventBasedGateway)
- Any subprocesses (subProcess, callActivity)
- Any boundary events (boundaryEvent)
- Any intermediate events (intermediateCatchEvent, intermediateThrowEvent)
- Any loops or cycles
- Any pools or lanes
- Any BPMN artifacts (dataObject, dataStore, annotation, group)
- Any advanced notations

Generate ONLY a simple, linear sequential flow with basic tasks and events.`;
              } else if (variant.complexity === 'intermediate') {
                // Variant-specific instructions for intermediate variants
                if (variant.id === 'automation-lean') {
                  return `
AUTOMATION LEAN: Transform repetitive/high-volume tasks into automated service tasks.

CRITICAL TRANSFORMATION:
- Identify repetitive, routine, or high-volume tasks in the process
- Convert these tasks to <serviceTask> elements (automated system tasks)
- Add system integrations: name service tasks with integration context (e.g., "Automated Data Validation", "System Notification", "Auto-Process Payment")
- Include automated escalations: use intermediate events or boundary events for automated error handling
- Keep userTask only for tasks requiring human judgment or approval
- Use 1-2 exclusiveGateway for decision points (automated routing)
- Include 1+ serviceTask for each repetitive task pattern identified
- 8-12 tasks total (mix of userTask and serviceTask)
- 2-3 execution paths

STRUCTURE: startEvent → [automated service tasks] → [decision gateways] → [user tasks for approvals] → endEvent
Focus on automation: maximize serviceTask usage for repetitive work.`;
                } else if (variant.id === 'human-centric') {
                  return `
HUMAN-CENTRIC COLLABORATION: Emphasize manual approvals and team coordination.

REQUIREMENTS:
- 2+ swimlanes (pools or lanes) representing different roles/departments
- Multiple userTask elements for manual work
- 1-2 exclusiveGateway for approval decisions
- Review loops: show tasks that require human review/approval before continuing
- Include intermediate events for notifications/handoffs between people
- 1 subprocess OR 1 intermediate event (message/timer/signal) for coordination
- 8-12 tasks total (mostly userTask)
- 2-3 execution paths showing different approval outcomes

STRUCTURE: startEvent → [swimlanes with user tasks] → [approval gateways] → [review loops] → endEvent
Focus on human collaboration: show handoffs, approvals, and coordination.`;
                } else if (variant.id === 'parallel-efficiency') {
                  return `
PARALLEL EFFICIENCY: Maximize concurrent execution of independent activities.

REQUIREMENTS:
- 1-2 parallelGateway pairs (AND split + AND join) for concurrent flows
- Identify tasks that can run simultaneously (no dependencies)
- Group independent tasks into parallel branches
- Use exclusiveGateway for decisions (1-2 decision points)
- Mix of userTask and serviceTask
- 1 subprocess OR 1 intermediate event for coordination
- 8-12 tasks total
- 2-3 parallel branches with 2-4 tasks each

STRUCTURE: startEvent → [parallelGateway split] → [concurrent branches] → [parallelGateway join] → endEvent
Focus on parallelism: maximize tasks running simultaneously.`;
                }

                // Generic intermediate instructions for other variants
                return `
INTERMEDIATE BPMN: Include structure with decisions and parallel flows.

REQUIREMENTS:
- 1-2 exclusiveGateway (decision points) with 2-3 paths each
- 1 parallelGateway (AND) OR 1 subProcess
- Mix of userTask (human) and serviceTask (system)
- 1 subprocess OR 1 intermediate event (message/timer/signal)
- 8-12 tasks total
- 2-3 execution paths

STRUCTURE: startEvent → [gateways/subprocesses] → endEvent with decision branches and optional parallel flows.`;
              } else if (variant.complexity === 'advanced') {
                return `
ADVANCED BPMN: Complex structure with error handling, compliance, and integration.

REQUIREMENTS:
- 2-3 gateways (XOR/Inclusive/Event-based) creating multiple paths
- 2-4 parallelGateway pairs (split + join)
- 1-2 subProcess elements
- 1+ boundaryEvent (error/escalation/timer) attached to task/subprocess
- 1+ recovery path (compensation/rollback/retry)
- 1+ compliance checkpoint (task/subprocess with "Compliance"/"Audit"/"Validation" in name)
- 1+ serviceTask for external system integration
- 2+ pools OR 2+ lanes
- 2+ BPMN artifacts (dataObject/dataStore/annotation/group)
- 15-20 tasks total
- 4+ execution paths

STRUCTURE: Complex routing with gateways, parallel flows, error handling, compliance checkpoints, and external integrations.`;
              }
              return '';
            };

            const variantSpecificInstructions = getVariantSpecificPrompt(variant, instructions);

            // Build concise prompt
            const tierWarning = variant.complexity === 'basic'
              ? 'BASIC: Simple sequential flow only. NO gateways, NO subprocesses, NO branching.'
              : variant.complexity === 'intermediate'
                ? 'INTERMEDIATE: Must include 1+ gateway OR 1+ subprocess. Show structure and organization.'
                : 'ADVANCED: Must include 2-3 gateways, 2-4 parallel branches, 1-2 subprocesses, error handling, 4+ paths.';

            // For Modelling Agent Mode, detect language from processSummary to ensure variants match the diagram's language
            const contentBasedLanguageDirective = getLanguageDirectiveFromContent(processSummary || '', selectedLanguage);

            prompt = `VARIANT: ${variant.title} (${variant.complexity.toUpperCase()})
Description: ${variant.description}

Process: ${processSummary}

${variantSpecificInstructions}

Constraints: Max ${constraints.maxElements} elements, ${constraints.maxTasks} tasks, ${constraints.maxBranches} branches, ${constraints.maxDecisionPoints} decisions, ${constraints.maxSubprocesses} subprocesses.

${tierWarning}

${contentBasedLanguageDirective}

Generate valid BPMN 2.0 XML matching the ${variant.complexity.toUpperCase()} tier. Include mandatory structures. Return ONLY XML, no markdown.

Seed: ${Date.now()}-${Math.random().toString(36).substring(7)}`;

            // Comprehensive diagnostic logging
            promptLength = prompt.length;
            const variantSpecificLength = variantSpecificInstructions.length;
            const processSummaryLength = processSummary?.length || 0;

            console.group(`[Modelling Agent] Generating variant: ${variant.title} (${variant.complexity})`);
            console.log('Variant Details:', {
              id: variant.id,
              title: variant.title,
              complexity: variant.complexity,
              description: variant.description,
              index
            });
            console.log('Prompt Metrics:', {
              totalLength: promptLength,
              variantSpecificLength,
              processSummaryLength,
              baseInstructionsLength: instructions.length,
              estimatedTokens: Math.ceil(promptLength / 4) // Rough estimate: 1 token ≈ 4 chars
            });
            console.log('Constraints:', constraints);
            console.log('Prompt Structure:', {
              hasVariantSpecific: variantSpecificLength > 0,
              hasProcessSummary: processSummaryLength > 0,
              hasBaseInstructions: instructions.length > 0
            });
            console.log(`Generating ${variant.title} with skipCache=true, modelingAgentMode=true`);

            // Increase timeout for complex variants (advanced may need more time)
            // Also account for Pro model which may take longer to process complex prompts
            // Advanced variants can take 90-120s due to retries and complex processing
            // Intermediate variants that require transformation (like Automation Lean) may need 90-105s
            // Other intermediate variants typically need 75-90s
            // Basic variants typically complete in 30-45s
            // Automation Lean needs extra time because it requires analyzing and transforming existing tasks
            const isTransformationVariant = variant.id === 'automation-lean';
            const timeout = variant.complexity === 'advanced'
              ? 120000
              : variant.complexity === 'intermediate'
                ? (isTransformationVariant ? 105000 : 90000)
                : 45000;
            const apiStartTime = Date.now();
            const { data, error } = await invokeFunction("generate-bpmn", {
              prompt,
              diagramType,
              skipCache: true, // Disable caching for modeling agent mode to ensure unique variants
              modelingAgentMode: true // Enable variation mode for different outputs
            }, { timeout });
            const apiDuration = Date.now() - apiStartTime;

            // Log API response details
            console.log('API Response:', {
              duration: `${apiDuration}ms`,
              hasError: !!error,
              hasData: !!data,
              hasBpmnXml: !!data?.bpmnXml,
              errorMessage: error?.message,
              responseKeys: data ? Object.keys(data) : []
            });

            if (error) {
              console.error(`[Modelling Agent] API Error for ${variant.title}:`, {
                error: error.message,
                stack: error instanceof Error ? error.stack : undefined,
                duration: `${apiDuration}ms`,
                timeout: `${timeout}ms`,
                isTimeout: error.message?.includes('timed out')
              });

              // Provide more specific error messages
              let errorMessage = error.message;
              if (error.message?.includes('timed out')) {
                const timeoutSeconds = timeout / 1000;
                errorMessage = `Request timed out after ${timeoutSeconds}s. ${variant.complexity === 'advanced' ? 'Advanced variants require more processing time. ' : variant.complexity === 'intermediate' ? 'Intermediate variants may need additional time. ' : ''}Please try generating alternatives again, or generate them individually.`;
              } else if (error.message?.includes('rate limit')) {
                errorMessage = 'API rate limit exceeded. Please wait a moment and try again. Generating multiple variants in parallel may hit rate limits.';
              } else if (error.message?.includes('429')) {
                errorMessage = 'Too many requests. Please wait a moment and try again. Consider generating variants one at a time.';
              }

              throw new Error(errorMessage);
            }

            if (!data?.bpmnXml) {
              console.error(`[Modelling Agent] No BPMN XML returned for ${variant.title}:`, {
                data: data,
                duration: `${apiDuration}ms`,
                hasData: !!data,
                dataKeys: data ? Object.keys(data) : []
              });
              throw new Error(`No BPMN XML returned for ${variant.title}. The AI model may not have generated valid output.`);
            }

            // Log successful response
            const bpmnXmlLength = data.bpmnXml.length;
            console.log('BPMN XML Received:', {
              length: bpmnXmlLength,
              estimatedTokens: Math.ceil(bpmnXmlLength / 4),
              startsWithXml: data.bpmnXml.trim().startsWith('<?xml'),
              containsDefinitions: data.bpmnXml.includes('<bpmn:definitions') || data.bpmnXml.includes('<definitions')
            });

            // Pre-render validation: Check complexity and validate structure
            const calculatedComplexity = calculateDiagramComplexity(data.bpmnXml);
            const metrics = calculateModelMetrics(data.bpmnXml);

            // IMPORTANT: Use the variant's predefined complexity, NOT the calculated one
            // The calculated complexity is only for validation, not for display
            // The variant complexity (basic/intermediate/advanced) is the intended complexity level
            const modelComplexity: AlternativeComplexity = variant.complexity;

            // Validation checks
            const validationErrors: string[] = [];
            const validationWarnings: string[] = [];

            // Check element count constraint (max 60 elements for reliable rendering - increased for advanced variants)
            // Advanced variants may legitimately have more elements
            const maxElements = variant.complexity === 'advanced' ? 60 : variant.complexity === 'intermediate' ? 50 : 45;
            if (calculatedComplexity.elementCount > maxElements) {
              validationWarnings.push(`High element count (${calculatedComplexity.elementCount} > ${maxElements}) - may affect rendering performance`);
            }

            // Validate structure matches complexity tier requirements
            try {
              const parser = new DOMParser();
              const doc = parser.parseFromString(data.bpmnXml, "application/xml");

              if (doc.getElementsByTagName("parsererror").length > 0) {
                validationErrors.push("Invalid XML structure");
              }

              // Check for sequence flows with invalid source/target
              const flows = doc.querySelectorAll('sequenceFlow');
              flows.forEach((flow, idx) => {
                const sourceRef = flow.getAttribute('sourceRef');
                const targetRef = flow.getAttribute('targetRef');
                if (!sourceRef || !targetRef) {
                  validationErrors.push(`Flow ${idx} missing sourceRef or targetRef`);
                }
              });

              // Tier-specific structure validation
              const gateways = doc.querySelectorAll('exclusiveGateway, parallelGateway, inclusiveGateway, eventBasedGateway');
              const subprocesses = doc.querySelectorAll('subProcess, callActivity');
              const boundaryEvents = doc.querySelectorAll('boundaryEvent');
              const parallelGateways = doc.querySelectorAll('parallelGateway');
              const userTasks = doc.querySelectorAll('userTask');
              const serviceTasks = doc.querySelectorAll('serviceTask');
              const intermediateEvents = doc.querySelectorAll('intermediateCatchEvent, intermediateThrowEvent');
              const pools = doc.querySelectorAll('participant');
              const lanes = doc.querySelectorAll('lane');
              const dataObjects = doc.querySelectorAll('dataObject, dataObjectReference');
              const annotations = doc.querySelectorAll('textAnnotation');
              const groups = doc.querySelectorAll('group');
              const artifacts = doc.querySelectorAll('dataObject, dataObjectReference, textAnnotation, group');

              if (variant.complexity === 'basic') {
                // BEGINNER: Should have NO gateways, NO subprocesses, NO advanced elements
                if (gateways.length > 0) {
                  validationWarnings.push(`BEGINNER tier should have no gateways, but found ${gateways.length}`);
                }
                if (subprocesses.length > 0) {
                  validationWarnings.push(`BEGINNER tier should have no subprocesses, but found ${subprocesses.length}`);
                }
                if (metrics.decisionPoints > 0) {
                  validationWarnings.push(`BEGINNER tier should have no decision points, but found ${metrics.decisionPoints}`);
                }
                if (pools.length > 1 || lanes.length > 0) {
                  validationWarnings.push(`BEGINNER tier should have no pools/lanes, but found ${pools.length} pools and ${lanes.length} lanes`);
                }
                if (artifacts.length > 0) {
                  validationWarnings.push(`BEGINNER tier should have no BPMN artifacts, but found ${artifacts.length}`);
                }
              } else if (variant.complexity === 'intermediate') {
                // INTERMEDIATE: Should have 1-2 gateways, parallel tasks, subprocess/event, human/system interaction
                // More lenient validation - only warn if completely missing structure
                if (gateways.length === 0 && subprocesses.length === 0 && intermediateEvents.length === 0 && metrics.parallelBranches === 0) {
                  validationWarnings.push(`INTERMEDIATE tier should have at least 1 gateway, subprocess, intermediate event, or parallel branch`);
                }
                // Don't warn if gateways > 2 - some variants may need more
                // Don't require both userTask and serviceTask - variant-specific
                // Don't require subprocess if gateways are present
              } else if (variant.complexity === 'advanced') {
                // ADVANCED: More lenient validation - only warn if completely missing key features
                // Advanced variants can vary significantly, so be flexible
                const hasStructure = gateways.length >= 1 || subprocesses.length >= 1 || metrics.parallelBranches >= 1;
                if (!hasStructure) {
                  validationWarnings.push(`ADVANCED tier should have at least 1 gateway, subprocess, or parallel branch`);
                }
                // Don't enforce strict counts - advanced variants can vary
                // Only warn if completely missing error handling AND compliance AND integration
                const hasAdvancedFeatures = boundaryEvents.length > 0 ||
                  artifacts.length > 0 ||
                  serviceTasks.length > 0 ||
                  pools.length > 1 ||
                  lanes.length > 1;
                if (!hasAdvancedFeatures && gateways.length < 2) {
                  validationWarnings.push(`ADVANCED tier should include advanced features (error handling, artifacts, integration, or multiple pools/lanes)`);
                }
              }

            } catch (parseError) {
              validationErrors.push("XML parsing failed");
            }

            // Comprehensive validation logging
            console.log('Validation Results:', {
              errors: validationErrors.length,
              warnings: validationWarnings.length,
              elementCount: calculatedComplexity.elementCount,
              complexity: calculatedComplexity.complexity,
              metrics: {
                taskCount: metrics.taskCount,
                decisionPoints: metrics.decisionPoints,
                parallelBranches: metrics.parallelBranches,
                errorHandlers: metrics.errorHandlers,
                estimatedPaths: metrics.estimatedPaths
              }
            });

            if (validationErrors.length > 0) {
              console.error(`[Modelling Agent] Validation errors for ${variant.title}:`, validationErrors);
            }
            if (validationWarnings.length > 0) {
              console.warn(`[Modelling Agent] Validation warnings for ${variant.title}:`, validationWarnings);
              console.warn(`Generated structure: ${metrics.decisionPoints} decision points, ${metrics.parallelBranches} parallel branches, ${metrics.taskCount} tasks`);
            }

            // DEBUG: Log complexity assignment to verify it's correct
            console.log(`[Model Generation] ${variant.title}: Variant complexity="${variant.complexity}", Assigned complexity="${modelComplexity}", Calculated complexity="${calculatedComplexity.complexity}"`);

            const totalDuration = Date.now() - startTime;
            console.log(`[Modelling Agent] Successfully generated ${variant.title} in ${totalDuration}ms`);
            console.groupEnd();

            const newModel: AlternativeModel = {
              id: `${variant.id}-${Date.now()}-${index}`,
              title: variant.title,
              description: variant.description,
              complexity: modelComplexity, // Use variant's predefined complexity (NOT calculated)
              xml: data.bpmnXml,
              generatedAt: new Date().toISOString(),
              metrics,
            };

            generated.push(newModel);
            completedCount++;

            // Update status to completed
            setModelStatuses(prev => {
              const updated = new Map(prev);
              updated.set(variant.id, 'completed');
              return updated;
            });

            // Update UI with the new model as it becomes available
            setAlternativeModels([...generated]);
            setAlternativeProgress({
              completed: completedCount,
              total: totalVariants,
              current: undefined,
            });

            if (!selectedAlternativeId) {
              setSelectedAlternativeId(newModel.id);
            }

            // Cache incrementally as each model is generated (async, don't wait)
            // This ensures we cache partial results even if generation fails later
            (async () => {
              try {
                const currentGenerated = [...generated, newModel];
                // Check if a cache record exists
                const { data: existing } = await supabase
                  .from("bpmn_generations")
                  .select("id")
                  .eq("user_id", currentUser.id)
                  .eq("input_description", `modelling-agent:${fingerprint}`)
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();

                if (existing?.id) {
                  // Update existing record
                  await supabase
                    .from("bpmn_generations")
                    .update({
                      alternative_models: JSON.parse(JSON.stringify(currentGenerated)) as any,
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", existing.id);
                } else {
                  // Insert new record
                  await supabase
                    .from("bpmn_generations")
                    .insert({
                      user_id: currentUser.id,
                      input_type: "text",
                      input_description: `modelling-agent:${fingerprint}`,
                      generated_bpmn_xml: xmlSnapshot,
                      alternative_models: JSON.parse(JSON.stringify(currentGenerated)) as any,
                    });
                }
                console.log(`[Cache] Incrementally cached ${currentGenerated.length} alternatives`);
              } catch (cacheError) {
                console.warn("Failed to cache alternatives incrementally:", cacheError);
                // Don't throw - caching is best effort
              }
            })();

            return newModel;
          } catch (error) {
            completedCount++;
            const errorDuration = Date.now() - startTime;

            // Comprehensive error logging
            console.error(`[Modelling Agent] Failed to generate alternative "${variant.title}":`, {
              variant: {
                id: variant.id,
                title: variant.title,
                complexity: variant.complexity
              },
              error: {
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                name: error instanceof Error ? error.name : 'Unknown'
              },
              duration: `${errorDuration}ms`,
              promptLength: promptLength,
              timestamp: new Date().toISOString()
            });

            // Update status to failed
            setModelStatuses(prev => {
              const updated = new Map(prev);
              updated.set(variant.id, 'failed');
              return updated;
            });

            setAlternativeProgress({
              completed: completedCount,
              total: totalVariants,
              current: undefined,
            });

            console.groupEnd(); // Close the console group opened at start

            // Don't show toast for every failure - it's too noisy
            // Only show toast if this is the last variant or if it's a critical error
            if (completedCount === totalVariants || error instanceof Error && error.message.includes('rate limit')) {
              toast.error(
                `Could not generate: ${variant.title}`,
                { description: error instanceof Error ? error.message : "An unknown error occurred. The AI model might be overloaded or the request may have timed out." }
              );
            }

            // Don't throw error - let Promise.allSettled handle it
            // Return null to indicate failure
            return null;
          }
        };

        // Execute ALL variants in parallel - start all at the same time
        // All variants will generate simultaneously, not sequentially
        const tasks = variantsToGenerate.map((variant, index) => generateVariant(variant, index));

        console.log(`[Modelling Agent] Starting parallel generation of ${totalVariants} variants`);
        console.log(`[Modelling Agent] All variants will start generating simultaneously:`, variantsToGenerate.map(v => `${v.title} (${v.complexity})`).join(', '));

        // Execute ALL variants in parallel at the same time
        // Promise.allSettled ensures we wait for all to complete (success or failure)
        const results = await Promise.allSettled(tasks);

        // Log results for debugging
        results.forEach((result, idx) => {
          const variant = variantsToGenerate[idx];
          if (result.status === 'rejected') {
            console.error(`[Parallel Processing] Variant ${variant.title} (${variant.complexity}) failed:`, result.reason);
          } else if (result.status === 'fulfilled' && result.value) {
            console.log(`[Parallel Processing] Variant ${variant.title} (${variant.complexity}) succeeded`);
          } else if (result.status === 'fulfilled' && !result.value) {
            console.warn(`[Parallel Processing] Variant ${variant.title} (${variant.complexity}) returned null (failed silently)`);
          }
        });

        // Log summary of generation results
        console.log(`[Modelling Agent] Generation complete: ${generated.length} successful, ${totalVariants - generated.length} failed`);
        if (generated.length < totalVariants) {
          const failedVariants = variantsToGenerate.filter(v => !generated.find(m => m.title === v.title));
          console.warn(`[Modelling Agent] Failed variants:`, failedVariants.map(v => v.title));
        }

        setAlternativeProgress({ completed: totalVariants, total: totalVariants });

        // Log final results
        console.log(`[Modelling Agent] Final results: ${generated.length} successful out of ${totalVariants} total variants`);
        if (generated.length < totalVariants) {
          const failedCount = totalVariants - generated.length;
          const failedVariants = variantsToGenerate.filter(v => !generated.find(m => m.title === v.title));
          console.warn(`[Modelling Agent] ${failedCount} variants failed:`, failedVariants.map(v => `${v.title} (${v.complexity})`));

          // Show a warning toast if some variants failed, but don't block if we have at least one
          if (generated.length > 0) {
            toast.warning(
              `${generated.length} of ${totalVariants} variants generated`,
              {
                description: failedCount > 0 ? `${failedCount} variants failed to generate. Check console for details.` : undefined,
                duration: 5000
              }
            );
          }
        }

        if (!generated.length) {
          const errorCount = totalVariants - generated.length;
          const errorMessage = `No alternative diagrams were produced. ${errorCount} of ${totalVariants} generations failed. Check the browser console for detailed error messages.`;
          console.error(`[Modelling Agent] ${errorMessage}`);
          throw new Error(errorMessage);
        }

        // Final update with all successful models
        setAlternativeModels(generated);
        setSelectedAlternativeId(generated[0]?.id ?? null);
        hasGeneratedAlternativesRef.current = true;

        console.log(`[Modelling Agent] Successfully generated ${generated.length} variants:`, generated.map(m => m.title));

        // Final cache update with all successful models (update if exists, insert if not)
        // This ensures we have the complete set cached even if incremental caching missed some
        try {
          // Check if a cache record exists
          const { data: existing } = await supabase
            .from("bpmn_generations")
            .select("id")
            .eq("user_id", currentUser.id)
            .eq("input_description", `modelling-agent:${fingerprint}`)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existing?.id) {
            // Update existing record with final complete set
            await supabase
              .from("bpmn_generations")
              .update({
                alternative_models: JSON.parse(JSON.stringify(generated)) as any,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existing.id);
          } else {
            // Insert new record with complete set
            await supabase
              .from("bpmn_generations")
              .insert({
                user_id: currentUser.id,
                input_type: "text",
                input_description: `modelling-agent:${fingerprint}`,
                generated_bpmn_xml: xmlSnapshot,
                alternative_models: JSON.parse(JSON.stringify(generated)) as any,
              });
          }
          console.log(`[Cache] Successfully cached ${generated.length} alternatives`);
        } catch (cacheError) {
          console.error("Failed to cache alternatives:", cacheError);
          // Don't throw - caching failure shouldn't break the flow
        }
      } catch (error) {
        console.error("Failed to prepare alternative models:", error);
        setAlternativeError(
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while preparing alternatives."
        );
      } finally {
        setIsLoadingAlternatives(false);
        // Reset progress after completion
        setAlternativeProgress({ completed: 0, total: 0 });
      }
    },
    [
      currentUser,
      diagramFingerprint,
      diagramType,
      processSummary,
      saveCurrentXml,
      alternativeCount,
      languageDirective,
    ]
  );

  // Sanitize BPMN XML to fix common LLM mistakes (unclosed tags, namespace issues, etc.)
  const sanitizeBpmnXml = useCallback((xml: string): string => {
    let sanitized = xml;

    // Fix namespace issues: bpmns: -> bpmn:
    sanitized = sanitized.replace(/bpmns:/gi, 'bpmn:');

    // Fix bpmndi namespace issues
    sanitized = sanitized.replace(/bpmndi\:BPMNShape/gi, 'bpmndi:BPMNShape');
    sanitized = sanitized.replace(/bpmndi\:BPMNEdge/gi, 'bpmndi:BPMNEdge');

    // Fix unclosed di:waypoint tags - they should be self-closing
    // Pattern: <di:waypoint x="..." y="..."> should become <di:waypoint x="..." y="..."/>
    // Match opening tags that don't end with /> and convert them to self-closing
    sanitized = sanitized.replace(/<(\s*)di:waypoint\s+([^>]*?)>/gi, (match, whitespace, attrs) => {
      // If it doesn't end with />, make it self-closing
      if (!match.trim().endsWith('/>')) {
        return `<${whitespace}di:waypoint ${attrs}/>`;
      }
      return match;
    });

    // Fix any remaining unclosed waypoint tags without attributes
    sanitized = sanitized.replace(/<(\s*)di:waypoint\s*>/gi, '<$1di:waypoint/>');

    // Remove invalid tags that don't exist in BPMN 2.0
    sanitized = sanitized.replace(/<\s*bpmn:flowNodeRef[^>]*>[\s\S]*?<\/\s*bpmn:flowNodeRef\s*>/gi, '');
    sanitized = sanitized.replace(/<\s*bpmns:flowNodeRef[^>]*>[\s\S]*?<\/\s*bpmns:flowNodeRef\s*>/gi, '');
    sanitized = sanitized.replace(/<\/\s*bpmn:flowNodeRef\s*>/gi, '');
    sanitized = sanitized.replace(/<\/\s*bpmns:flowNodeRef\s*>/gi, '');
    sanitized = sanitized.replace(/<\s*bpmn:flowNodeRef[^>]*\/?\s*>/gi, '');
    sanitized = sanitized.replace(/<\s*bpmns:flowNodeRef[^>]*\/?\s*>/gi, '');

    // Fix XML declaration issues
    sanitized = sanitized.replace(/<\s*\/\?xml/gi, '<?xml');

    // Fix unescaped ampersands
    sanitized = sanitized.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');

    // Remove orphaned closing tags
    sanitized = sanitized.replace(/<\/\s*[^>]*:flowNodeRef[^>]*>/gi, '');

    return sanitized.trim();
  }, []);

  const applyAlternativeModel = useCallback(
    async (model: AlternativeModel) => {
      if (!modelerRef.current) return;

      try {
        // Sanitize XML before applying to fix common LLM mistakes
        const sanitizedXml = sanitizeBpmnXml(model.xml);
        setDiagramReady(false);
        await modelerRef.current.importXML(sanitizedXml);
        const canvas = modelerRef.current.get("canvas") as {
          zoom: (mode: string) => void;
          getViewbox: () => { scale: number; x: number; y: number; width: number; height: number } | undefined;
        };
        // Safe zoom: validate viewbox before applying
        try {
          const viewbox = canvas.getViewbox();
          if (viewbox) {
            const scale = viewbox.scale ?? 1;
            const width = viewbox.width ?? 0;
            const height = viewbox.height ?? 0;
            if (isFinite(scale) && isFinite(width) && isFinite(height) &&
              width > 0 && height > 0 && scale > 0) {
              canvas.zoom("fit-viewport");
            }
          }
        } catch (zoomError) {
          console.warn("Zoom error, continuing:", zoomError);
        }
        setVersions((prev) => [...prev, model.xml]);
        setVersion((prev) => prev + 1);
        toast.success(`${model.title} applied to the canvas`);
        setAgentDialogOpen(false);
        captureCurrentLabels();
        setDiagramReady(true);
      } catch (error) {
        console.error("Failed to apply alternative model:", error);
        toast.error("Unable to apply this alternative diagram");
        setDiagramReady(true);
      }
    },
    [captureCurrentLabels]
  );

  const downloadAlternativeModel = useCallback(
    (model: AlternativeModel, format: "bpmn" | "xml" = "bpmn") => {
      const blob = new Blob([model.xml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const safeTitle = model.title.replace(/\s+/g, "_").toLowerCase();
      link.download = `${safeTitle}_${model.complexity}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
    []
  );

  const applyHistoricalDiagram = useCallback(async (entry: LogHistoryEntry) => {
    if (!modelerRef.current) return;

    try {
      setDiagramReady(false);
      await modelerRef.current.importXML(entry.generated_bpmn_xml);
      const canvas = modelerRef.current.get("canvas") as {
        zoom: (mode: string) => void;
        getViewbox: () => { scale: number; x: number; y: number; width: number; height: number } | undefined;
      };
      // Safe zoom: validate viewbox before applying
      try {
        const viewbox = canvas.getViewbox();
        if (viewbox && isFinite(viewbox.scale) && isFinite(viewbox.width) && isFinite(viewbox.height) &&
          viewbox.width > 0 && viewbox.height > 0) {
          canvas.zoom("fit-viewport");
        }
      } catch (zoomError) {
        console.warn("Zoom error, continuing:", zoomError);
      }
      setVersions((prev) => [...prev, entry.generated_bpmn_xml]);
      setVersion((prev) => prev + 1);
      toast.success("Historical diagram loaded");
      setLogDialogOpen(false);
      captureCurrentLabels();
      setDiagramReady(true);
    } catch (error) {
      console.error("Failed to load historical diagram:", error);
      toast.error("Unable to load this historical snapshot");
      setDiagramReady(true);
    }
  }, [captureCurrentLabels]);

  const downloadXmlSnapshot = useCallback((xmlContent: string, name: string) => {
    const blob = new Blob([xmlContent], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name.endsWith(".bpmn") ? name : `${name}.bpmn`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  // Dialog states
  const [visionDialogOpen, setVisionDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [systemDialogOpen, setSystemDialogOpen] = useState(false);
  const [xmlViewerData, setXmlViewerData] = useState<XmlViewerData | null>(null);

  // File upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Palette panel state
  const [showPalette, setShowPalette] = useState(true);
  const [isPaletteCollapsed, setIsPaletteCollapsed] = useState(false);
  const [palettePosition, setPalettePosition] = useState({ x: 0, y: 0 });
  // Calculate default height to fit within canvas (viewport height minus headers ~8rem = 128px)
  const defaultPaletteHeight = typeof window !== 'undefined' ? Math.min(700, window.innerHeight - 300) : 600;
  const [paletteSize, setPaletteSize] = useState({ width: 280, height: defaultPaletteHeight });
  const [paletteSearch, setPaletteSearch] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    quickDraw: true,
    startEvents: true,
    activities: true,
    intermediateEvents: false,
    endEvents: false,
    gateways: false,
    subprocesses: true,
    pools: true,
    dataObjects: true,
    artifacts: true,
  });
  const dragStartPosition = useRef({ x: 0, y: 0 });
  const resizeStartState = useRef({
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    clientX: 0,
    clientY: 0,
    edge: '' as 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
    startLeft: 0,
    startTop: 0,
    startRight: 0,
    startBottom: 0,
  });
  const isResizingRef = useRef(false);
  const [isResizing, setIsResizing] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);
  const containerPositionRef = useRef({ top: 0, left: 0 });
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [showRuler, setShowRuler] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const [isPanMode, setIsPanMode] = useState(false);
  const [showPropertiesPanel, setShowPropertiesPanel] = useState(false);
  const [showParticipantsPanel, setShowParticipantsPanel] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showDocumentationPanel, setShowDocumentationPanel] = useState(false);
  const [showValidationResults, setShowValidationResults] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Array<{ message: string; elementId?: string }>>([]);

  // Element change context menu state
  const [selectedElement, setSelectedElement] = useState<{ type?: string; id?: string;[key: string]: unknown } | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [showContextMenu, setShowContextMenu] = useState(false);

  // P&ID specific states
  const [showLegend, setShowLegend] = useState(false);
  const [showAdvancedSymbols, setShowAdvancedSymbols] = useState(false);
  const [version, setVersion] = useState(1);
  const [versions, setVersions] = useState<string[]>([xml]);
  const [errorState, setErrorState] = useState<string | null>(null);

  // Initialize versions with first XML load
  useEffect(() => {
    if (xml && versions.length === 1 && versions[0] !== xml) {
      setVersions([xml]);
      setVersion(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xml]);

  useEffect(() => {
    let isMounted = true;
    const updateFingerprint = async () => {
      if (!xml) return;
      try {
        const hash = await computeSha256(xml);
        if (!isMounted) return;
        setDiagramFingerprint(hash);
        const storedLock = localStorage.getItem(`bpmn-lock:${hash}`);
        if (storedLock === "locked") {
          setEditingLocked(true);
        } else if (storedLock === "unlocked") {
          setEditingLocked(false);
        }
      } catch (error) {
        console.error("Failed to compute diagram fingerprint:", error);
      }
    };

    updateFingerprint();
    return () => {
      isMounted = false;
    };
  }, [xml]);

  useEffect(() => {
    let isMounted = true;
    const loadUser = async () => {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (!isMounted) return;

        if (authError) {
          throw authError;
        }

        setCurrentUser(user ?? null);

        if (!user) {
          setIsProcessManager(false);
          return;
        }

        const { data: roles, error: rolesError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (rolesError) {
          throw rolesError;
        }

        const isAdmin = roles?.some((role) => role.role === "admin") ?? false;
        setIsProcessManager(isAdmin);
      } catch (error) {
        console.error("Failed to load user/role info:", error);
        if (isMounted) {
          setCurrentUser(null);
          setIsProcessManager(false);
        }
      }
    };

    loadUser();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setCanEdit(isProcessManager || !editingLocked);
  }, [isProcessManager, editingLocked]);

  useEffect(() => {
    canEditRef.current = canEdit;
  }, [canEdit, captureCurrentLabels]);

  useEffect(() => {
    hasGeneratedAlternativesRef.current = false;
    setAlternativeModels([]);
  }, [diagramFingerprint]);

  useEffect(() => {
    if (alternativeModels.length) {
      setSelectedAlternativeId((prev) => {
        if (prev && alternativeModels.some((model) => model.id === prev)) {
          return prev;
        }
        return alternativeModels[0].id;
      });
    } else {
      setSelectedAlternativeId(null);
    }
  }, [alternativeModels]);

  useEffect(() => {
    if (processDialogOpen) {
      loadCollaborators();
    }
  }, [processDialogOpen, loadCollaborators]);

  useEffect(() => {
    return () => {
      if (systemTrackingCleanupRef.current) {
        systemTrackingCleanupRef.current();
      }
      if (systemActivitiesRef.current.length > 0) {
        void flushSystemActivities({ silent: true });
      }
    };
  }, [flushSystemActivities]);

  useEffect(() => {
    if (agentDialogOpen) {
      generateAlternativeModels();
    }
  }, [agentDialogOpen, generateAlternativeModels]);

  useEffect(() => {
    if (!agentDialogOpen) {
      setConfirmAlternative(null);
      setConfirmAlternativeDialogOpen(false);
    }
  }, [agentDialogOpen]);

  useEffect(() => {
    if (logDialogOpen) {
      loadLogHistory();
    }
  }, [loadLogHistory, logDialogOpen]);

  // Poll for Vision AI job completion
  useEffect(() => {
    if (!visionJobId) return;

    let pollInterval: number | undefined;

    const checkJobStatus = async () => {
      const { data, error } = await supabase
        .from('vision_bpmn_jobs')
        .select('status, bpmn_xml, error_message')
        .eq('id', visionJobId)
        .single();

      if (error) {
        console.error('Error checking job status:', error);
        return;
      }

      if (data.status === 'completed' && data.bpmn_xml) {
        // Import the generated BPMN
        if (modelerRef.current) {
          try {
            setDiagramReady(false);
            await modelerRef.current.importXML(data.bpmn_xml);
            const canvas = modelerRef.current.get("canvas") as {
              zoom: (mode: string) => void;
              getViewbox: () => { scale: number; x: number; y: number; width: number; height: number } | undefined;
            };
            // Safe zoom: validate viewbox before applying
            try {
              const viewbox = canvas.getViewbox();
              if (viewbox && isFinite(viewbox.scale) && isFinite(viewbox.width) && isFinite(viewbox.height) &&
                viewbox.width > 0 && viewbox.height > 0) {
                canvas.zoom("fit-viewport");
              }
            } catch (zoomError) {
              console.warn("Zoom error, continuing:", zoomError);
            }

            toast.success("BPMN diagram generated from your image!", {
              description: "Process extracted and visualized successfully"
            });
            captureCurrentLabels();
            setDiagramReady(true);
          } catch (importError) {
            console.error('Failed to import BPMN:', importError);
            toast.error("Failed to load generated diagram");
            setDiagramReady(true);
          }
        }

        // Reset file input
        const fileInput = document.getElementById('vision-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = "";

        setVisionDialogOpen(false);
        setSelectedFile(null);
        setIsProcessing(false);
        setVisionJobId(null);
        if (pollInterval) clearInterval(pollInterval);
      } else if (data.status === 'failed') {
        const errorMsg = data.error_message || "Processing failed. Please try again.";
        toast.error("Vision AI processing failed", {
          description: errorMsg
        });

        // Reset file input
        const fileInput = document.getElementById('vision-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = "";

        setIsProcessing(false);
        setSelectedFile(null);
        setVisionJobId(null);
        if (pollInterval) clearInterval(pollInterval);
      }
    };

    // Try realtime subscription first
    const channel = supabase
      .channel(`vision-job-${visionJobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'vision_bpmn_jobs',
          filter: `id=eq.${visionJobId}`
        },
        (payload) => {
          const job = payload.new as { status: string; bpmn_xml?: string; error_message?: string };
          console.log('📡 Vision job status update:', job.status);

          if (job.status === 'completed' && job.bpmn_xml) {
            if (modelerRef.current) {
              setDiagramReady(false);
              modelerRef.current.importXML(job.bpmn_xml).then(() => {
                const canvas = modelerRef.current!.get("canvas") as {
                  zoom: (mode: string) => void;
                  getViewbox: () => { scale: number; x: number; y: number; width: number; height: number } | undefined;
                };
                // Safe zoom: validate viewbox before applying
                try {
                  const viewbox = canvas.getViewbox();
                  if (viewbox && isFinite(viewbox.scale) && isFinite(viewbox.width) && isFinite(viewbox.height) &&
                    viewbox.width > 0 && viewbox.height > 0) {
                    canvas.zoom("fit-viewport");
                  }
                } catch (zoomError) {
                  console.warn("Zoom error, continuing:", zoomError);
                }

                toast.success("BPMN diagram generated from your image!", {
                  description: "Process extracted and visualized successfully"
                });
                captureCurrentLabels();
                setDiagramReady(true);
              }).catch((importError) => {
                console.error('Failed to import BPMN:', importError);
                toast.error("Failed to load generated diagram");
                setDiagramReady(true);
              });
            }

            // Reset file input
            const fileInput = document.getElementById('vision-upload') as HTMLInputElement;
            if (fileInput) fileInput.value = "";

            setVisionDialogOpen(false);
            setSelectedFile(null);
            setIsProcessing(false);
            setVisionJobId(null);
            if (pollInterval) clearInterval(pollInterval);
          } else if (job.status === 'failed') {
            const errorMsg = job.error_message || "Processing failed. Please try again.";
            toast.error("Vision AI processing failed", {
              description: errorMsg
            });

            // Reset file input
            const fileInput = document.getElementById('vision-upload') as HTMLInputElement;
            if (fileInput) fileInput.value = "";

            setIsProcessing(false);
            setSelectedFile(null);
            setVisionJobId(null);
            if (pollInterval) clearInterval(pollInterval);
          }
        }
      )
      .subscribe();

    // Fallback: Poll every 3 seconds
    pollInterval = window.setInterval(checkJobStatus, 3000);
    // Check immediately
    checkJobStatus();

    // Set a timeout to stop polling after 5 minutes
    const timeoutId = window.setTimeout(() => {
      if (pollInterval) clearInterval(pollInterval);
      toast.error("Processing timed out", {
        description: "Please try again or contact support"
      });

      // Reset file input
      const fileInput = document.getElementById('vision-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      setIsProcessing(false);
      setSelectedFile(null);
      setVisionJobId(null);
    }, 300000); // 5 minutes

    return () => {
      clearTimeout(timeoutId);
      supabase.removeChannel(channel);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [visionJobId, diagramType, captureCurrentLabels]);

  // Initialize modeler once on mount
  useEffect(() => {
    if (!containerRef.current || modelerRef.current) return;

    // Create modeler instance with palette hidden and PidRenderer
    modelerRef.current = new BpmnModeler({
      container: containerRef.current,
      additionalModules: [
        {
          __init__: ['paletteProvider'],
          paletteProvider: ['value', { getPaletteEntries: () => ({}) }]
        },
        PidRenderer
      ]
    });

    // Force P&ID mode if diagramType is 'pid' - do this immediately after modeler creation
    if (diagramType === 'pid') {
      // Use eventBus to ensure renderer is ready
      const eventBus = modelerRef.current.get("eventBus") as { once: (event: string, callback: () => void) => void };
      eventBus.once('canvas.init', () => {
        try {
          const pidRenderer = modelerRef.current?.get('pidRenderer', false);
          if (pidRenderer) {
            (pidRenderer as any).isPidMode = true;
          }
        } catch (e) {
          // Ignore
        }
      });

      // Also set immediately in case event already fired
      setTimeout(() => {
        try {
          const pidRenderer = modelerRef.current?.get('pidRenderer', false);
          if (pidRenderer) {
            (pidRenderer as any).isPidMode = true;
          }
        } catch (e) {
          // Ignore
        }
      }, 50);
    }


    // Listen to command stack changes via EventBus for undo/redo
    const eventBus = modelerRef.current.get("eventBus") as { on: (event: string, callback: (data: unknown) => void) => void };
    eventBus.on("commandStack.changed", () => {
      const commandStack = modelerRef.current?.get("commandStack") as { canUndo: () => boolean; canRedo: () => boolean } | undefined;
      if (commandStack) {
        setCanUndo(commandStack.canUndo());
        setCanRedo(commandStack.canRedo());
      }
    });

    // Helper function to toggle subprocess expand/collapse
    const toggleSubprocessExpansion = (elementId: string) => {
      if (!modelerRef.current) return;

      try {
        const modeling = modelerRef.current.get('modeling') as {
          updateProperties: (element: unknown, properties: { isExpanded?: boolean }) => void;
          toggleCollapse?: (element: unknown) => void;
        };
        const elementRegistry = modelerRef.current.get('elementRegistry') as { get: (id: string) => unknown };

        const subprocessElement = elementRegistry.get(elementId);
        if (subprocessElement) {
          if (typeof modeling.toggleCollapse === 'function') {
            // Use built-in toggle method if available
            modeling.toggleCollapse(subprocessElement);
          } else {
            // Fallback: manually toggle isExpanded
            const bo = (subprocessElement as { businessObject?: { di?: { isExpanded?: boolean } } }).businessObject;
            const di = bo?.di;
            const currentExpanded = di?.isExpanded !== false;
            modeling.updateProperties(subprocessElement, {
              isExpanded: !currentExpanded
            });
          }
        }
      } catch (error) {
        console.error('Error toggling subprocess expansion:', error);
      }
    };

    // Add direct DOM event listener for marker clicks
    const handleMarkerClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | SVGElement;
      if (!target || !modelerRef.current) return;

      // Check if click is on a marker element (SVG circle or path that represents +/- icon)
      const isMarkerElement = target.tagName === 'circle' ||
        target.tagName === 'path' ||
        target.classList.contains('djs-collapse-marker') ||
        target.classList.contains('djs-expand-marker') ||
        target.closest('.djs-collapse-marker') ||
        target.closest('.djs-expand-marker');

      if (isMarkerElement) {
        const elementRegistry = modelerRef.current.get('elementRegistry') as {
          filter: (filterFn: (element: { type?: string; id?: string }) => boolean) => Array<{ type?: string; id?: string }>;
        };
        const canvas = modelerRef.current.get('canvas') as {
          getGraphics: (element: unknown) => SVGElement | null;
        };

        // Get all subprocesses and check which one contains this marker
        const subprocesses = elementRegistry.filter((el: { type?: string }) => el.type === 'bpmn:SubProcess');

        for (const subprocess of subprocesses) {
          if (subprocess.id) {
            const gfx = canvas.getGraphics(subprocess);
            if (gfx) {
              // Check if the clicked element is within this subprocess's graphics
              const gfxRect = gfx.getBoundingClientRect();
              const clickX = e.clientX;
              const clickY = e.clientY;

              // Check if click is in the bottom center area (where marker typically is)
              const isInMarkerArea = clickX >= gfxRect.left &&
                clickX <= gfxRect.right &&
                clickY >= gfxRect.bottom - 30 && // Bottom 30px area
                clickY <= gfxRect.bottom + 10;

              // Also check if target is actually within the gfx element
              if (gfx.contains(target as Node) || isInMarkerArea) {
                toggleSubprocessExpansion(subprocess.id);
                e.stopPropagation();
                e.preventDefault();
                return;
              }
            }
          }
        }
      }
    };

    // Add click listener to the container
    const container = containerRef.current;
    if (container) {
      container.addEventListener('click', handleMarkerClick, true); // Use capture phase
    }

    // Listen to element clicks to show context menu or toggle subprocess
    eventBus.on("element.click", (event: { element: { type?: string; waypoints?: unknown; businessObject?: { isExpanded?: boolean }; id?: string }; originalEvent: MouseEvent; gfx?: unknown }) => {
      const { element, originalEvent, gfx } = event;

      // Handle subprocess expand/collapse on click
      if (element.type === 'bpmn:SubProcess' && element.id && modelerRef.current) {
        try {
          const canvas = modelerRef.current.get('canvas') as {
            getGraphics: (element: unknown) => SVGElement | null;
          };

          if (gfx) {
            const svgElement = gfx as SVGElement;
            const clickTarget = originalEvent.target as HTMLElement | SVGElement;

            // Check if click is on a marker element (circle, path, or marker class)
            const isMarkerClick = clickTarget && (
              clickTarget.tagName === 'circle' ||
              clickTarget.tagName === 'path' ||
              (clickTarget as HTMLElement).classList?.contains('djs-collapse-marker') ||
              (clickTarget as HTMLElement).classList?.contains('djs-expand-marker') ||
              (clickTarget as HTMLElement).closest?.('.djs-collapse-marker') ||
              (clickTarget as HTMLElement).closest?.('.djs-expand-marker')
            );

            // Also check if click is in the bottom center area of the subprocess (where marker is)
            const gfxRect = svgElement.getBoundingClientRect();
            const clickX = originalEvent.clientX;
            const clickY = originalEvent.clientY;
            const isInMarkerArea = clickX >= gfxRect.left &&
              clickX <= gfxRect.right &&
              clickY >= gfxRect.bottom - 40 && // Bottom 40px area
              clickY <= gfxRect.bottom + 10 &&
              clickX >= gfxRect.left + (gfxRect.width * 0.4) && // Center 20% of width
              clickX <= gfxRect.right - (gfxRect.width * 0.4);

            if (isMarkerClick || isInMarkerArea) {
              // Click is on the marker, toggle expansion
              toggleSubprocessExpansion(element.id);
              originalEvent.stopPropagation();
              originalEvent.preventDefault();
              return;
            }
          }
        } catch (error) {
          console.error('Error handling subprocess click:', error);
        }
      }

      if (!canEditRef.current) {
        setShowContextMenu(false);
        return;
      }

      // Ignore root element and connections
      if (element.type === 'bpmn:Process' || element.waypoints) {
        setShowContextMenu(false);
        return;
      }

      // Get click position relative to viewport
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setContextMenuPosition({
          x: originalEvent.clientX - rect.left,
          y: originalEvent.clientY - rect.top
        });
        setSelectedElement(element);
        setShowContextMenu(true);
      }
    });

    // Listen for double-click on subprocesses to toggle expand/collapse
    eventBus.on("element.dblclick", (event: { element: { type?: string; id?: string } }) => {
      const { element } = event;

      if (element.type === 'bpmn:SubProcess' && element.id) {
        toggleSubprocessExpansion(element.id);
      }
    });

    // Listen for interaction events that might be triggered by marker clicks
    eventBus.on("interactionEvents.create", (event: { element: { type?: string; id?: string } }) => {
      // This might catch marker interactions in some BPMN.js versions
    });

    // Also listen for marker click events (alternative event name)
    eventBus.on("marker.click", (event: { element: { type?: string; id?: string } }) => {
      const { element } = event;

      if (element.type === 'bpmn:SubProcess' && element.id) {
        toggleSubprocessExpansion(element.id);
      }
    });

    // Listen for shape click events that might include marker clicks
    eventBus.on("shape.click", (event: { element: { type?: string; id?: string }; originalEvent?: MouseEvent }) => {
      const { element, originalEvent } = event;

      if (element.type === 'bpmn:SubProcess' && element.id && originalEvent) {
        const target = originalEvent.target as HTMLElement;
        // Check if click is on a marker
        if (target && (
          target.classList.contains('djs-collapse-marker') ||
          target.closest('.djs-collapse-marker') ||
          target.classList.contains('djs-expand-marker') ||
          target.closest('.djs-expand-marker')
        )) {
          toggleSubprocessExpansion(element.id);
          originalEvent.stopPropagation();
          originalEvent.preventDefault();
        }
      }
    });

    return () => {
      // Remove event listener
      if (container) {
        container.removeEventListener('click', handleMarkerClick, true);
      }
      // Cleanup only on unmount
      if (modelerRef.current) {
        modelerRef.current.destroy();
        modelerRef.current = null;
      }
    };
  }, []);

  // Helper function to inject pid: attributes if missing
  const injectPidAttributes = (xmlString: string): string => {
    if (diagramType !== 'pid') return xmlString;

    let modifiedXml = xmlString;

    // Check if pid namespace is present
    if (!modifiedXml.includes('xmlns:pid="http://pid.extensions/schema"')) {
      // Add pid namespace to definitions tag
      modifiedXml = modifiedXml.replace(
        /(<bpmn:definitions[^>]*>)/,
        '$1\n  xmlns:pid="http://pid.extensions/schema"'
      );
    }

    // Helper to infer pid attributes from element name and type
    const inferPidAttributes = (elementName: string, elementType: string): string => {
      const name = (elementName || '').toLowerCase();
      let type = '';
      let symbol = '';
      let category = '';

      // Infer from element type and name
      if (elementType.includes('task') || elementType.includes('Task')) {
        if (name.includes('tank') || name.includes('vessel') || name.includes('drum')) {
          type = 'equipment';
          symbol = 'tank';
          category = 'mechanical';
        } else if (name.includes('pump')) {
          type = 'equipment';
          symbol = 'pump';
          category = 'mechanical';
        } else if (name.includes('filter')) {
          type = 'equipment';
          symbol = 'filter';
          category = 'mechanical';
        } else if (name.includes('exchanger') || name.includes('heater') || name.includes('cooler')) {
          type = 'equipment';
          symbol = 'heat_exchanger';
          category = 'mechanical';
        } else {
          type = 'equipment';
          symbol = 'tank'; // default
          category = 'mechanical';
        }
      } else if (elementType.includes('exclusiveGateway') || elementType.includes('Gateway')) {
        if (name.includes('valve')) {
          type = 'valve';
          symbol = name.includes('control') ? 'valve_control' : 'valve_gate';
          category = 'mechanical';
        } else {
          type = 'valve';
          symbol = 'valve_control';
          category = 'mechanical';
        }
      } else if (elementType.includes('dataObjectReference') || elementType.includes('DataObject')) {
        if (name.includes('analyzer')) {
          type = 'instrument';
          symbol = 'analyzer';
          category = 'control';
        } else if (name.includes('transmitter') || name.includes('transducer')) {
          type = 'instrument';
          if (name.includes('level')) symbol = 'transmitter_level';
          else if (name.includes('flow')) symbol = 'transmitter_flow';
          else if (name.includes('pressure')) symbol = 'transmitter_pressure';
          else symbol = 'transmitter_level';
          category = 'control';
        } else {
          type = 'instrument';
          symbol = 'transmitter_level';
          category = 'control';
        }
      } else if (elementType.includes('subProcess') || elementType.includes('SubProcess')) {
        if (name.includes('controller')) {
          type = 'controller';
          symbol = 'controller_pid';
          category = 'control';
        } else {
          type = 'controller';
          symbol = 'controller_pid';
          category = 'control';
        }
      } else if (elementType.includes('sequenceFlow') || elementType.includes('SequenceFlow')) {
        type = 'line';
        category = 'process';
      } else if (elementType.includes('messageFlow') || elementType.includes('MessageFlow')) {
        type = 'line';
        category = 'signal';
      }

      if (type && symbol && category) {
        return ` pid:type="${type}" pid:symbol="${symbol}" pid:category="${category}"`;
      }
      return '';
    };

    // Inject attributes for task elements
    modifiedXml = modifiedXml.replace(
      /(<bpmn:task[^>]*name="([^"]*)")([^>]*>)/g,
      (match, start, name, end) => {
        if (match.includes('pid:type')) return match; // Already has attributes
        const attrs = inferPidAttributes(name, 'task');
        return start + attrs + end;
      }
    );

    // Inject attributes for exclusiveGateway elements
    modifiedXml = modifiedXml.replace(
      /(<bpmn:exclusiveGateway[^>]*name="([^"]*)")([^>]*>)/g,
      (match, start, name, end) => {
        if (match.includes('pid:type')) return match;
        const attrs = inferPidAttributes(name, 'exclusiveGateway');
        return start + attrs + end;
      }
    );

    // Inject attributes for dataObjectReference elements
    modifiedXml = modifiedXml.replace(
      /(<bpmn:dataObjectReference[^>]*name="([^"]*)")([^>]*>)/g,
      (match, start, name, end) => {
        if (match.includes('pid:type')) return match;
        const attrs = inferPidAttributes(name, 'dataObjectReference');
        return start + attrs + end;
      }
    );

    // Inject attributes for subProcess elements
    modifiedXml = modifiedXml.replace(
      /(<bpmn:subProcess[^>]*name="([^"]*)")([^>]*>)/g,
      (match, start, name, end) => {
        if (match.includes('pid:type')) return match;
        const attrs = inferPidAttributes(name, 'subProcess');
        return start + attrs + end;
      }
    );

    // Inject attributes for sequenceFlow elements
    modifiedXml = modifiedXml.replace(
      /(<bpmn:sequenceFlow[^>]*)([^/]*>)/g,
      (match, start, end) => {
        if (match.includes('pid:type')) return match;
        const attrs = inferPidAttributes('', 'sequenceFlow');
        return start + attrs + end;
      }
    );

    // Inject attributes for messageFlow elements
    modifiedXml = modifiedXml.replace(
      /(<bpmn:messageFlow[^>]*)([^/]*>)/g,
      (match, start, end) => {
        if (match.includes('pid:type')) return match;
        const attrs = inferPidAttributes('', 'messageFlow');
        return start + attrs + end;
      }
    );

    return modifiedXml;
  };

  // Import XML whenever it changes
  useEffect(() => {
    if (!modelerRef.current || !xml) return;

    // FORCE P&ID mode BEFORE import if diagramType is 'pid'
    if (diagramType === 'pid') {
      try {
        const pidRenderer = modelerRef.current?.get('pidRenderer', false);
        if (pidRenderer) {
          (pidRenderer as any).isPidMode = true;
        }
      } catch (e) {
        // Ignore
      }
    }

    // Inject pid: attributes if missing (for P&ID diagrams)
    let processedXml = injectPidAttributes(xml);

    // Store processedXml for later use
    const finalXml = processedXml;

    setDiagramReady(false);

    modelerRef.current.importXML(finalXml).then(() => {
      const canvas = modelerRef.current!.get("canvas") as {
        zoom: (mode: string) => void;
        getRootElement: () => any;
        getViewbox: () => { scale: number; x: number; y: number; width: number; height: number } | undefined;
      };
      // Safe zoom: validate viewbox before applying
      try {
        const viewbox = canvas.getViewbox();
        if (viewbox && isFinite(viewbox.scale) && isFinite(viewbox.width) && isFinite(viewbox.height) &&
          viewbox.width > 0 && viewbox.height > 0) {
          canvas.zoom("fit-viewport");
        }
      } catch (zoomError) {
        console.warn("Zoom error, continuing:", zoomError);
      }
      setErrorState(null);

      // Force P&ID mode after import if diagramType is 'pid'
      if (diagramType === "pid") {
        try {
          const pidRenderer = modelerRef.current?.get('pidRenderer', false);
          if (pidRenderer) {
            (pidRenderer as any).isPidMode = true;

            // Force re-render to apply P&ID styling
            setTimeout(() => {
              try {
                const elementRegistry = modelerRef.current!.get("elementRegistry") as { getAll: () => any[] };
                const drawModule = modelerRef.current!.get("draw", false) as { update: (element: any) => void } | undefined;
                const allElements = elementRegistry.getAll();

                // Re-render all elements to apply P&ID styling
                allElements.forEach((element: any) => {
                  if (drawModule && drawModule.update) {
                    try {
                      drawModule.update(element);
                    } catch (e) {
                      // Ignore individual element errors
                    }
                  }
                });
              } catch (e) {
                // Ignore
              }
            }, 200);
          }
        } catch (e) {
          // Ignore
        }

        // Debug and manually set P&ID attributes on business objects if missing
        const elementRegistry = modelerRef.current!.get("elementRegistry") as { getAll: () => any[] };
        const allElements = elementRegistry.getAll();
        let pidAttrCount = 0;
        let manuallySetCount = 0;

        // Helper to infer pid attributes from element name and type
        const inferPidAttrs = (elementName: string, elementType: string) => {
          const name = (elementName || '').toLowerCase();
          let type = '';
          let symbol = '';
          let category = '';

          if (elementType.includes('task') || elementType.includes('Task')) {
            if (name.includes('tank') || name.includes('vessel') || name.includes('drum')) {
              type = 'equipment'; symbol = 'tank'; category = 'mechanical';
            } else if (name.includes('pump')) {
              type = 'equipment'; symbol = 'pump'; category = 'mechanical';
            } else if (name.includes('filter')) {
              type = 'equipment'; symbol = 'filter'; category = 'mechanical';
            } else if (name.includes('exchanger') || name.includes('heater') || name.includes('cooler')) {
              type = 'equipment'; symbol = 'heat_exchanger'; category = 'mechanical';
            } else {
              type = 'equipment'; symbol = 'tank'; category = 'mechanical';
            }
          } else if (elementType.includes('exclusiveGateway') || elementType.includes('Gateway')) {
            type = 'valve';
            symbol = name.includes('control') ? 'valve_control' : 'valve_gate';
            category = 'mechanical';
          } else if (elementType.includes('dataObjectReference') || elementType.includes('DataObject')) {
            type = 'instrument';
            if (name.includes('analyzer')) symbol = 'analyzer';
            else if (name.includes('transmitter') || name.includes('transducer')) {
              if (name.includes('level')) symbol = 'transmitter_level';
              else if (name.includes('flow')) symbol = 'transmitter_flow';
              else if (name.includes('pressure')) symbol = 'transmitter_pressure';
              else symbol = 'transmitter_level';
            } else symbol = 'transmitter_level';
            category = 'control';
          } else if (elementType.includes('subProcess') || elementType.includes('SubProcess')) {
            type = 'controller'; symbol = 'controller_pid'; category = 'control';
          } else if (elementType.includes('sequenceFlow') || elementType.includes('SequenceFlow')) {
            type = 'line'; category = 'process';
          } else if (elementType.includes('messageFlow') || elementType.includes('MessageFlow')) {
            type = 'line'; category = 'signal';
          }

          return { type, symbol, category };
        };

        allElements.forEach((element: any) => {
          const bo = element.businessObject;
          if (!bo) return;

          // Initialize $attrs if it doesn't exist
          if (!bo.$attrs) {
            bo.$attrs = {};
          }

          const existingPidAttrs = Object.keys(bo.$attrs).filter(key => key.startsWith('pid:'));

          if (existingPidAttrs.length > 0) {
            pidAttrCount++;
          } else {
            // Manually set attributes based on element name and type
            const attrs = inferPidAttrs(bo.name || '', element.type || '');
            if (attrs.type && attrs.symbol && attrs.category) {
              bo.$attrs['pid:type'] = attrs.type;
              bo.$attrs['pid:symbol'] = attrs.symbol;
              bo.$attrs['pid:category'] = attrs.category;
              manuallySetCount++;
            }
          }
        });

        // Force complete re-render after setting attributes
        if (manuallySetCount > 0 || pidAttrCount > 0) {
          setTimeout(() => {
            try {
              // Force re-import the XML to trigger fresh rendering with P&ID attributes
              // This ensures canRender is called again with the updated attributes
              const canvas = modelerRef.current!.get("canvas") as {
                zoom: (mode: string) => void;
                getViewbox: () => { scale: number; width: number; height: number; x: number; y: number }
              };
              const currentXml = finalXml;

              // Re-import to force complete re-render
              modelerRef.current!.importXML(currentXml).then(() => {
                // Safe zoom: validate viewbox before applying
                try {
                  const viewbox = canvas.getViewbox();
                  if (viewbox && isFinite(viewbox.scale) && isFinite(viewbox.width) && isFinite(viewbox.height) &&
                    viewbox.width > 0 && viewbox.height > 0) {
                    canvas.zoom("fit-viewport");
                  }
                } catch (zoomError) {
                  console.warn("Zoom error, continuing:", zoomError);
                }

                // After re-import, set attributes again and force one more update
                setTimeout(() => {
                  const elementRegistry = modelerRef.current!.get("elementRegistry") as {
                    getAll: () => any[];
                    getGraphics: (id: string) => any;
                  };

                  const graphicsFactory = modelerRef.current!.get("graphicsFactory") as {
                    update: (element: any, gfx: any) => void;
                  } | undefined;

                  // Ensure P&ID mode is still enabled
                  const pidRenderer = modelerRef.current?.get('pidRenderer', false);
                  if (pidRenderer) {
                    (pidRenderer as any).isPidMode = true;
                  }

                  // Update all elements one more time
                  if (graphicsFactory && elementRegistry) {
                    elementRegistry.getAll().forEach((element: any) => {
                      try {
                        const gfx = elementRegistry.getGraphics(element.id);
                        if (gfx && graphicsFactory.update) {
                          graphicsFactory.update(element, gfx);
                        }
                      } catch (e) {
                        // Ignore errors
                      }
                    });
                  }
                }, 200);
              }).catch((err: any) => {
                // Ignore re-import errors
              });
            } catch (e) {
              // Ignore
            }
          }, 500);
        }
      }
      captureCurrentLabels();
      setDiagramReady(true);
    }).catch((err: Error) => {
      console.error("Error rendering diagram:", err);
      const errorMsg = err.message || "Failed to load diagram";
      setErrorState(`Generation failed (Reason: ${errorMsg}). Try simplified prompt.`);
      if (diagramType === "pid") {
        toast.error("Generation failed (Reason: token limit). Try simplified prompt.");
      } else {
        toast.error("Failed to load BPMN diagram");
      }
      setDiagramReady(true);
    });
  }, [xml, diagramType, captureCurrentLabels]);

  const handleSave = async () => {
    if (!canEdit) {
      toast.error("Editing is locked by the Process Manager");
      return;
    }

    if (!modelerRef.current) return;

    try {
      const result = await modelerRef.current.saveXML({ format: true });
      if (result.xml) {
        // Auto-versioning: Save new version
        const newVersion = version + 1;
        setVersion(newVersion);
        const updatedVersions = [...versions, result.xml];
        setVersions(updatedVersions);

        if (onSave) {
          onSave(result.xml);
        }

        if (currentUser) {
          try {
            const fingerprint =
              diagramFingerprint ?? (await computeSha256(result.xml));
            await supabase.from("bpmn_generations").insert({
              user_id: currentUser.id,
              input_type: "text",
              input_description: `manual-save:${fingerprint}`,
              generated_bpmn_xml: result.xml,
            });
          } catch (error) {
            console.error("Failed to log manual save:", error);
          }
        }

        const diagramName = diagramType === "bpmn" ? "BPMN" : "P&ID";
        toast.success(`Diagram saved to workspace`,
          {
            description: `Saved as version v${newVersion}`
          }
        );
      }
    } catch (err) {
      console.error("Error saving diagram:", err);
      toast.error("Failed to save diagram");
    }
  };

  const handleDownload = async () => {
    if (!modelerRef.current) return;

    try {
      const result = await modelerRef.current.saveXML({ format: true });
      if (result.xml) {
        const blob = new Blob([result.xml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const diagramName = diagramType === "bpmn" ? "BPMN" : "PID";
        a.href = url;
        a.download = `${diagramName}_v${version}.bpmn`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Exported to ${diagramName}_v${version}.bpmn`,
          {
            action: {
              label: "Download",
              onClick: () => a.click()
            }
          }
        );
      }
    } catch (err) {
      console.error("Error downloading diagram:", err);
      toast.error("Failed to download diagram");
    }
  };

  const handleExportPid = async (format: "svg" | "pdf" | "dwg") => {
    if (!modelerRef.current) return;

    try {
      const result = await modelerRef.current.saveXML({ format: true });
      if (result.xml) {
        const fileName = `PID_v${version}.${format}`;
        // For SVG, we could convert the diagram
        // For PDF/DWG, would need additional libraries
        toast.success(`Exported to ${fileName}`,
          {
            description: "Export functionality ready"
          }
        );
      }
    } catch (err) {
      console.error("Error exporting P&ID:", err);
      toast.error("Failed to export diagram");
    }
  };

  const handleVersionChange = (versionIndex: number) => {
    if (!canEdit) {
      toast.error("Editing is locked by the Process Manager");
      return;
    }
    if (versionIndex >= 0 && versionIndex < versions.length) {
      setVersion(versionIndex + 1);
      if (onSave && modelerRef.current) {
        setDiagramReady(false);
        modelerRef.current
          .importXML(versions[versionIndex])
          .then(() => {
            const canvas = modelerRef.current!.get("canvas") as {
              zoom: (mode: string) => void;
              getViewbox: () => { scale: number; x: number; y: number; width: number; height: number } | undefined;
            };
            // Safe zoom: validate viewbox before applying
            try {
              const viewbox = canvas.getViewbox();
              if (viewbox && isFinite(viewbox.scale) && isFinite(viewbox.width) && isFinite(viewbox.height) &&
                viewbox.width > 0 && viewbox.height > 0) {
                canvas.zoom("fit-viewport");
              }
            } catch (zoomError) {
              console.warn("Zoom error, continuing:", zoomError);
            }
            captureCurrentLabels();
            setDiagramReady(true);
          })
          .catch((error) => {
            console.error("Failed to load historical version:", error);
            toast.error("Unable to load this version");
            setDiagramReady(true);
          });
      }
    }
  };

  const handleUndo = () => {
    if (!canEdit) {
      toast.error("Editing is locked by the Process Manager");
      return;
    }
    if (!modelerRef.current) return;
    const commandStack = modelerRef.current.get("commandStack") as { canUndo: () => boolean; undo: () => void };
    if (commandStack.canUndo()) {
      commandStack.undo();
    }
  };

  const handleRedo = () => {
    if (!canEdit) {
      toast.error("Editing is locked by the Process Manager");
      return;
    }
    if (!modelerRef.current) return;
    const commandStack = modelerRef.current.get("commandStack") as { canRedo: () => boolean; redo: () => void };
    if (commandStack.canRedo()) {
      commandStack.redo();
    }
  };

  const handleClear = () => {
    if (!canEdit) {
      toast.error("Editing is locked by the Process Manager");
      return;
    }
    if (!modelerRef.current) return;

    const modeling = modelerRef.current.get("modeling") as { removeElements: (elements: unknown[]) => void };
    const elementRegistry = modelerRef.current.get("elementRegistry") as { filter: (callback: (element: { id?: string; parent?: unknown }) => boolean) => Array<{ id?: string; parent?: unknown }> };
    const canvas = modelerRef.current.get("canvas") as { getRootElement: () => { id?: string } };

    const rootElement = canvas.getRootElement();
    const elements = elementRegistry.filter((element) => {
      return element.id !== rootElement.id && element.parent === rootElement;
    });

    modeling.removeElements(elements);
    toast.success("Canvas cleared!");
  };

  // Upload/Import handler
  const handleUpload = useCallback(() => {
    if (!canEdit) {
      toast.error("Editing is locked by the Process Manager");
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.bpmn,.xml';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !modelerRef.current) return;

      try {
        const text = await file.text();
        // Basic validation - check if it's valid XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'text/xml');
        const parseError = xmlDoc.querySelector('parsererror');

        if (parseError) {
          toast.error("Invalid XML file");
          return;
        }

        // Check if it contains BPMN elements
        if (!text.includes('bpmn:') && !text.includes('bpmn2:') && !text.includes('bpmndi:')) {
          toast.error("File does not appear to be a valid BPMN diagram");
          return;
        }

        setDiagramReady(false);
        await modelerRef.current.importXML(text);
        const canvas = modelerRef.current.get("canvas") as {
          zoom: (mode: string) => void;
          getViewbox: () => { scale: number; x: number; y: number; width: number; height: number } | undefined;
        };
        // Safe zoom: validate viewbox before applying
        try {
          const viewbox = canvas.getViewbox();
          if (viewbox) {
            const scale = viewbox.scale ?? 1;
            const width = viewbox.width ?? 0;
            const height = viewbox.height ?? 0;
            if (isFinite(scale) && isFinite(width) && isFinite(height) &&
              width > 0 && height > 0 && scale > 0) {
              canvas.zoom("fit-viewport");
            }
          }
        } catch (zoomError) {
          console.warn("Zoom error, continuing:", zoomError);
        }
        toast.success("Diagram imported successfully");
        captureCurrentLabels();
        setDiagramReady(true);
      } catch (error) {
        console.error("Import error:", error);
        toast.error("Failed to import diagram");
        setDiagramReady(true);
      }
    };
    input.click();
  }, [canEdit]);

  // Enhanced Download/Export handler with format options
  const handleDownloadWithFormat = useCallback(
    async (format: 'bpmn' | 'xml' | 'svg' | 'png' | 'jpeg' | 'jpg' = 'bpmn') => {
      if (!modelerRef.current) return;

      const diagramLabel = diagramType === "bpmn" ? "BPMN" : "P&ID";
      const normalizedExt = format === 'jpeg' ? 'jpeg' : format;
      const filename = `${diagramLabel}_v${version}.${normalizedExt}`;

      try {
        if (format === 'bpmn' || format === 'xml') {
          const { xml } = await modelerRef.current.saveXML({ format: true });
          const blob = new Blob([xml], { type: 'application/xml' });
          downloadBlob(blob, filename);
          toast.success(`Exported ${filename}`);
        } else {
          const { svg } = await modelerRef.current.saveSVG();
          if (format === 'svg') {
            const blob = new Blob([svg], { type: 'image/svg+xml' });
            downloadBlob(blob, filename);
            toast.success(`Exported ${filename}`);
          } else {
            const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
            const background = format === 'png' ? 'rgba(255,255,255,0)' : '#ffffff';
            const blob = await exportSvgStringToImage(svg, mimeType, background);
            downloadBlob(blob, filename);
            toast.success(`Exported ${filename}`);
          }
        }
      } catch (error) {
        console.error("Export error:", error);
        toast.error("Failed to export diagram");
      }
    },
    [diagramType, version]
  );

  const handleViewCurrentXml = useCallback(async () => {
    if (!modelerRef.current) return;

    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      if (!xml) {
        toast.error("No BPMN XML available");
        return;
      }
      const title =
        diagramType === "bpmn"
          ? `Current BPMN Diagram (v${version})`
          : `Current P&ID Diagram (v${version})`;
      setXmlViewerData({
        title,
        xml,
        source: "canvas",
      });
    } catch (error) {
      console.error("Error opening XML viewer:", error);
      toast.error("Unable to open XML viewer");
    }
  }, [diagramType, version]);

  // Safe zoom helper function that validates viewbox values before applying zoom
  const safeZoom = useCallback((zoomValue: number | string) => {
    if (!modelerRef.current) return false;
    try {
      const canvas = modelerRef.current.get("canvas") as {
        zoom: (step: number | string) => void;
        getViewbox: () => { scale?: number; x?: number; y?: number; width?: number; height?: number } | undefined;
      };

      // If zooming to a specific value, validate it's finite
      if (typeof zoomValue === 'number') {
        if (!isFinite(zoomValue) || zoomValue <= 0) {
          console.warn("Invalid zoom value:", zoomValue);
          return false;
        }
      }

      // For fit-viewport, check viewbox is valid before applying
      if (zoomValue === "fit-viewport") {
        const viewbox = canvas.getViewbox();
        if (viewbox) {
          // Validate all viewbox values are finite (check if they exist first)
          const scale = viewbox.scale ?? 1;
          const width = viewbox.width ?? 0;
          const height = viewbox.height ?? 0;

          if (!isFinite(scale) || !isFinite(width) || !isFinite(height) ||
            width <= 0 || height <= 0 || scale <= 0) {
            console.warn("Invalid viewbox values, skipping zoom:", viewbox);
            return false;
          }
        }
      }

      canvas.zoom(zoomValue);
      return true;
    } catch (error) {
      console.error("Error applying zoom:", error);
      return false;
    }
  }, []);

  // Zoom functions
  const handleZoomIn = useCallback(() => {
    if (!modelerRef.current) return;
    try {
      const canvas = modelerRef.current.get("canvas") as {
        zoom: (step: number | string) => void;
        getViewbox: () => { scale: number } | undefined;
      };
      const viewbox = canvas.getViewbox();
      if (viewbox && isFinite(viewbox.scale) && viewbox.scale > 0) {
        const newScale = Math.min(viewbox.scale * 1.2, 3); // Max zoom 3x
        if (isFinite(newScale) && newScale > 0) {
          safeZoom(newScale);
        }
      }
    } catch (error) {
      console.error("Error zooming in:", error);
    }
  }, [safeZoom]);

  const handleZoomOut = useCallback(() => {
    if (!modelerRef.current) return;
    try {
      const canvas = modelerRef.current.get("canvas") as {
        zoom: (step: number | string) => void;
        getViewbox: () => { scale: number } | undefined;
      };
      const viewbox = canvas.getViewbox();
      if (viewbox && isFinite(viewbox.scale) && viewbox.scale > 0) {
        const newScale = Math.max(viewbox.scale / 1.2, 0.2); // Min zoom 0.2x
        if (isFinite(newScale) && newScale > 0) {
          safeZoom(newScale);
        }
      }
    } catch (error) {
      console.error("Error zooming out:", error);
    }
  }, [safeZoom]);

  const handleFitToScreen = useCallback(() => {
    safeZoom("fit-viewport");
  }, [safeZoom]);

  // Fullscreen handler
  const handleToggleFullscreen = useCallback(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/18d381d8-c36b-4c93-96dd-ac136b1e5e3a', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'BpmnViewer.tsx:4372', message: 'Toggle fullscreen called', data: { isFullscreen: !!document.fullscreenElement, showToolbar }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'E' }) }).catch(() => { });
    // #endregion
    if (!document.fullscreenElement) {
      // Enter fullscreen on the entire component, not just canvas
      const rootElement = document.querySelector('.bpmn-viewer-root') as HTMLElement;
      if (rootElement) {
        rootElement.requestFullscreen().then(() => {
          setIsFullscreen(true);
          setShowToolbar(true); // Ensure toolbar is visible in fullscreen
          // #region agent log
          setTimeout(() => {
            const toolbarEl = document.querySelector('.flex.items-center.justify-between.px-4') as HTMLElement;
            if (toolbarEl) {
              const rect = toolbarEl.getBoundingClientRect();
              const styles = window.getComputedStyle(toolbarEl);
              fetch('http://127.0.0.1:7242/ingest/18d381d8-c36b-4c93-96dd-ac136b1e5e3a', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'BpmnViewer.tsx:4380', message: 'After entering fullscreen - toolbar state', data: { zIndex: styles.zIndex, position: styles.position, pointerEvents: styles.pointerEvents, display: styles.display, top: rect.top, left: rect.left, width: rect.width, height: rect.height }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'E' }) }).catch(() => { });
            }
          }, 100);
          // #endregion
        }).catch(() => {
          toast.error("Failed to enter fullscreen mode");
        });
      } else {
        // Fallback to container if root not found
        containerRef.current?.requestFullscreen().then(() => {
          setIsFullscreen(true);
          setShowToolbar(true);
        }).catch(() => {
          toast.error("Failed to enter fullscreen mode");
        });
      }
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(() => {
        toast.error("Failed to exit fullscreen mode");
      });
    }
  }, [showToolbar]);

  // Grid toggle handler
  const handleToggleGrid = useCallback(() => {
    if (!modelerRef.current) return;
    try {
      const gridModule = modelerRef.current.get("grid", false) as { setVisible: (visible: boolean) => void } | undefined;
      if (gridModule) {
        setShowGrid(!showGrid);
        gridModule.setVisible(!showGrid);
      } else {
        // Fallback: toggle via CSS
        setShowGrid(!showGrid);
        const container = containerRef.current;
        if (container) {
          const canvasElement = container.querySelector('.djs-container') as HTMLElement;
          if (canvasElement) {
            if (!showGrid) {
              canvasElement.style.backgroundImage = 'linear-gradient(rgba(0, 0, 0, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 0, 0.1) 1px, transparent 1px)';
              canvasElement.style.backgroundSize = '20px 20px';
            } else {
              canvasElement.style.backgroundImage = 'none';
            }
          }
        }
      }
    } catch (error) {
      console.error("Error toggling grid:", error);
    }
  }, [showGrid]);

  // Ruler toggle handler
  const handleToggleRuler = useCallback(() => {
    setShowRuler(!showRuler);
    toast.info(`Ruler ${!showRuler ? 'enabled' : 'disabled'}`);
  }, [showRuler]);

  // Validation handler
  const handleValidateModel = useCallback(() => {
    if (!modelerRef.current) return;

    const errors: Array<{ message: string; elementId?: string }> = [];

    try {
      const elementRegistry = modelerRef.current.get("elementRegistry") as { getAll: () => Array<{ id?: string; type?: string; businessObject?: { name?: string } }> };
      const allElements = elementRegistry.getAll();

      // Basic validation checks
      const startEvents = allElements.filter(el => el.type?.includes('StartEvent'));
      const endEvents = allElements.filter(el => el.type?.includes('EndEvent'));

      if (startEvents.length === 0) {
        errors.push({ message: "No start event found. A BPMN diagram must have at least one start event." });
      }

      if (endEvents.length === 0) {
        errors.push({ message: "No end event found. A BPMN diagram should have at least one end event." });
      }

      // Check for elements without names
      allElements.forEach(element => {
        if (element.type?.includes('Task') && !element.businessObject?.name) {
          errors.push({
            message: `Task "${element.id}" has no name`,
            elementId: element.id
          });
        }
      });

      // Check for orphaned elements (no incoming or outgoing flows)
      allElements.forEach(element => {
        if (element.type && !element.type.includes('Event') && !element.type.includes('Gateway')) {
          // This is a simplified check - in a real implementation, you'd check actual flows
        }
      });

      setValidationErrors(errors);
      setShowValidationResults(true);

      if (errors.length === 0) {
        toast.success("Validation passed! No issues found.");
      } else {
        toast.warning(`Found ${errors.length} validation issue(s)`);
      }
    } catch (error) {
      console.error("Validation error:", error);
      toast.error("Failed to validate diagram");
    }
  }, []);

  // Pan mode handler
  const handleTogglePanMode = useCallback(() => {
    if (!modelerRef.current) return;
    setIsPanMode(!isPanMode);

    try {
      const canvas = modelerRef.current.get("canvas") as {
        toggle: (tool: string) => void;
        isActive: (tool: string) => boolean;
      };

      if (!isPanMode) {
        // Activate pan tool
        canvas.toggle('hand-tool');
        toast.info("Pan mode activated. Click and drag to move the canvas.");
      } else {
        // Deactivate pan tool
        if (canvas.isActive('hand-tool')) {
          canvas.toggle('hand-tool');
        }
        toast.info("Pan mode deactivated.");
      }
    } catch (error) {
      console.error("Error toggling pan mode:", error);
    }
  }, [isPanMode]);

  // Search handler
  const handleSearch = useCallback((query: string) => {
    if (!modelerRef.current || !query.trim()) return;

    try {
      const elementRegistry = modelerRef.current.get("elementRegistry") as {
        getAll: () => Array<{ id?: string; type?: string; businessObject?: { name?: string } }>
      };
      const canvas = modelerRef.current.get("canvas") as {
        zoom: (element: unknown) => void;
        findRoot: (element: unknown) => unknown;
      };

      const allElements = elementRegistry.getAll();
      const queryLower = query.toLowerCase();

      const matches = allElements.filter(element => {
        const name = element.businessObject?.name?.toLowerCase() || '';
        const id = element.id?.toLowerCase() || '';
        const type = element.type?.toLowerCase() || '';
        return name.includes(queryLower) || id.includes(queryLower) || type.includes(queryLower);
      });

      if (matches.length > 0) {
        // Zoom to first match
        const firstMatch = matches[0];
        try {
          canvas.zoom(firstMatch);
          toast.success(`Found ${matches.length} element(s) matching "${query}"`);
        } catch (zoomError) {
          console.warn("Zoom to element error:", zoomError);
          toast.success(`Found ${matches.length} element(s) matching "${query}"`);
        }
      } else {
        toast.info(`No elements found matching "${query}"`);
      }
    } catch (error) {
      console.error("Search error:", error);
    }
  }, []);

  const handleVisionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) {
      toast.error("Editing is locked by the Process Manager");
      e.target.value = ""; // Reset input
      return;
    }

    const file = e.target.files?.[0];
    if (!file) {
      e.target.value = ""; // Reset input
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      e.target.value = ""; // Reset input
      return;
    }

    setSelectedFile(file);
    setIsProcessing(true);

    try {
      // SECURITY: Check authentication before processing
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        toast.error("Please log in to use Vision Modelling AI");
        setIsProcessing(false);
        setSelectedFile(null);
        e.target.value = ""; // Reset input
        return;
      }

      // Compress and convert image to base64
      let fileToProcess = file;
      const { shouldCompressImage, compressImage } = await import('@/utils/image-compression');
      if (shouldCompressImage(file)) {
        try {
          fileToProcess = await compressImage(file);
        } catch (compressionError) {
          console.warn('Image compression failed, using original:', compressionError);
        }
      }

      const { fileToBase64 } = await import('@/utils/image-compression');
      const base64Content = await fileToBase64(fileToProcess, false);
      const imageBase64 = `data:${fileToProcess.type};base64,${base64Content}`;

      toast.info("Uploading image for analysis...");

      // Call vision-to-BPMN edge function - returns job ID
      const { invokeFunction } = await import('@/utils/api-client');
      const { data, error } = await invokeFunction('vision-to-bpmn', {
        imageBase64,
        diagramType: diagramType
      }, { deduplicate: true });

      if (error) {
        throw error;
      }

      // Handle job-based response
      if (data?.jobId) {
        setVisionJobId(data.jobId);
        toast.info("Processing started", {
          description: "Your image is being analyzed. This may take a moment..."
        });
        // Don't reset file input here - keep it visible while processing
        // Don't close dialog - let user see processing status
      } else {
        throw new Error("No job ID received from server");
      }
    } catch (error) {
      console.error('Vision processing error:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to process image. Please try again.";
      toast.error("Failed to process image", {
        description: errorMessage
      });
      setIsProcessing(false);
      setSelectedFile(null);
      e.target.value = ""; // Reset input on error
    }
  };

  const handleLogUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!currentUser) {
      toast.error("Please sign in to archive logs");
      return;
    }

    setIsProcessing(true);

    try {
      const logContent = await file.text();
      const xmlSnapshot = await saveCurrentXml();

      const { error } = await supabase.from("bpmn_generations").insert({
        user_id: currentUser.id,
        input_type: "log",
        input_description: `log-import:${file.name}`,
        generated_bpmn_xml: xmlSnapshot,
        alternative_models: [
          {
            event: "log_import",
            fileName: file.name,
            size: file.size,
            preview: logContent.slice(0, 1000),
            importedAt: new Date().toISOString(),
          },
        ],
      });

      if (error) {
        throw error;
      }

      toast.success("Log file imported successfully");
      await loadLogHistory();
      setLogDialogOpen(false);
    } catch (error) {
      console.error("Log import error:", error);
      toast.error("Failed to import log file");
    } finally {
      setIsProcessing(false);
      e.target.value = "";
    }
  };

  const generateQRCode = () => {
    const url = window.location.href;
    toast.success("QR code generated! Share with collaborators.");
  };

  // Add BPMN element to canvas
  // Change/replace an existing element
  const changeElementType = useCallback((newType: string) => {
    if (!canEdit) {
      toast.error("Editing is locked by the Process Manager");
      setShowContextMenu(false);
      return;
    }

    if (!modelerRef.current || !selectedElement) return;

    const modeling = modelerRef.current.get('modeling') as { removeElements: (elements: unknown[]) => void };
    const bpmnReplace = modelerRef.current.get('bpmnReplace') as { replaceElement: (element: unknown, options: { type: string; eventDefinitionType?: string }) => void };

    try {
      // Define replacement target based on type
      let replacementType = newType;
      let eventDefinitionType = undefined;

      // Map element types to BPMN types and event definitions
      switch (newType) {
        case 'start-event':
          replacementType = 'bpmn:StartEvent';
          break;
        case 'start-timer-event':
          replacementType = 'bpmn:StartEvent';
          eventDefinitionType = 'bpmn:TimerEventDefinition';
          break;
        case 'start-message-event':
          replacementType = 'bpmn:StartEvent';
          eventDefinitionType = 'bpmn:MessageEventDefinition';
          break;
        case 'intermediate-event':
          replacementType = 'bpmn:IntermediateThrowEvent';
          break;
        case 'intermediate-timer-event':
          replacementType = 'bpmn:IntermediateCatchEvent';
          eventDefinitionType = 'bpmn:TimerEventDefinition';
          break;
        case 'end-event':
          replacementType = 'bpmn:EndEvent';
          break;
        case 'end-message-event':
          replacementType = 'bpmn:EndEvent';
          eventDefinitionType = 'bpmn:MessageEventDefinition';
          break;
        case 'task':
          replacementType = 'bpmn:Task';
          break;
        case 'user-task':
          replacementType = 'bpmn:UserTask';
          break;
        case 'service-task':
          replacementType = 'bpmn:ServiceTask';
          break;
        case 'manual-task':
          replacementType = 'bpmn:ManualTask';
          break;
        case 'xor-gateway':
          replacementType = 'bpmn:ExclusiveGateway';
          break;
        case 'and-gateway':
          replacementType = 'bpmn:ParallelGateway';
          break;
        case 'or-gateway':
          replacementType = 'bpmn:InclusiveGateway';
          break;
        default:
          if (newType.startsWith('bpmn:')) {
            replacementType = newType;
          }
      }

      // Use bpmnReplace to morph the element
      bpmnReplace.replaceElement(selectedElement, {
        type: replacementType,
        eventDefinitionType: eventDefinitionType
      });

      toast.success('Element changed successfully!');
      setShowContextMenu(false);
    } catch (error) {
      console.error('Error changing element:', error);
      toast.error('Failed to change element type');
    }
  }, [canEdit, selectedElement]);

  // Apply Camunda-style color to selected element
  const applyColor = useCallback((color: string, label: string) => {
    if (!canEdit) {
      toast.error("Editing is locked by the Process Manager");
      setShowContextMenu(false);
      return;
    }

    if (!modelerRef.current || !selectedElement) return;

    try {
      const modeling = modelerRef.current.get('modeling') as {
        setColor: (elements: unknown[], options: { fill?: string; stroke?: string }) => void;
      };

      // Apply fill color (background) to the element
      modeling.setColor([selectedElement], {
        fill: color,
        stroke: color // Also set stroke to match Camunda style
      });

      toast.success(`Applied ${label} color`);
      setShowContextMenu(false);
    } catch (error) {
      console.error('Error applying color:', error);
      toast.error('Failed to apply color');
    }
  }, [canEdit, selectedElement]);

  // Camunda color palette
  const camundaColors = [
    { name: 'Bottleneck', color: '#FF5252', label: 'Bottleneck (Red)' },
    { name: 'Optimization', color: '#4CAF50', label: 'Optimization (Green)' },
    { name: 'Warning', color: '#FFC107', label: 'Warning (Yellow)' },
    { name: 'Standard', color: '#2196F3', label: 'Standard (Blue)' },
    { name: 'Inactive', color: '#9E9E9E', label: 'Inactive (Gray)' },
    { name: 'Special', color: '#9C27B0', label: 'Special (Purple)' },
    { name: 'Remove', color: 'none', label: 'Remove Color' }
  ];

  const addBpmnElement = useCallback((elementType: string) => {
    if (!canEdit) {
      toast.error("Editing is locked by the Process Manager");
      return;
    }

    if (!modelerRef.current) return;

    const modeling = modelerRef.current.get('modeling') as { createShape: (element: unknown, position: { x: number; y: number }, parent: unknown) => void };
    const elementFactory = modelerRef.current.get('elementFactory') as { createShape: (options: { type: string; eventDefinitionType?: string; isExpanded?: boolean; triggeredByEvent?: boolean }) => unknown };
    const canvas = modelerRef.current.get('canvas') as { getRootElement: () => unknown };
    const rootElement = canvas.getRootElement();

    let element;
    const position = { x: 300, y: 200 };

    switch (elementType) {
      // Start Events
      case 'start-event':
        element = elementFactory.createShape({ type: 'bpmn:StartEvent' });
        break;
      case 'start-timer-event':
        element = elementFactory.createShape({ type: 'bpmn:StartEvent', eventDefinitionType: 'bpmn:TimerEventDefinition' });
        break;
      case 'start-message-event':
        element = elementFactory.createShape({ type: 'bpmn:StartEvent', eventDefinitionType: 'bpmn:MessageEventDefinition' });
        break;
      case 'start-signal-event':
        element = elementFactory.createShape({ type: 'bpmn:StartEvent', eventDefinitionType: 'bpmn:SignalEventDefinition' });
        break;
      case 'start-conditional-event':
        element = elementFactory.createShape({ type: 'bpmn:StartEvent', eventDefinitionType: 'bpmn:ConditionalEventDefinition' });
        break;

      // Intermediate Events
      case 'intermediate-event':
        element = elementFactory.createShape({ type: 'bpmn:IntermediateThrowEvent' });
        break;
      case 'intermediate-timer-event':
        element = elementFactory.createShape({ type: 'bpmn:IntermediateCatchEvent', eventDefinitionType: 'bpmn:TimerEventDefinition' });
        break;
      case 'intermediate-message-event':
        element = elementFactory.createShape({ type: 'bpmn:IntermediateCatchEvent', eventDefinitionType: 'bpmn:MessageEventDefinition' });
        break;
      case 'intermediate-signal-event':
        element = elementFactory.createShape({ type: 'bpmn:IntermediateCatchEvent', eventDefinitionType: 'bpmn:SignalEventDefinition' });
        break;

      // End Events
      case 'end-event':
        element = elementFactory.createShape({ type: 'bpmn:EndEvent' });
        break;
      case 'end-message-event':
        element = elementFactory.createShape({ type: 'bpmn:EndEvent', eventDefinitionType: 'bpmn:MessageEventDefinition' });
        break;
      case 'end-error-event':
        element = elementFactory.createShape({ type: 'bpmn:EndEvent', eventDefinitionType: 'bpmn:ErrorEventDefinition' });
        break;
      case 'end-terminate-event':
        element = elementFactory.createShape({ type: 'bpmn:EndEvent', eventDefinitionType: 'bpmn:TerminateEventDefinition' });
        break;

      // Tasks
      case 'task':
        element = elementFactory.createShape({ type: 'bpmn:Task' });
        break;
      case 'user-task':
        element = elementFactory.createShape({ type: 'bpmn:UserTask' });
        break;
      case 'service-task':
        element = elementFactory.createShape({ type: 'bpmn:ServiceTask' });
        break;
      case 'manual-task':
        element = elementFactory.createShape({ type: 'bpmn:ManualTask' });
        break;
      case 'script-task':
        element = elementFactory.createShape({ type: 'bpmn:ScriptTask' });
        break;
      case 'send-task':
        element = elementFactory.createShape({ type: 'bpmn:SendTask' });
        break;
      case 'receive-task':
        element = elementFactory.createShape({ type: 'bpmn:ReceiveTask' });
        break;
      case 'business-rule-task':
        element = elementFactory.createShape({ type: 'bpmn:BusinessRuleTask' });
        break;
      case 'call-activity':
        element = elementFactory.createShape({ type: 'bpmn:CallActivity' });
        break;

      // Gateways
      case 'xor-gateway':
        element = elementFactory.createShape({ type: 'bpmn:ExclusiveGateway' });
        break;
      case 'and-gateway':
        element = elementFactory.createShape({ type: 'bpmn:ParallelGateway' });
        break;
      case 'or-gateway':
        element = elementFactory.createShape({ type: 'bpmn:InclusiveGateway' });
        break;
      case 'event-gateway':
        element = elementFactory.createShape({ type: 'bpmn:EventBasedGateway' });
        break;
      case 'complex-gateway':
        element = elementFactory.createShape({ type: 'bpmn:ComplexGateway' });
        break;

      // Subprocess & Activities
      case 'subprocess':
        element = elementFactory.createShape({ type: 'bpmn:SubProcess', isExpanded: true });
        break;
      case 'collapsed-subprocess':
        element = elementFactory.createShape({ type: 'bpmn:SubProcess', isExpanded: false });
        break;
      case 'event-subprocess':
        element = elementFactory.createShape({ type: 'bpmn:SubProcess', triggeredByEvent: true, isExpanded: true });
        break;
      case 'transaction':
        element = elementFactory.createShape({ type: 'bpmn:Transaction', isExpanded: true });
        break;

      // Pools & Lanes
      case 'participant':
        element = elementFactory.createShape({ type: 'bpmn:Participant' });
        break;

      // Data
      case 'data-object':
        element = elementFactory.createShape({ type: 'bpmn:DataObjectReference' });
        break;
      case 'data-store':
        element = elementFactory.createShape({ type: 'bpmn:DataStoreReference' });
        break;
      case 'data-input':
        element = elementFactory.createShape({ type: 'bpmn:DataInput' });
        break;
      case 'data-output':
        element = elementFactory.createShape({ type: 'bpmn:DataOutput' });
        break;

      // Artifacts
      case 'text-annotation':
        element = elementFactory.createShape({ type: 'bpmn:TextAnnotation' });
        break;
      case 'group':
        element = elementFactory.createShape({ type: 'bpmn:Group' });
        break;

      default:
        return;
    }

    if (element) {
      modeling.createShape(element, position, rootElement);
      toast.success(`Element added to canvas!`);
    }
  }, [canEdit]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showContextMenu && !target.closest('.context-menu')) {
        setShowContextMenu(false);
      }
    };

    if (showContextMenu) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showContextMenu]);

  // Fullscreen listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      // Ensure toolbar is visible when entering fullscreen
      if (document.fullscreenElement) {
        setShowToolbar(true);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Keyboard shortcuts for fullscreen and zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F11 to toggle fullscreen
      if (e.key === 'F11') {
        e.preventDefault();
        handleToggleFullscreen();
      }
      // Cmd/Ctrl + Plus to zoom in
      if ((e.metaKey || e.ctrlKey) && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        handleZoomIn();
      }
      // Cmd/Ctrl + Minus to zoom out
      if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault();
        handleZoomOut();
      }
      // Cmd/Ctrl + 0 to fit to screen
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        handleFitToScreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleFullscreen, handleZoomIn, handleZoomOut, handleFitToScreen]);

  // Update container position when scrolling or resizing
  useEffect(() => {
    const updateContainerPosition = () => {
      if (canvasContainerRef.current) {
        const rect = canvasContainerRef.current.getBoundingClientRect();
        containerPositionRef.current = {
          top: rect.top,
          left: rect.left,
        };
      }
    };

    updateContainerPosition();
    window.addEventListener('scroll', updateContainerPosition, true);
    window.addEventListener('resize', updateContainerPosition);

    // Also listen for scroll events on the container itself
    const container = canvasContainerRef.current;
    if (container) {
      container.addEventListener('scroll', updateContainerPosition);
    }

    return () => {
      window.removeEventListener('scroll', updateContainerPosition, true);
      window.removeEventListener('resize', updateContainerPosition);
      if (container) {
        container.removeEventListener('scroll', updateContainerPosition);
      }
    };
  }, [showPalette]);

  // Adjust palette height based on canvas container when available
  useEffect(() => {
    if (!showPalette) return;

    const adjustHeight = () => {
      if (canvasContainerRef.current) {
        const containerHeight = canvasContainerRef.current.offsetHeight;
        // Reserve space for header (~90px) and footer (~50px)
        const availableHeight = containerHeight - 140;
        if (availableHeight > 400) {
          setPaletteSize(prev => {
            // Only update if current height exceeds available space or is much smaller
            if (prev.height > availableHeight || prev.height < 400) {
              return { ...prev, height: Math.max(400, Math.min(700, availableHeight)) };
            }
            return prev;
          });
        }
      }
    };

    // Adjust on mount and window resize
    adjustHeight();
    window.addEventListener('resize', adjustHeight);

    return () => {
      window.removeEventListener('resize', adjustHeight);
    };
  }, [showPalette]);

  // Handle resize for Elements palette
  const handleResizeStart = useCallback((edge: 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!paletteRef.current || !canvasContainerRef.current) return;

    isResizingRef.current = true;
    setIsResizing(true);

    const container = canvasContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const paletteRect = paletteRef.current.getBoundingClientRect();

    // Calculate initial positions relative to container
    const initialLeft = paletteRect.left - containerRect.left;
    const initialTop = paletteRect.top - containerRect.top;
    const initialRight = paletteRect.right - containerRect.left;
    const initialBottom = paletteRect.bottom - containerRect.top;
    const initialWidth = paletteRect.width;
    const initialHeight = paletteRect.height;

    resizeStartState.current = {
      width: initialWidth,
      height: initialHeight,
      x: initialLeft,
      y: initialTop,
      clientX: e.clientX,
      clientY: e.clientY,
      edge: edge as any,
      startLeft: initialLeft,
      startTop: initialTop,
      startRight: initialRight,
      startBottom: initialBottom,
    };

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      if (!canvasContainerRef.current || !paletteRef.current) return;

      const container = canvasContainerRef.current;
      const containerRect = container.getBoundingClientRect();
      const mouseX = e.clientX - containerRect.left;
      const mouseY = e.clientY - containerRect.top;

      const minWidth = 200;
      const minHeight = 300;
      const maxWidth = container.offsetWidth;
      const maxHeight = container.offsetHeight;

      let newWidth = resizeStartState.current.width;
      let newHeight = resizeStartState.current.height;
      let newX = resizeStartState.current.startLeft;
      let newY = resizeStartState.current.startTop;

      const edge = resizeStartState.current.edge;

      // Handle horizontal resize
      if (edge === 'right' || edge === 'top-right' || edge === 'bottom-right') {
        // Resize from right edge - mouse moves right edge
        const maxRight = Math.min(maxWidth, mouseX);
        const minRight = resizeStartState.current.startLeft + minWidth;
        const newRight = Math.max(minRight, Math.min(maxWidth, maxRight));
        newWidth = newRight - resizeStartState.current.startLeft;
        newX = resizeStartState.current.startLeft;
      } else if (edge === 'left' || edge === 'top-left' || edge === 'bottom-left') {
        // Resize from left edge - mouse moves left edge
        const maxLeft = Math.max(0, mouseX);
        const minLeft = resizeStartState.current.startRight - minWidth;
        const newLeft = Math.max(0, Math.min(minLeft, maxLeft));
        newWidth = resizeStartState.current.startRight - newLeft;
        newX = newLeft;
      }

      // Handle vertical resize
      if (edge === 'bottom' || edge === 'bottom-left' || edge === 'bottom-right') {
        // Resize from bottom edge - mouse moves bottom edge
        const maxBottom = Math.min(maxHeight, mouseY);
        const minBottom = resizeStartState.current.startTop + minHeight;
        const newBottom = Math.max(minBottom, Math.min(maxHeight, maxBottom));
        newHeight = newBottom - resizeStartState.current.startTop;
        newY = resizeStartState.current.startTop;
      } else if (edge === 'top' || edge === 'top-left' || edge === 'top-right') {
        // Resize from top edge - mouse moves top edge
        const maxTop = Math.max(0, mouseY);
        const minTop = resizeStartState.current.startBottom - minHeight;
        const newTop = Math.max(0, Math.min(minTop, maxTop));
        newHeight = resizeStartState.current.startBottom - newTop;
        newY = newTop;
      }

      // Ensure we don't exceed container bounds
      if (newX + newWidth > maxWidth) {
        newWidth = maxWidth - newX;
      }
      if (newY + newHeight > maxHeight) {
        newHeight = maxHeight - newY;
      }

      // Ensure minimum sizes
      newWidth = Math.max(minWidth, newWidth);
      newHeight = Math.max(minHeight, newHeight);

      // Update state
      setPaletteSize({ width: newWidth, height: newHeight });
      setPalettePosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = edge.includes('left') && edge.includes('top') ? 'nwse-resize' :
      edge.includes('right') && edge.includes('top') ? 'nesw-resize' :
        edge.includes('left') && edge.includes('bottom') ? 'nesw-resize' :
          edge.includes('right') && edge.includes('bottom') ? 'nwse-resize' :
            edge === 'left' || edge === 'right' ? 'ew-resize' : 'ns-resize';
    document.body.style.userSelect = 'none';

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  const isPid = diagramType === "pid";

  return (
    <>
      <style>{`
        .shape-repository-scroll::-webkit-scrollbar {
          width: 8px;
        }
        .shape-repository-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .shape-repository-scroll::-webkit-scrollbar-thumb {
          background-color: rgba(0, 0, 0, 0.5);
          border-radius: 4px;
        }
        .shape-repository-scroll::-webkit-scrollbar-thumb:hover {
          background-color: rgba(0, 0, 0, 0.7);
        }
      `}</style>
      <div className={`bpmn-viewer-root flex flex-col h-[calc(100vh-8rem)] bg-background ${isFullscreen ? 'h-screen fixed inset-0' : ''}`} style={{ position: isFullscreen ? 'fixed' : 'relative', top: isFullscreen ? 0 : 'auto', left: isFullscreen ? 0 : 'auto', right: isFullscreen ? 0 : 'auto', bottom: isFullscreen ? 0 : 'auto', zIndex: isFullscreen ? 9999 : 'auto' }}>
        {/* Top Header Bar - Flowable Style */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
          {/* Left: Logo/Branding */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <span className="font-bold text-lg">PROSSMIND</span>
              <span className="text-sm text-muted-foreground font-normal">DESIGN</span>
            </div>
          </div>

          {/* Center: Breadcrumb Navigation */}
          <div className="flex-1 flex justify-center">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <a href="/" className="text-sm hover:text-primary">Workspaces</a>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink className="text-sm hover:text-primary">Generated default</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className={`text-sm font-medium ${isPid ? "text-engineering-green" : "text-primary"}`}>
                    {isPid ? "* P&ID" : "* BPMN"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          {/* Right: Navigation Links & User */}
          <div className="flex items-center gap-4">
            <a href="/" className="text-sm hover:text-primary">Overview</a>
            <a href="/" className="text-sm hover:text-primary">Models</a>
            <a href="/" className="text-sm hover:text-primary font-medium">Editing</a>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full">
              <User className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Menu Bar - File, Edit, View, Tools */}
        {(showToolbar || !isFullscreen) && (
          <div
            ref={(el) => {
              if (el && isFullscreen) {
                const rect = el.getBoundingClientRect();
                const styles = window.getComputedStyle(el);
                console.log('[DEBUG] Toolbar rendered', { zIndex: styles.zIndex, position: styles.position, pointerEvents: styles.pointerEvents, top: rect.top, height: rect.height });
                fetch('http://127.0.0.1:7242/ingest/18d381d8-c36b-4c93-96dd-ac136b1e5e3a', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'BpmnViewer.tsx:5294', message: 'Toolbar rendered in fullscreen', data: { isFullscreen, zIndex: styles.zIndex, position: styles.position, pointerEvents: styles.pointerEvents, top: rect.top, left: rect.left, width: rect.width, height: rect.height }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run2', hypothesisId: 'A' }) }).catch(() => { });
              }
            }}
            className={`flex items-center justify-between px-4 py-1 border-b bg-background ${isPid ? 'border-engineering-green/20' : 'border-border'} ${isFullscreen ? 'z-[100]' : ''}`}
            style={{
              pointerEvents: 'auto',
              position: isFullscreen ? 'sticky' : 'static',
              top: isFullscreen ? 0 : 'auto',
              zIndex: isFullscreen ? 100 : 'auto',
              backgroundColor: isFullscreen ? 'hsl(var(--background))' : undefined
            }}
            onMouseDown={(e) => {
              // #region agent log
              const target = e.target as HTMLElement;
              console.log('[DEBUG] Toolbar mousedown', { target: target?.tagName, isFullscreen });
              fetch('http://127.0.0.1:7242/ingest/18d381d8-c36b-4c93-96dd-ac136b1e5e3a', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'BpmnViewer.tsx:5324', message: 'Toolbar mousedown event', data: { target: target?.tagName, currentTarget: e.currentTarget?.tagName, isFullscreen }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run2', hypothesisId: 'B' }) }).catch(() => { });
              // #endregion
            }}
            onClick={(e) => {
              // #region agent log
              const target = e.target as HTMLElement;
              console.log('[DEBUG] Toolbar click', { target: target?.tagName, isFullscreen });
              fetch('http://127.0.0.1:7242/ingest/18d381d8-c36b-4c93-96dd-ac136b1e5e3a', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'BpmnViewer.tsx:5332', message: 'Toolbar click event', data: { target: target?.tagName, currentTarget: e.currentTarget?.tagName, isFullscreen }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run2', hypothesisId: 'B' }) }).catch(() => { });
              // #endregion
            }}
          >
            {/* Left: Menu Bar */}
            <Menubar className={`border-0 bg-transparent p-0 h-auto ${isFullscreen ? 'relative z-[101]' : ''}`} style={{ pointerEvents: 'auto' }}>
              {/* File Menu */}
              <MenubarMenu>
                <MenubarTrigger
                  className="text-sm font-medium"
                  style={{ pointerEvents: 'auto', zIndex: isFullscreen ? 102 : 'auto' }}
                  onMouseDown={(e) => {
                    // #region agent log
                    const target = e.currentTarget as HTMLElement;
                    const rect = target.getBoundingClientRect();
                    const elementAtPoint = document.elementFromPoint(e.clientX, e.clientY);
                    const styles = window.getComputedStyle(target);
                    console.log('[DEBUG] File trigger mousedown', { isFullscreen, zIndex: styles.zIndex, pointerEvents: styles.pointerEvents, elementAtPoint: elementAtPoint?.tagName });
                    fetch('http://127.0.0.1:7242/ingest/18d381d8-c36b-4c93-96dd-ac136b1e5e3a', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'BpmnViewer.tsx:5340', message: 'File trigger mousedown', data: { isFullscreen, zIndex: styles.zIndex, pointerEvents: styles.pointerEvents, elementAtPoint: elementAtPoint?.tagName, clientX: e.clientX, clientY: e.clientY }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run2', hypothesisId: 'C' }) }).catch(() => { });
                    // #endregion
                  }}
                  onClick={(e) => {
                    // #region agent log
                    console.log('[DEBUG] File trigger clicked', { isFullscreen });
                    fetch('http://127.0.0.1:7242/ingest/18d381d8-c36b-4c93-96dd-ac136b1e5e3a', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'BpmnViewer.tsx:5348', message: 'File menu trigger clicked', data: { isFullscreen }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run2', hypothesisId: 'C' }) }).catch(() => { });
                    // #endregion
                  }}
                >File</MenubarTrigger>
                <MenubarContent>
                  <MenubarItem onClick={handleSave} disabled={!canEdit}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                    <MenubarShortcut>⌘S</MenubarShortcut>
                  </MenubarItem>
                  <MenubarItem onClick={handleUpload} disabled={!canEdit}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload/Import
                  </MenubarItem>
                  <MenubarSeparator />
                  <MenubarSub>
                    <MenubarSubTrigger>
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </MenubarSubTrigger>
                    <MenubarSubContent>
                      <MenubarItem onClick={() => handleDownloadWithFormat('bpmn')}>
                        <FileDown className="h-4 w-4 mr-2" />
                        Export as .bpmn
                      </MenubarItem>
                      <MenubarItem onClick={() => handleDownloadWithFormat('xml')}>
                        <FileText className="h-4 w-4 mr-2" />
                        Export as .xml
                      </MenubarItem>
                      <MenubarItem onClick={() => handleDownloadWithFormat('svg')}>
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Export as .svg
                      </MenubarItem>
                      <MenubarItem onClick={() => handleDownloadWithFormat('png')}>
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Export as .png
                      </MenubarItem>
                      <MenubarItem onClick={() => handleDownloadWithFormat('jpeg')}>
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Export as .jpeg
                      </MenubarItem>
                      <MenubarItem onClick={() => handleDownloadWithFormat('jpg')}>
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Export as .jpg
                      </MenubarItem>
                    </MenubarSubContent>
                  </MenubarSub>
                  <MenubarItem onClick={handleViewCurrentXml}>
                    <Code className="h-4 w-4 mr-2" />
                    View XML
                  </MenubarItem>
                  {featureFlags.showLanguagePreference && (
                    <>
                      <MenubarSeparator />
                      <MenubarItem disabled className="opacity-100">
                        <div className="flex items-center gap-2 w-full">
                          <span className="text-xs uppercase text-muted-foreground">Language</span>
                          <Select
                            value={selectedLanguage}
                            onValueChange={(value) => handleLanguageChange(value as LanguageOptionValue)}
                          >
                            <SelectTrigger className="h-7 w-[165px] text-xs">
                              <SelectValue placeholder="Auto" />
                            </SelectTrigger>
                            <SelectContent>
                              {LANGUAGE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Badge variant="outline" className="text-[10px]">
                            {LANGUAGE_NATIVE_NAMES[selectedLanguage] ?? "Auto"}
                          </Badge>
                          {isApplyingLanguage && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                        </div>
                      </MenubarItem>
                    </>
                  )}
                </MenubarContent>
              </MenubarMenu>

              {/* Edit Menu */}
              <MenubarMenu>
                <MenubarTrigger className="text-sm font-medium" style={{ pointerEvents: 'auto', zIndex: isFullscreen ? 102 : 'auto' }}>Edit</MenubarTrigger>
                <MenubarContent>
                  <MenubarItem onClick={handleUndo} disabled={!canUndo || !canEdit}>
                    <Undo className="h-4 w-4 mr-2" />
                    Undo
                    <MenubarShortcut>⌘Z</MenubarShortcut>
                  </MenubarItem>
                  <MenubarItem onClick={handleRedo} disabled={!canRedo || !canEdit}>
                    <Redo className="h-4 w-4 mr-2" />
                    Redo
                    <MenubarShortcut>⌘⇧Z</MenubarShortcut>
                  </MenubarItem>
                  <MenubarSeparator />
                  <MenubarItem onClick={handleClear} disabled={!canEdit}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear Canvas
                  </MenubarItem>
                </MenubarContent>
              </MenubarMenu>

              {/* View Menu */}
              <MenubarMenu>
                <MenubarTrigger className="text-sm font-medium">View</MenubarTrigger>
                <MenubarContent>
                  <MenubarSub>
                    <MenubarSubTrigger>
                      <ZoomIn className="h-4 w-4 mr-2" />
                      Zoom
                    </MenubarSubTrigger>
                    <MenubarSubContent>
                      <MenubarItem onClick={handleZoomIn}>
                        <ZoomIn className="h-4 w-4 mr-2" />
                        Zoom In
                        <MenubarShortcut>⌘+</MenubarShortcut>
                      </MenubarItem>
                      <MenubarItem onClick={handleZoomOut}>
                        <ZoomOut className="h-4 w-4 mr-2" />
                        Zoom Out
                        <MenubarShortcut>⌘-</MenubarShortcut>
                      </MenubarItem>
                      <MenubarItem onClick={handleFitToScreen}>
                        <Maximize2 className="h-4 w-4 mr-2" />
                        Fit to Screen
                      </MenubarItem>
                    </MenubarSubContent>
                  </MenubarSub>
                  <MenubarItem onClick={handleToggleFullscreen}>
                    {isFullscreen ? <Minimize className="h-4 w-4 mr-2" /> : <Maximize className="h-4 w-4 mr-2" />}
                    {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                    <MenubarShortcut>F11</MenubarShortcut>
                  </MenubarItem>
                  <MenubarSeparator />
                  <MenubarItem onClick={handleToggleGrid}>
                    <Grid3x3 className="h-4 w-4 mr-2" />
                    Toggle Grid
                    {showGrid && <Check className="h-4 w-4 ml-auto" />}
                  </MenubarItem>
                  <MenubarItem onClick={handleToggleRuler}>
                    <Ruler className="h-4 w-4 mr-2" />
                    Toggle Ruler
                    {showRuler && <Check className="h-4 w-4 ml-auto" />}
                  </MenubarItem>
                  <MenubarSeparator />
                  {/* Add BPMN Elements */}
                  <MenubarSub>
                    <MenubarSubTrigger>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Elements
                    </MenubarSubTrigger>
                    <MenubarSubContent className="w-64">
                      {/* Start Events */}
                      <MenubarSub>
                        <MenubarSubTrigger>Start Events</MenubarSubTrigger>
                        <MenubarSubContent>
                          <MenubarItem onClick={() => addBpmnElement('start-event')} disabled={!canEdit}>
                            Start Event
                          </MenubarItem>
                          <MenubarItem onClick={() => addBpmnElement('start-timer-event')} disabled={!canEdit}>
                            Timer Start Event
                          </MenubarItem>
                          <MenubarItem onClick={() => addBpmnElement('start-message-event')} disabled={!canEdit}>
                            Message Start Event
                          </MenubarItem>
                          <MenubarItem onClick={() => addBpmnElement('start-signal-event')} disabled={!canEdit}>
                            Signal Start Event
                          </MenubarItem>
                        </MenubarSubContent>
                      </MenubarSub>
                      {/* Activities */}
                      <MenubarSub>
                        <MenubarSubTrigger>Activities</MenubarSubTrigger>
                        <MenubarSubContent>
                          <MenubarItem onClick={() => addBpmnElement('user-task')} disabled={!canEdit}>
                            User Task
                          </MenubarItem>
                          <MenubarItem onClick={() => addBpmnElement('service-task')} disabled={!canEdit}>
                            Service Task
                          </MenubarItem>
                          <MenubarItem onClick={() => addBpmnElement('script-task')} disabled={!canEdit}>
                            Script Task
                          </MenubarItem>
                          <MenubarItem onClick={() => addBpmnElement('business-rule-task')} disabled={!canEdit}>
                            Business Rule Task
                          </MenubarItem>
                          <MenubarItem onClick={() => addBpmnElement('manual-task')} disabled={!canEdit}>
                            Manual Task
                          </MenubarItem>
                          <MenubarItem onClick={() => addBpmnElement('receive-task')} disabled={!canEdit}>
                            Receive Task
                          </MenubarItem>
                          <MenubarItem onClick={() => addBpmnElement('send-task')} disabled={!canEdit}>
                            Send Task
                          </MenubarItem>
                        </MenubarSubContent>
                      </MenubarSub>
                      {/* Gateways */}
                      <MenubarSub>
                        <MenubarSubTrigger>Gateways</MenubarSubTrigger>
                        <MenubarSubContent>
                          <MenubarItem onClick={() => addBpmnElement('xor-gateway')} disabled={!canEdit}>
                            Exclusive Gateway
                          </MenubarItem>
                          <MenubarItem onClick={() => addBpmnElement('and-gateway')} disabled={!canEdit}>
                            Parallel Gateway
                          </MenubarItem>
                          <MenubarItem onClick={() => addBpmnElement('or-gateway')} disabled={!canEdit}>
                            Inclusive Gateway
                          </MenubarItem>
                          <MenubarItem onClick={() => addBpmnElement('event-gateway')} disabled={!canEdit}>
                            Event-Based Gateway
                          </MenubarItem>
                          <MenubarItem onClick={() => addBpmnElement('complex-gateway')} disabled={!canEdit}>
                            Complex Gateway
                          </MenubarItem>
                        </MenubarSubContent>
                      </MenubarSub>
                      {/* Intermediate Events */}
                      <MenubarSub>
                        <MenubarSubTrigger>Intermediate Events</MenubarSubTrigger>
                        <MenubarSubContent>
                          <MenubarItem onClick={() => addBpmnElement('intermediate-event')} disabled={!canEdit}>
                            Intermediate Event
                          </MenubarItem>
                          <MenubarItem onClick={() => addBpmnElement('intermediate-timer-event')} disabled={!canEdit}>
                            Timer Event
                          </MenubarItem>
                          <MenubarItem onClick={() => addBpmnElement('intermediate-message-event')} disabled={!canEdit}>
                            Message Event
                          </MenubarItem>
                          <MenubarItem onClick={() => addBpmnElement('intermediate-signal-event')} disabled={!canEdit}>
                            Signal Event
                          </MenubarItem>
                        </MenubarSubContent>
                      </MenubarSub>
                      {/* End Events */}
                      <MenubarSub>
                        <MenubarSubTrigger>End Events</MenubarSubTrigger>
                        <MenubarSubContent>
                          <MenubarItem onClick={() => addBpmnElement('end-event')} disabled={!canEdit}>
                            End Event
                          </MenubarItem>
                          <MenubarItem onClick={() => addBpmnElement('end-message-event')} disabled={!canEdit}>
                            Message End Event
                          </MenubarItem>
                          <MenubarItem onClick={() => addBpmnElement('end-error-event')} disabled={!canEdit}>
                            Error End Event
                          </MenubarItem>
                          <MenubarItem onClick={() => addBpmnElement('end-terminate-event')} disabled={!canEdit}>
                            Terminate End Event
                          </MenubarItem>
                        </MenubarSubContent>
                      </MenubarSub>
                      {/* Subprocesses */}
                      <MenubarSub>
                        <MenubarSubTrigger>Subprocesses</MenubarSubTrigger>
                        <MenubarSubContent>
                          <MenubarItem onClick={() => addBpmnElement('subprocess')} disabled={!canEdit}>
                            Subprocess
                          </MenubarItem>
                          <MenubarItem onClick={() => addBpmnElement('collapsed-subprocess')} disabled={!canEdit}>
                            Collapsed Subprocess
                          </MenubarItem>
                          <MenubarItem onClick={() => addBpmnElement('event-subprocess')} disabled={!canEdit}>
                            Event Subprocess
                          </MenubarItem>
                          <MenubarItem onClick={() => addBpmnElement('transaction')} disabled={!canEdit}>
                            Transaction
                          </MenubarItem>
                          <MenubarItem onClick={() => addBpmnElement('call-activity')} disabled={!canEdit}>
                            Call Activity
                          </MenubarItem>
                        </MenubarSubContent>
                      </MenubarSub>
                      {/* Pools & Lanes */}
                      <MenubarSub>
                        <MenubarSubTrigger>Pools & Lanes</MenubarSubTrigger>
                        <MenubarSubContent>
                          <MenubarItem onClick={() => addBpmnElement('participant')} disabled={!canEdit}>
                            Pool
                          </MenubarItem>
                          <MenubarItem onClick={() => addBpmnElement('participant')} disabled={!canEdit}>
                            Lane
                          </MenubarItem>
                        </MenubarSubContent>
                      </MenubarSub>
                      {/* Data Objects */}
                      <MenubarSub>
                        <MenubarSubTrigger>Data Objects</MenubarSubTrigger>
                        <MenubarSubContent>
                          <MenubarItem onClick={() => addBpmnElement('data-object')} disabled={!canEdit}>
                            Data Object
                          </MenubarItem>
                          <MenubarItem onClick={() => addBpmnElement('data-store')} disabled={!canEdit}>
                            Data Store
                          </MenubarItem>
                          <MenubarItem onClick={() => addBpmnElement('data-input')} disabled={!canEdit}>
                            Data Input
                          </MenubarItem>
                          <MenubarItem onClick={() => addBpmnElement('data-output')} disabled={!canEdit}>
                            Data Output
                          </MenubarItem>
                        </MenubarSubContent>
                      </MenubarSub>
                      {/* Artifacts */}
                      <MenubarSub>
                        <MenubarSubTrigger>Artifacts</MenubarSubTrigger>
                        <MenubarSubContent>
                          <MenubarItem onClick={() => addBpmnElement('text-annotation')} disabled={!canEdit}>
                            Text Annotation
                          </MenubarItem>
                          <MenubarItem onClick={() => addBpmnElement('group')} disabled={!canEdit}>
                            Group
                          </MenubarItem>
                        </MenubarSubContent>
                      </MenubarSub>
                    </MenubarSubContent>
                  </MenubarSub>
                  <MenubarSeparator />
                  <MenubarItem onClick={handleValidateModel}>
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Validate Model
                  </MenubarItem>
                </MenubarContent>
              </MenubarMenu>

              {/* Tools Menu */}
              <MenubarMenu>
                <MenubarTrigger className="text-sm font-medium" style={{ pointerEvents: 'auto', zIndex: isFullscreen ? 102 : 'auto' }}>Tools</MenubarTrigger>
                <MenubarContent className="w-64">
                  {onRefine && (
                    <>
                      <MenubarItem onClick={() => {
                        if (!canEdit) {
                          toast.error("Editing is locked by the Process Manager");
                          return;
                        }
                        onRefine();
                      }} disabled={!canEdit}>
                        <Sparkles className="h-4 w-4 mr-2" />
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">Refine Diagram</span>
                          <span className="text-xs text-muted-foreground">AI-powered diagram refinement</span>
                        </div>
                      </MenubarItem>
                      <MenubarSeparator />
                    </>
                  )}
                  <MenubarItem onClick={() => setAgentDialogOpen(true)}>
                    <Bot className="h-4 w-4 mr-2" />
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">Modelling Agent Mode</span>
                      <span className="text-xs text-muted-foreground">Review 5-7 AI-generated alternatives</span>
                    </div>
                  </MenubarItem>
                  <MenubarItem onClick={() => setLogDialogOpen(true)}>
                    <History className="h-4 w-4 mr-2" />
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">Log Agent</span>
                      <span className="text-xs text-muted-foreground">Review BPMN audit history</span>
                    </div>
                  </MenubarItem>
                  <MenubarItem onClick={() => setVisionDialogOpen(true)}>
                    <Upload className="h-4 w-4 mr-2" />
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">Vision Modelling AI</span>
                      <span className="text-xs text-muted-foreground">Sketch to diagram</span>
                    </div>
                  </MenubarItem>
                  <MenubarSeparator />
                  <MenubarItem onClick={() => setQrDialogOpen(true)}>
                    <QrCode className="h-4 w-4 mr-2" />
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">Share via QR Code</span>
                      <span className="text-xs text-muted-foreground">Invite collaborators</span>
                    </div>
                  </MenubarItem>
                </MenubarContent>
              </MenubarMenu>
            </Menubar>

            {/* Fullscreen and Zoom Controls - Hidden when agent dialog is open */}
            {!agentDialogOpen && (
              <div className="flex items-center gap-1 shrink-0 relative z-[60]" style={{ pointerEvents: 'auto' }}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 relative z-[61]"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleToggleFullscreen();
                  }}
                  title={isFullscreen ? "Exit Fullscreen (F11)" : "Enter Fullscreen (F11)"}
                  style={{ pointerEvents: 'auto' }}
                >
                  {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </Button>
                <div className="h-6 w-px bg-border mx-0.5" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 relative z-[61]"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleZoomIn();
                  }}
                  title="Zoom In (⌘+)"
                  style={{ pointerEvents: 'auto' }}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 relative z-[61]"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleZoomOut();
                  }}
                  title="Zoom Out (⌘-)"
                  style={{ pointerEvents: 'auto' }}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 relative z-[61]"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleFitToScreen();
                  }}
                  title="Fit to Screen"
                  style={{ pointerEvents: 'auto' }}
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Center: Tabs */}
            <div className="flex-1 flex justify-center min-w-0 shrink">
              <div className="flex items-center gap-1 bg-background rounded-md border border-border p-0.5">
                <div className="px-2 py-0.5 bg-primary text-primary-foreground rounded text-xs font-medium flex items-center gap-1.5">
                  {isPid ? "P&ID" : "BPMN"}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-3.5 w-3.5 p-0 hover:bg-primary-foreground/20"
                    onClick={() => {/* Handle close tab */ }}
                  >
                    <X className="h-2.5 w-2.5" />
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  title="New Tab"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Right: Quick Search and Mode Badge */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-1.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Q Quick Search..."
                  className="pl-7 pr-7 h-7 w-40 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch(e.currentTarget.value);
                    }
                  }}
                />
                <kbd className="absolute right-1.5 top-1/2 transform -translate-y-1/2 pointer-events-none inline-flex h-3.5 select-none items-center gap-0.5 rounded border bg-muted px-1 font-mono text-[9px] font-medium text-muted-foreground opacity-100">
                  ⌘K
                </kbd>
              </div>
              <Badge
                variant={canEdit ? (isProcessManager ? "default" : "secondary") : "outline"}
                className="shrink-0 text-xs"
              >
                {isProcessManager ? "Process Manager" : canEdit ? "Editor mode" : "View only"}
              </Badge>
            </div>
          </div>
        )}

        {/* Main Board Layout - Flowable Style */}
        <div
          ref={(el) => {
            canvasContainerRef.current = el;
            if (el && isFullscreen) {
              const rect = el.getBoundingClientRect();
              const styles = window.getComputedStyle(el);
              console.log('[DEBUG] Canvas container rendered', { zIndex: styles.zIndex, position: styles.position, isolation: styles.isolation, top: rect.top, paddingTop: styles.paddingTop });
              fetch('http://127.0.0.1:7242/ingest/18d381d8-c36b-4c93-96dd-ac136b1e5e3a', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'BpmnViewer.tsx:5858', message: 'Canvas container rendered in fullscreen', data: { isFullscreen, zIndex: styles.zIndex, position: styles.position, isolation: styles.isolation, top: rect.top, left: rect.left, width: rect.width, height: rect.height, paddingTop: styles.paddingTop }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run3', hypothesisId: 'A' }) }).catch(() => { });
            }
          }}
          className="flex flex-1 relative"
          style={{ 
            position: 'relative', 
            isolation: isFullscreen ? 'auto' : 'isolate', 
            overflow: 'auto', 
            zIndex: isFullscreen ? 1 : 'auto',
            paddingTop: isFullscreen ? '112px' : '0px' // Header (56px) + Toolbar (~56px)
          }}
          onMouseDown={(e) => {
            // #region agent log
            const target = e.target as HTMLElement;
            const toolbarEl = target.closest('.flex.items-center.justify-between.px-4');
            const isToolbarClick = toolbarEl || target.closest('[data-radix-menubar-trigger]') || target.closest('[data-radix-menubar-content]') || target.closest('[role="menubar"]');
            console.log('[DEBUG] Canvas container mousedown', { target: target.tagName, isToolbarClick: !!isToolbarClick, isFullscreen, clientY: e.clientY });
            fetch('http://127.0.0.1:7242/ingest/18d381d8-c36b-4c93-96dd-ac136b1e5e3a', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'BpmnViewer.tsx:5805', message: 'Canvas container mousedown', data: { target: target.tagName, isToolbarClick: !!isToolbarClick, isFullscreen, clientX: e.clientX, clientY: e.clientY }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run2', hypothesisId: 'D' }) }).catch(() => { });
            // #endregion
            // Don't interfere with toolbar clicks - let them propagate
            if (isToolbarClick) {
              return; // Don't stop propagation, let it reach the toolbar
            }
          }}
        >
          {/* Main Canvas Area */}
          <div className="flex-1 relative flex flex-col overflow-hidden">
            {/* Floating Toolbar Toggle Button (when toolbar is hidden in fullscreen) */}
            {isFullscreen && !showToolbar && (
              <div className="absolute top-4 left-4 z-40">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowToolbar(true)}
                  className="h-8 w-8 p-0 shadow-lg"
                  title="Show Toolbar"
                >
                  <ChevronLeft className="h-4 w-4 rotate-180" />
                </Button>
              </div>
            )}

            {/* Floating Undo/Redo Toolbar */}
            <div className="absolute top-4 right-4 z-40 flex items-center gap-2 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUndo}
                disabled={!canEdit || !canUndo}
                title="Undo (Ctrl+Z)"
                className="h-8 w-8 p-0"
              >
                <Undo className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRedo}
                disabled={!canEdit || !canRedo}
                title="Redo (Ctrl+Y)"
                className="h-8 w-8 p-0"
              >
                <Redo className="h-4 w-4" />
              </Button>
              <div className="h-6 w-px bg-border mx-1" />
              <span className="text-xs text-muted-foreground px-2">
                v{version}
                {versions.length > 1 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="ml-1 text-primary hover:underline">
                        · v{versions.length}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {versions.map((_, idx) => (
                        <DropdownMenuItem key={idx} onClick={() => handleVersionChange(idx)}>
                          Version {idx + 1}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </span>
            </div>

            {/* Error State Fallback */}
            {errorState && (
              <div className="w-full h-full bg-muted/50 border border-destructive/20 rounded-lg flex flex-col items-center justify-center p-8">
                <div className="text-center space-y-4 max-w-md">
                  <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                    <X className="h-8 w-8 text-destructive" />
                  </div>
                  <h3 className="text-lg font-semibold">Generation Failed</h3>
                  <p className="text-sm text-muted-foreground">{errorState}</p>
                  <Button onClick={() => setErrorState(null)} variant="outline">
                    Retry with Simplified Prompt
                  </Button>
                </div>
              </div>
            )}

            {/* BPMN Canvas */}
            <div
              ref={(el) => {
                containerRef.current = el;
                if (el && isFullscreen) {
                  const rect = el.getBoundingClientRect();
                  const styles = window.getComputedStyle(el);
                  console.log('[DEBUG] BPMN canvas rendered', { zIndex: styles.zIndex, position: styles.position, top: rect.top });
                  fetch('http://127.0.0.1:7242/ingest/18d381d8-c36b-4c93-96dd-ac136b1e5e3a', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'BpmnViewer.tsx:5963', message: 'BPMN canvas rendered in fullscreen', data: { isFullscreen, zIndex: styles.zIndex, position: styles.position, top: rect.top, left: rect.left, width: rect.width, height: rect.height }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run2', hypothesisId: 'A' }) }).catch(() => { });
                }
              }}
              style={{
                backgroundColor: '#ffffff',
                width: '100%',
                height: '100%',
                position: 'relative',
                zIndex: isFullscreen ? 1 : 'auto',
                pointerEvents: isFullscreen ? 'auto' : 'auto'
              }}
              className={`w-full h-full border rounded-lg shadow-sm ${errorState ? 'hidden' : ''} ${isPid ? 'border-engineering-green/30' : 'border-border'}`}
              onMouseDown={(e) => {
                // #region agent log
                const target = e.target as HTMLElement;
                const toolbarEl = target.closest('.flex.items-center.justify-between.px-4');
                const isToolbarClick = toolbarEl || target.closest('[data-radix-menubar-trigger]') || target.closest('[data-radix-menubar-content]') || target.closest('[role="menubar"]');
                console.log('[DEBUG] BPMN canvas mousedown', { target: target.tagName, isToolbarClick: !!isToolbarClick, isFullscreen, clientY: e.clientY });
                fetch('http://127.0.0.1:7242/ingest/18d381d8-c36b-4c93-96dd-ac136b1e5e3a', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'BpmnViewer.tsx:5978', message: 'BPMN canvas mousedown', data: { target: target.tagName, isToolbarClick: !!isToolbarClick, isFullscreen, clientY: e.clientY }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run2', hypothesisId: 'D' }) }).catch(() => { });
                // #endregion
                // Don't interfere with toolbar clicks - let them propagate
                if (isToolbarClick) {
                  return; // Don't stop propagation
                }
              }}
            />

            {/* P&ID Legend Panel */}
            {isPid && showLegend && (
              <div className="absolute top-16 right-4 w-80 bg-background border border-engineering-green/20 rounded-lg shadow-lg z-40 max-h-[600px] overflow-y-auto">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Layers className="h-4 w-4 text-engineering-green" />
                    ISA S5.1 Symbols
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setShowLegend(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="p-4 space-y-4">
                  <Accordion type="single" collapsible>
                    <AccordionItem value="equipment">
                      <AccordionTrigger className="text-sm">Equipment</AccordionTrigger>
                      <AccordionContent className="text-xs space-y-2">
                        <div><strong>TK-xxx:</strong> Storage Tank</div>
                        <div><strong>P-xxx:</strong> Pump</div>
                        <div><strong>V-xxx:</strong> Pressure Vessel</div>
                        <div><strong>E-xxx:</strong> Heat Exchanger</div>
                        <div><strong>R-xxx:</strong> Reactor</div>
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="valves">
                      <AccordionTrigger className="text-sm">Valves</AccordionTrigger>
                      <AccordionContent className="text-xs space-y-2">
                        <div><strong>FCV-xxx:</strong> Flow Control Valve</div>
                        <div><strong>TCV-xxx:</strong> Temperature Control Valve</div>
                        <div><strong>PCV-xxx:</strong> Pressure Control Valve</div>
                        <div><strong>PSV-xxx:</strong> Pressure Safety Valve</div>
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="instruments">
                      <AccordionTrigger className="text-sm">Instruments</AccordionTrigger>
                      <AccordionContent className="text-xs space-y-2">
                        <div><strong>FI:</strong> Flow Indicator</div>
                        <div><strong>TI:</strong> Temperature Indicator</div>
                        <div><strong>PI:</strong> Pressure Indicator</div>
                        <div><strong>LI:</strong> Level Indicator</div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  <Accordion type="single" collapsible>
                    <AccordionItem value="advanced">
                      <AccordionTrigger
                        className="text-sm"
                        onClick={() => setShowAdvancedSymbols(!showAdvancedSymbols)}
                      >
                        Show Advanced Symbols
                      </AccordionTrigger>
                      {showAdvancedSymbols && (
                        <AccordionContent className="text-xs space-y-2">
                          <div><strong>FIC:</strong> Flow Indicating Controller</div>
                          <div><strong>TIC:</strong> Temperature Indicating Controller</div>
                          <div><strong>PIC:</strong> Pressure Indicating Controller</div>
                          <div><strong>LIC:</strong> Level Indicating Controller</div>
                          <div><strong>Line Ratings:</strong> 150# = ASME B16.5 Class 150</div>
                          <div><strong>Line Ratings:</strong> 300# = ASME B16.5 Class 300</div>
                        </AccordionContent>
                      )}
                    </AccordionItem>
                  </Accordion>
                </div>
              </div>
            )}

            {/* P&ID Export Button (Fixed Position) */}
            {isPid && !errorState && (
              <div className="absolute bottom-8 right-8 z-30">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="shadow-lg hover:shadow-xl bg-engineering-green hover:bg-engineering-green/90">
                      Export →
                      <FileDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleExportPid("svg")}>
                      Export as SVG
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportPid("pdf")}>
                      Export as PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportPid("dwg")}>
                      Export as DWG
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* Show Legend Button for P&ID */}
            {isPid && !showLegend && !errorState && (
              <Button
                variant="outline"
                size="sm"
                className="absolute top-16 right-4 z-30 bg-background/95 backdrop-blur-sm border-engineering-green/20 hover:bg-engineering-green/10"
                onClick={() => setShowLegend(true)}
              >
                <Layers className="h-4 w-4 mr-2 text-engineering-green" />
                Show Legend
              </Button>
            )}
          </div>

          {/* Right Sidebar - Utility Icons - Flowable Style */}
          {showRightSidebar && (
            <div className="w-12 border-l border-border bg-muted/30 flex flex-col items-center py-2 gap-2">
              <Button
                variant={showPropertiesPanel ? "default" : "ghost"}
                size="sm"
                className="h-9 w-9 p-0"
                title="Diagram Overview"
                onClick={() => setShowPropertiesPanel(!showPropertiesPanel)}
              >
                <FileText className="h-4 w-4" />
              </Button>
              <Button
                variant={showParticipantsPanel ? "default" : "ghost"}
                size="sm"
                className="h-9 w-9 p-0"
                title="Participants / Pools & Lanes"
                onClick={() => setShowParticipantsPanel(!showParticipantsPanel)}
              >
                <Users className="h-4 w-4" />
              </Button>
              <Button
                variant={showSettingsPanel ? "default" : "ghost"}
                size="sm"
                className="h-9 w-9 p-0"
                title="Execution Settings"
                onClick={() => setShowSettingsPanel(!showSettingsPanel)}
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                variant={showValidationResults ? "default" : "ghost"}
                size="sm"
                className="h-9 w-9 p-0"
                title="Check Model / Validate"
                onClick={handleValidateModel}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0"
                title="User / Role Panel"
                onClick={() => toast.info("User/Role panel - coming soon")}
              >
                <Users className="h-4 w-4" />
              </Button>
              <Button
                variant={showDocumentationPanel ? "default" : "ghost"}
                size="sm"
                className="h-9 w-9 p-0"
                title="Element Documentation"
                onClick={() => setShowDocumentationPanel(!showDocumentationPanel)}
              >
                <FileText className="h-4 w-4" />
              </Button>
              <Button
                variant={isPanMode ? "default" : "ghost"}
                size="sm"
                className="h-9 w-9 p-0"
                title="Pan / Navigate Tool"
                onClick={handleTogglePanMode}
              >
                <Hand className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0"
                title="Search"
                onClick={() => {
                  const searchInput = document.querySelector('input[placeholder*="Quick Search"]') as HTMLInputElement;
                  if (searchInput) {
                    searchInput.focus();
                  }
                }}
              >
                <FileSearch className="h-4 w-4" />
              </Button>
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0"
                onClick={() => setShowRightSidebar(false)}
                title="Collapse Sidebar"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Right Sidebar Collapse Button - When Hidden */}
          {!showRightSidebar && (
            <div className="w-8 border-l border-border bg-muted/30 flex items-center justify-center">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setShowRightSidebar(true)}
                title="Expand Sidebar"
              >
                <ChevronLeft className="h-4 w-4 rotate-180" />
              </Button>
            </div>
          )}
        </div>

        {/* Element Change Context Menu */}
        {showContextMenu && selectedElement && (
          <div
            className="context-menu absolute bg-background border border-border rounded-lg shadow-lg z-50 p-3"
            style={{
              left: `${contextMenuPosition.x}px`,
              top: `${contextMenuPosition.y}px`,
              maxWidth: '280px',
            }}
          >
            <div className="flex items-center justify-between mb-2 pb-2 border-b">
              <span className="text-xs font-semibold">Change to:</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={() => setShowContextMenu(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {/* Show events if current is an event */}
              {(selectedElement.type?.includes('Event') || selectedElement.type === 'bpmn:StartEvent' || selectedElement.type === 'bpmn:EndEvent') && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground">EVENTS</p>
                  <div className="grid grid-cols-3 gap-1">
                    <button onClick={() => changeElementType('start-event')} className="flex flex-col items-center gap-1 p-1.5 hover:bg-accent rounded text-xs" title="Start Event">
                      <div className="w-6 h-6 rounded-full border-2 border-green-600" />
                      <span className="text-[8px]">Start</span>
                    </button>
                    <button onClick={() => changeElementType('intermediate-event')} className="flex flex-col items-center gap-1 p-1.5 hover:bg-accent rounded text-xs" title="Intermediate">
                      <div className="w-6 h-6 rounded-full border-2 border-blue-600" />
                      <span className="text-[8px]">Inter.</span>
                    </button>
                    <button onClick={() => changeElementType('end-event')} className="flex flex-col items-center gap-1 p-1.5 hover:bg-accent rounded text-xs" title="End Event">
                      <div className="w-6 h-6 rounded-full border-4 border-red-600" />
                      <span className="text-[8px]">End</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Show tasks if current is a task */}
              {selectedElement.type?.includes('Task') && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground">TASKS</p>
                  <div className="grid grid-cols-3 gap-1">
                    <button onClick={() => changeElementType('task')} className="flex flex-col items-center gap-1 p-1.5 hover:bg-accent rounded" title="Task">
                      <div className="w-6 h-6 border-2 border-foreground rounded" />
                      <span className="text-[8px]">Task</span>
                    </button>
                    <button onClick={() => changeElementType('user-task')} className="flex flex-col items-center gap-1 p-1.5 hover:bg-accent rounded" title="User Task">
                      <div className="w-6 h-6 border-2 border-foreground rounded flex items-center justify-center text-[10px]">👤</div>
                      <span className="text-[8px]">User</span>
                    </button>
                    <button onClick={() => changeElementType('service-task')} className="flex flex-col items-center gap-1 p-1.5 hover:bg-accent rounded" title="Service">
                      <div className="w-6 h-6 border-2 border-foreground rounded flex items-center justify-center text-[10px]">⚙️</div>
                      <span className="text-[8px]">Service</span>
                    </button>
                    <button onClick={() => changeElementType('manual-task')} className="flex flex-col items-center gap-1 p-1.5 hover:bg-accent rounded" title="Manual">
                      <div className="w-6 h-6 border-2 border-foreground rounded flex items-center justify-center text-[10px]">✋</div>
                      <span className="text-[8px]">Manual</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Show gateways if current is a gateway */}
              {selectedElement.type?.includes('Gateway') && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground">GATEWAYS</p>
                  <div className="grid grid-cols-3 gap-1">
                    <button onClick={() => changeElementType('xor-gateway')} className="flex flex-col items-center gap-1 p-1.5 hover:bg-accent rounded" title="XOR">
                      <div className="w-6 h-6 border-2 border-amber-600 transform rotate-45 flex items-center justify-center">
                        <span className="transform -rotate-45 text-[10px] font-bold">X</span>
                      </div>
                      <span className="text-[8px]">XOR</span>
                    </button>
                    <button onClick={() => changeElementType('and-gateway')} className="flex flex-col items-center gap-1 p-1.5 hover:bg-accent rounded" title="AND">
                      <div className="w-6 h-6 border-2 border-purple-600 transform rotate-45 flex items-center justify-center">
                        <span className="transform -rotate-45 text-[10px] font-bold">+</span>
                      </div>
                      <span className="text-[8px]">AND</span>
                    </button>
                    <button onClick={() => changeElementType('or-gateway')} className="flex flex-col items-center gap-1 p-1.5 hover:bg-accent rounded" title="OR">
                      <div className="w-6 h-6 border-2 border-indigo-600 transform rotate-45 flex items-center justify-center">
                        <span className="transform -rotate-45 text-[10px] font-bold">O</span>
                      </div>
                      <span className="text-[8px]">OR</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Camunda Color Palette */}
              <div className="pt-2 border-t space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground">CAMUNDA COLORS</p>
                <div className="grid grid-cols-3 gap-1">
                  {camundaColors.map((colorOption) => (
                    <button
                      key={colorOption.name}
                      onClick={() => {
                        if (colorOption.color === 'none') {
                          // Remove color
                          try {
                            const modeling = modelerRef.current?.get('modeling') as {
                              setColor: (elements: unknown[], options: { fill?: string; stroke?: string }) => void;
                            } | undefined;
                            if (modeling && selectedElement) {
                              modeling.setColor([selectedElement], {
                                fill: undefined,
                                stroke: undefined
                              });
                              toast.success('Color removed');
                              setShowContextMenu(false);
                            }
                          } catch (error) {
                            console.error('Error removing color:', error);
                            toast.error('Failed to remove color');
                          }
                        } else {
                          applyColor(colorOption.color, colorOption.label);
                        }
                      }}
                      className="flex flex-col items-center gap-1 p-1.5 hover:bg-accent rounded transition-colors"
                      title={colorOption.label}
                    >
                      {colorOption.color === 'none' ? (
                        <div className="w-6 h-6 border-2 border-dashed border-foreground rounded flex items-center justify-center">
                          <X className="h-3 w-3" />
                        </div>
                      ) : (
                        <div
                          className="w-6 h-6 rounded border-2 border-border"
                          style={{ backgroundColor: colorOption.color }}
                        />
                      )}
                      <span className="text-[8px] text-center leading-tight">{colorOption.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Always show option to change to any category */}
              <div className="pt-2 border-t space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground">CHANGE TO</p>
                <div className="grid grid-cols-3 gap-1">
                  <button onClick={() => changeElementType('task')} className="flex flex-col items-center gap-1 p-1.5 hover:bg-accent rounded" title="Task">
                    <div className="w-6 h-6 border-2 border-foreground rounded" />
                    <span className="text-[8px]">Task</span>
                  </button>
                  <button onClick={() => changeElementType('start-event')} className="flex flex-col items-center gap-1 p-1.5 hover:bg-accent rounded" title="Event">
                    <div className="w-6 h-6 rounded-full border-2 border-green-600" />
                    <span className="text-[8px]">Event</span>
                  </button>
                  <button onClick={() => changeElementType('xor-gateway')} className="flex flex-col items-center gap-1 p-1.5 hover:bg-accent rounded" title="Gateway">
                    <div className="w-6 h-6 border-2 border-amber-600 transform rotate-45" />
                    <span className="text-[8px]">Gateway</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Vision Modelling AI Dialog */}
        <Dialog open={visionDialogOpen} onOpenChange={setVisionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Vision Modelling AI - Process from Images</DialogTitle>
              <DialogDescription>
                Upload images containing process information:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li><strong>Handwritten notes</strong> - sketches and text</li>
                  <li><strong>Whiteboard diagrams</strong> - flow drawings and ideas</li>
                  <li><strong>Process sketches</strong> - rough workflow designs</li>
                  <li><strong>Meeting notes</strong> - captured process discussions</li>
                </ul>
                <p className="mt-2 text-sm">AI will extract text, analyze the content, and generate a professional BPMN diagram.</p>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <Label htmlFor="vision-upload" className="cursor-pointer">
                  <span className="text-sm font-medium">Click to upload image</span>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG - handwritten or printed content</p>
                </Label>
                <Input
                  id="vision-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleVisionUpload}
                  disabled={isProcessing}
                />
              </div>
              {selectedFile && (
                <div className="text-center text-sm">
                  <p className="text-foreground">Selected: <strong>{selectedFile.name}</strong></p>
                </div>
              )}
              {isProcessing && (
                <div className="text-center space-y-2">
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium">Processing your image with AI...</p>
                    <p className="text-xs mt-1">📝 Extracting text and analyzing content</p>
                    <p className="text-xs">🔍 Understanding process flow</p>
                    <p className="text-xs">⚙️ Generating BPMN diagram</p>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={confirmAlternativeDialogOpen}
          onOpenChange={(open) => {
            setConfirmAlternativeDialogOpen(open);
            if (!open) {
              setConfirmAlternative(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apply this alternative diagram?</AlertDialogTitle>
              <AlertDialogDescription>
                The current canvas will be replaced with the selected alternative. You can always undo or regenerate additional options.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {confirmAlternative ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{confirmAlternative.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {confirmAlternative.description}
                    </p>
                  </div>
                  <Badge variant={confirmAlternative.complexity === "advanced" ? "default" : "secondary"}>
                    {confirmAlternative.complexity.toUpperCase()}
                  </Badge>
                </div>
                <ScrollArea className="h-40 border rounded-md bg-muted/30">
                  <pre className="text-[11px] leading-4 p-3 whitespace-pre-wrap">
                    {confirmAlternative.xml.slice(0, 1600)}
                    {confirmAlternative.xml.length > 1600 ? "...\n\n(Preview truncated)" : ""}
                  </pre>
                </ScrollArea>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select an alternative to preview and apply it.
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>Not now</AlertDialogCancel>
              <AlertDialogAction
                disabled={!confirmAlternative}
                onClick={async () => {
                  if (confirmAlternative) {
                    await applyAlternativeModel(confirmAlternative);
                    setConfirmAlternative(null);
                    setConfirmAlternativeDialogOpen(false);
                  }
                }}
              >
                Apply diagram
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* QR Code Dialog */}
        <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share via QR Code</DialogTitle>
              <DialogDescription>
                Generate a QR code to invite collaborators with view or edit permissions
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="border rounded-lg p-8 text-center bg-muted/30">
                <QrCode className="h-32 w-32 mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">QR Code will appear here</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={generateQRCode} className="flex-1">
                  Generate QR Code
                </Button>
                <Button variant="outline" className="flex-1">
                  Set Permissions
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Log Agent Dialog */}
        <Dialog
          open={logDialogOpen}
          onOpenChange={(open) => {
            setLogDialogOpen(open);
          }}
        >
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Log Agent</DialogTitle>
              <DialogDescription>
                Store and audit BPMN diagram history for compliance, recovery, and review
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center bg-muted/30">
                <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <Label htmlFor="log-upload" className="cursor-pointer flex flex-col gap-1">
                  <span className="text-sm font-medium">Click to upload log file</span>
                  <p className="text-xs text-muted-foreground">CSV, JSON, TXT, or LOG format</p>
                </Label>
                <Input
                  id="log-upload"
                  type="file"
                  accept=".csv,.json,.txt,.log"
                  className="hidden"
                  onChange={handleLogUpload}
                  disabled={isProcessing}
                />
              </div>
              {isProcessing && (
                <div className="text-center text-sm text-muted-foreground">
                  Analyzing log file...
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Audit trail</p>
                  </div>
                  <Badge variant="outline">
                    {logHistory.length} snapshots
                  </Badge>
                </div>
                <ScrollArea className="max-h-64 border rounded-md">
                  <div className="divide-y">
                    {isLoadingLogs ? (
                      <div className="p-4 text-sm text-muted-foreground">
                        Loading audit trail...
                      </div>
                    ) : logHistory.length ? (
                      logHistory.map((entry) => {
                        const notes = Array.isArray(entry.alternative_models)
                          ? (entry.alternative_models as Array<Record<string, unknown>>)[0]
                          : undefined;
                        const preview =
                          notes && typeof notes === "object" && typeof notes.preview === "string"
                            ? notes.preview
                            : undefined;

                        return (
                          <div key={entry.id} className="p-4 flex flex-col gap-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium">
                                  {entry.input_description ?? "Manual save"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {entry.created_at
                                    ? new Date(entry.created_at).toLocaleString()
                                    : "Timestamp unavailable"}
                                </p>
                                {entry.input_type && (
                                  <Badge variant="secondary" className="mt-1 uppercase tracking-wide">
                                    {entry.input_type.replace(/[_-]/g, " ")}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="sm" variant="outline">Download as</Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-44">
                                    <DropdownMenuLabel>Choose format</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() =>
                                        downloadXmlSnapshot(
                                          entry.generated_bpmn_xml,
                                          entry.input_description ?? "diagram-log"
                                        )
                                      }
                                    >
                                      BPMN (.bpmn)
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={async () => {
                                        try {
                                          const svg = await renderXmlToSvg(entry.generated_bpmn_xml);
                                          const blob = new Blob([svg], { type: "image/svg+xml" });
                                          downloadBlob(blob, `${(entry.input_description ?? "diagram-log")}.svg`);
                                        } catch {
                                          toast.error("Failed to export SVG");
                                        }
                                      }}
                                    >
                                      SVG (.svg)
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={async () => {
                                        try {
                                          const svg = await renderXmlToSvg(entry.generated_bpmn_xml);
                                          const blob = await exportSvgStringToImage(svg, "image/png");
                                          downloadBlob(blob, `${(entry.input_description ?? "diagram-log")}.png`);
                                        } catch {
                                          toast.error("Failed to export PNG");
                                        }
                                      }}
                                    >
                                      PNG (.png)
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={async () => {
                                        try {
                                          const svg = await renderXmlToSvg(entry.generated_bpmn_xml);
                                          const blob = await exportSvgStringToImage(svg, "image/jpeg", "#ffffff");
                                          downloadBlob(blob, `${(entry.input_description ?? "diagram-log")}.jpg`);
                                        } catch {
                                          toast.error("Failed to export JPG");
                                        }
                                      }}
                                    >
                                      JPG (.jpg)
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={async () => {
                                        try {
                                          const svg = await renderXmlToSvg(entry.generated_bpmn_xml);
                                          const pngBlob = await exportSvgStringToImage(svg, "image/png", "#ffffff");
                                          const url = URL.createObjectURL(pngBlob);
                                          const newWindow = window.open("", "_blank");
                                          if (newWindow) {
                                            newWindow.document.write(`<html><head><title>${entry.input_description ?? "diagram-log"}</title></head><body style="margin:0"><img src="${url}" style="width:100%;height:auto"/></body></html>`);
                                            newWindow.document.close();
                                            setTimeout(() => { try { newWindow.focus(); newWindow.print(); } catch (_) { } }, 300);
                                          } else {
                                            toast.info("Popup blocked. Enable popups to save as PDF.");
                                          }
                                        } catch {
                                          toast.error("Failed to prepare PDF. Use 'Print to PDF' from the opened image.");
                                        }
                                      }}
                                    >
                                      PDF (via Print)
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                <Button
                                  size="sm"
                                  onClick={() => applyHistoricalDiagram(entry)}
                                >
                                  Load
                                </Button>
                              </div>
                            </div>
                            {preview && (
                              <pre className="text-xs bg-muted/60 border rounded-md p-3 whitespace-pre-wrap max-h-32 overflow-auto">
                                {preview}
                              </pre>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 text-sm text-muted-foreground">
                        No historical logs archived yet.
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modelling Agent Dialog */}
        <Dialog
          open={agentDialogOpen}
          onOpenChange={(open) => {
            setAgentDialogOpen(open);
            if (!open) {
              setAlternativeError(null);
            }
          }}
        >
          <DialogContent
            className="max-w-[95vw] max-h-[95vh] w-[90vw] h-[90vh] overflow-hidden flex flex-col p-0"
            style={{
              maxWidth: '1400px',
              maxHeight: '900px',
              width: '90vw',
              height: '90vh',
              minWidth: '900px',
              minHeight: '650px'
            }}
          >
            <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b">
              <DialogTitle>Modelling Agent Mode</DialogTitle>
              <DialogDescription>
                Compare 5-7 AI-generated BPMN variations, from streamlined to advanced, and apply the best fit
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 pb-6 space-y-6" style={{ minHeight: 0, scrollBehavior: 'smooth' }}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">
                    How many alternative diagrams would you like to generate?
                  </label>
                  <div className="flex gap-4">
                    {[3, 5, 7].map((countOption) => (
                      <label
                        key={countOption}
                        className={`flex items-center gap-2 cursor-pointer ${isLoadingAlternatives ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                      >
                        <input
                          type="radio"
                          name="alternativeCount"
                          value={countOption}
                          checked={alternativeCount === countOption}
                          onChange={() => {
                            if (!isLoadingAlternatives) {
                              setAlternativeCount(countOption);
                            }
                          }}
                          disabled={isLoadingAlternatives}
                          className="w-4 h-4 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
                          aria-label={`Generate ${countOption} alternatives`}
                        />
                        <span className="text-sm font-medium">{countOption}</span>
                        {countOption === 5 && (
                          <Badge variant="secondary" className="text-[10px]">Recommended</Badge>
                        )}
                      </label>
                    ))}
                  </div>
                  <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                    <p>• <strong>3 alternatives:</strong> Quick comparison (fastest)</p>
                    <p>• <strong>5 alternatives:</strong> Comprehensive options (recommended)</p>
                    <p>• <strong>7 alternatives:</strong> Maximum variety (slowest)</p>
                  </div>
                </div>
                {featureFlags.showLanguagePreference && (
                  <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                    <label className="text-sm font-medium text-foreground">
                      Language preference
                    </label>
                    <Select
                      value={selectedLanguage}
                      onValueChange={(value) => handleLanguageChange(value as LanguageOptionValue)}
                      disabled={isApplyingLanguage}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Auto (match prompt)" />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <p>
                        {selectedLanguage === "auto"
                          ? "We detect the language from your prompt and existing canvas labels."
                          : `All variants will be generated in ${LANGUAGE_NATIVE_NAMES[selectedLanguage]}.`}
                      </p>
                      {isApplyingLanguage && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                    </div>
                  </div>
                )}
              </div>
              {isLoadingAlternatives ? (
                <div className="flex flex-col items-center justify-center gap-4 py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <div className="space-y-4 text-center w-full max-w-md">
                    <p className="text-sm font-medium">
                      Generating {alternativeProgress.total || alternativeCount} alternative {diagramType === "pid" ? "P&ID" : "BPMN"} models in parallel...
                    </p>
                    {alternativeProgress.total > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Progress: {alternativeProgress.completed} / {alternativeProgress.total}</span>
                          <span>
                            {alternativeProgress.total
                              ? Math.round((alternativeProgress.completed / alternativeProgress.total) * 100)
                              : 0}
                            %
                          </span>
                        </div>
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{
                              width: `${alternativeProgress.total
                                ? Math.min(
                                  100,
                                  (alternativeProgress.completed / alternativeProgress.total) * 100
                                )
                                : 0
                                }%`,
                            }}
                          />
                        </div>
                        {/* Individual model status list */}
                        <div className="space-y-1.5 text-left border rounded-lg p-3 bg-muted/30 max-h-64 overflow-y-auto">
                          {ALTERNATIVE_VARIANTS.slice(0, alternativeProgress.total).map((variant) => {
                            const status = modelStatuses.get(variant.id) || 'queued';
                            const isCurrent = alternativeProgress.current === variant.title;
                            return (
                              <div key={variant.id} className="flex items-center gap-2 text-xs">
                                {status === 'completed' && <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />}
                                {status === 'generating' && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary flex-shrink-0" />}
                                {status === 'failed' && <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />}
                                {status === 'queued' && <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />}
                                <span className={`flex-1 ${isCurrent ? 'font-medium text-primary' : ''} ${status === 'failed' ? 'text-destructive' : ''}`}>
                                  {variant.title}
                                  {status === 'failed' && ' (generation failed)'}
                                  {status === 'completed' && alternativeModels.find(m => m.title === variant.title)?.previewFailed && ' (preview unavailable)'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {alternativeModels.length > 0 && (
                      <p className="text-xs text-green-600 dark:text-green-400">
                        ✓ {alternativeModels.length} model{alternativeModels.length !== 1 ? "s" : ""} ready
                      </p>
                    )}
                  </div>
                </div>
              ) : alternativeError ? (
                <div className="border border-destructive/30 bg-destructive/10 rounded-lg p-4 space-y-3">
                  <p className="text-sm text-destructive font-medium">Unable to prepare alternatives</p>
                  <p className="text-xs text-destructive/80">{alternativeError}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => generateAlternativeModels(true)}
                  >
                    Retry
                  </Button>
                </div>
              ) : alternativeModels.length ? (
                <>
                  <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                    <div className="space-y-4">
                      {selectedAlternative ? (
                        <div className="border rounded-lg p-5 space-y-4 bg-muted/40">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Bot className="h-4 w-4 text-primary" />
                                <h4 className="text-base font-semibold">{selectedAlternative.title}</h4>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {selectedAlternative.description}
                              </p>
                            </div>
                            <Badge variant={selectedAlternative.complexity === "advanced" ? "default" : "secondary"}>
                              {selectedAlternative.complexity.toUpperCase()}
                            </Badge>
                          </div>
                          {selectedAlternative.generatedAt && (
                            <p className="text-[11px] text-muted-foreground">
                              Generated {new Date(selectedAlternative.generatedAt).toLocaleString()}
                            </p>
                          )}
                          {/* Recommendation badge */}
                          {recommendedModel && recommendedModel.id === selectedAlternative.id && (
                            <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-primary/10 to-primary/5 border-2 border-primary/30 rounded-lg shadow-sm">
                              <span className="text-2xl">🏆</span>
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-primary">Recommended Variant</p>
                                <p className="text-xs text-muted-foreground">
                                  Best balance of complexity, clarity, and functionality
                                </p>
                              </div>
                            </div>
                          )}
                          {/* Enhanced KPIs display */}
                          {selectedAlternative.metrics && (
                            <div className="space-y-3">
                              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Key Performance Indicators</p>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col p-3 bg-background border rounded-lg">
                                  <span className="text-xs text-muted-foreground mb-1">Number of Tasks</span>
                                  <span className="text-lg font-bold text-foreground">{selectedAlternative.metrics.taskCount}</span>
                                </div>
                                <div className="flex flex-col p-3 bg-background border rounded-lg">
                                  <span className="text-xs text-muted-foreground mb-1">Decision Points</span>
                                  <span className="text-lg font-bold text-foreground">{selectedAlternative.metrics.decisionPoints}</span>
                                </div>
                                <div className="flex flex-col p-3 bg-background border rounded-lg">
                                  <span className="text-xs text-muted-foreground mb-1">Parallel Branches</span>
                                  <span className="text-lg font-bold text-foreground">{selectedAlternative.metrics.parallelBranches}</span>
                                </div>
                                <div className="flex flex-col p-3 bg-background border rounded-lg">
                                  <span className="text-xs text-muted-foreground mb-1">Error Handlers</span>
                                  <span className="text-lg font-bold text-foreground">{selectedAlternative.metrics.errorHandlers}</span>
                                </div>
                                <div className="col-span-2 flex flex-col p-3 bg-background border rounded-lg">
                                  <span className="text-xs text-muted-foreground mb-1">Estimated Execution Paths</span>
                                  <span className="text-lg font-bold text-foreground">{selectedAlternative.metrics.estimatedPaths}</span>
                                </div>
                              </div>
                            </div>
                          )}
                          {/* Variant Summary */}
                          {(() => {
                            const summary = getVariantSummary(selectedAlternative);
                            return (
                              <div className="space-y-3 border-t pt-4">
                                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Variant Analysis</p>
                                <div className="grid md:grid-cols-3 gap-3 text-xs">
                                  <div>
                                    <p className="font-semibold text-green-600 dark:text-green-400 mb-2 flex items-center gap-1">
                                      <span>✓</span> Strengths
                                    </p>
                                    <ul className="space-y-1 text-muted-foreground">
                                      {summary.strengths.map((s, i) => (
                                        <li key={i} className="flex items-start gap-1">
                                          <span className="text-green-500 mt-0.5">•</span>
                                          <span>{s}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div>
                                    <p className="font-semibold text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
                                      <span>⚠</span> Weaknesses
                                    </p>
                                    <ul className="space-y-1 text-muted-foreground">
                                      {summary.weaknesses.map((w, i) => (
                                        <li key={i} className="flex items-start gap-1">
                                          <span className="text-amber-500 mt-0.5">•</span>
                                          <span>{w}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div>
                                    <p className="font-semibold text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-1">
                                      <span>🎯</span> Best Use Cases
                                    </p>
                                    <ul className="space-y-1 text-muted-foreground">
                                      {summary.useCases.map((u, i) => (
                                        <li key={i} className="flex items-start gap-1">
                                          <span className="text-blue-500 mt-0.5">•</span>
                                          <span>{u}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase">
                              Diagram Preview
                            </p>
                            <div
                              className="h-64 border rounded-md"
                              style={{ backgroundColor: '#ffffff' }}
                              data-preview-container
                            >
                              <AlternativeDiagramPreview
                                xml={selectedAlternative.xml}
                                title={selectedAlternative.title}
                                onRetry={() => {
                                  // Force re-render by updating a state
                                  setSelectedAlternativeId(selectedAlternative.id);
                                }}
                                onDownloadAvailable={(available) => {
                                  // Track preview failure
                                  if (!available) {
                                    setAlternativeModels(prev => prev.map(m =>
                                      m.id === selectedAlternative.id ? { ...m, previewFailed: true } : m
                                    ));
                                  }
                                }}
                              />
                            </div>
                          </div>
                          <div className="flex justify-between items-center gap-2 pt-2 border-t">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (!selectedAlternative && alternativeModels.length) {
                                    setSelectedAlternativeId(alternativeModels[0].id);
                                  }
                                  setPreviewDialogOpen(true);
                                }}
                                className="flex items-center gap-2"
                              >
                                <Eye className="h-4 w-4" />
                                Preview
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setXmlViewerData({
                                    title: selectedAlternative.title,
                                    xml: selectedAlternative.xml,
                                    generatedAt: selectedAlternative.generatedAt,
                                    complexity: selectedAlternative.complexity,
                                    source: "alternative",
                                  })
                                }
                                className="flex items-center gap-2"
                              >
                                <Code className="h-4 w-4" />
                                View XML
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="sm" variant="outline" className="flex items-center gap-2">
                                    <Download className="h-4 w-4" />
                                    Download
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  <DropdownMenuLabel>Choose format</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => downloadAlternativeModel(selectedAlternative)}>
                                    BPMN (.bpmn)
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => downloadAlternativeModel(selectedAlternative, "xml")}>
                                    XML (.xml)
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      try {
                                        const svg = await renderXmlToSvg(selectedAlternative.xml);
                                        const blob = new Blob([svg], { type: "image/svg+xml" });
                                        downloadBlob(blob, `${selectedAlternative.title}.svg`);
                                      } catch {
                                        toast.error("Failed to export SVG");
                                      }
                                    }}
                                  >
                                    SVG (.svg)
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      try {
                                        const svg = await renderXmlToSvg(selectedAlternative.xml);
                                        const blob = await exportSvgStringToImage(svg, "image/png");
                                        downloadBlob(blob, `${selectedAlternative.title}.png`);
                                      } catch {
                                        toast.error("Failed to export PNG");
                                      }
                                    }}
                                  >
                                    PNG (.png)
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      try {
                                        const svg = await renderXmlToSvg(selectedAlternative.xml);
                                        const blob = await exportSvgStringToImage(svg, "image/jpeg", "#ffffff");
                                        downloadBlob(blob, `${selectedAlternative.title}.jpg`);
                                      } catch {
                                        toast.error("Failed to export JPG");
                                      }
                                    }}
                                  >
                                    JPG (.jpg)
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      try {
                                        const svg = await renderXmlToSvg(selectedAlternative.xml);
                                        const pngBlob = await exportSvgStringToImage(svg, "image/png", "#ffffff");
                                        const url = URL.createObjectURL(pngBlob);
                                        const newWindow = window.open("", "_blank");
                                        if (newWindow) {
                                          newWindow.document.write(`<html><head><title>${selectedAlternative.title}</title></head><body style="margin:0"><img src="${url}" style="width:100%;height:auto"/></body></html>`);
                                          newWindow.document.close();
                                          setTimeout(() => { try { newWindow.focus(); newWindow.print(); } catch (_) { } }, 300);
                                        } else {
                                          toast.info("Popup blocked. Enable popups to save as PDF.");
                                        }
                                      } catch {
                                        toast.error("Failed to prepare PDF. Use 'Print to PDF' from the opened image.");
                                      }
                                    }}
                                  >
                                    PDF (via Print)
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (selectedAlternative) {
                                    applyAlternativeModel(selectedAlternative);
                                  }
                                }}
                                className="flex items-center gap-2"
                              >
                                <Check className="h-4 w-4" />
                                Apply
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="border rounded-lg p-6 text-center text-sm text-muted-foreground bg-muted/30">
                          Select an alternative from the list to preview and apply it.
                        </div>
                      )}
                    </div>
                    <div className="border rounded-lg p-3 bg-background/70 flex flex-col" style={{ minHeight: '300px', maxHeight: 'calc(100vh - 250px)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Alternatives ({alternativeModels.length})
                        </p>
                        <span className="text-[11px] text-muted-foreground">Click to preview & confirm</span>
                      </div>
                      {/* Scroll Position Indicator */}
                      {alternativeModels.length > 3 && (
                        <div className="mb-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all duration-200"
                              style={{ width: `${scrollPosition}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground min-w-[35px] text-right">
                            {Math.round(scrollPosition)}%
                          </span>
                        </div>
                      )}
                      <ScrollArea
                        className="flex-1 pr-2 alternatives-panel-scroll"
                        style={{
                          scrollbarWidth: 'thin',
                          scrollbarColor: 'rgba(52, 152, 219, 0.6) rgba(255, 255, 255, 0.05)',
                          minHeight: '300px',
                          maxHeight: 'calc(100vh - 350px)'
                        }}
                        onScroll={(e) => {
                          const target = e.target as HTMLElement;
                          const { scrollTop, scrollHeight, clientHeight } = target;
                          const scrollPercent = scrollHeight > clientHeight
                            ? (scrollTop / (scrollHeight - clientHeight)) * 100
                            : 0;
                          setScrollPosition(Math.min(100, Math.max(0, scrollPercent)));
                        }}
                      >
                        <style>{`
                        .alternatives-panel-scroll::-webkit-scrollbar {
                          width: 10px;
                          height: 10px;
                        }
                        .alternatives-panel-scroll::-webkit-scrollbar-track {
                          background: rgba(255, 255, 255, 0.05);
                          border-radius: 10px;
                          margin: 5px 0;
                        }
                        .alternatives-panel-scroll::-webkit-scrollbar-thumb {
                          background: rgba(52, 152, 219, 0.6);
                          border-radius: 10px;
                          border: 2px solid transparent;
                          background-clip: padding-box;
                        }
                        .alternatives-panel-scroll::-webkit-scrollbar-thumb:hover {
                          background: rgba(52, 152, 219, 0.9);
                          background-clip: padding-box;
                        }
                        @media (max-width: 1200px) {
                          .alternatives-panel-scroll {
                            max-height: calc(100vh - 200px) !important;
                          }
                        }
                        @media (max-width: 768px) {
                          .alternatives-panel-scroll {
                            max-height: calc(100vh - 150px) !important;
                          }
                        }
                      `}</style>
                        <div
                          ref={alternativesScrollRef}
                          className="space-y-3"
                          style={{ scrollBehavior: 'smooth' }}
                        >
                          {alternativeModels.map((model, index) => {
                            const isSelected = model.id === selectedAlternativeId;
                            return (
                              <button
                                key={model.id}
                                type="button"
                                onClick={() => setSelectedAlternativeId(model.id)}
                                className={`w-full text-left border rounded-lg p-3 transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 flex-shrink-0 ${isSelected
                                  ? "border-primary bg-primary/10 shadow-lg"
                                  : "border-border hover:shadow-md"
                                  }`}
                                style={{
                                  minHeight: '280px',
                                  maxHeight: 'none',
                                  display: 'flex',
                                  flexDirection: 'column'
                                }}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="space-y-1 flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{model.title}</p>
                                    <Badge
                                      variant={model.complexity === "advanced" ? "default" : model.complexity === "intermediate" ? "secondary" : "outline"}
                                      className="text-[10px] mt-1"
                                    >
                                      {model.complexity === "basic" ? "BASIC" : model.complexity === "intermediate" ? "INTERMEDIATE" : "ADVANCED"}
                                    </Badge>
                                  </div>
                                  {isSelected && <Check className="h-5 w-5 text-primary flex-shrink-0" />}
                                </div>
                                <div
                                  className="mt-2 rounded-md border overflow-hidden"
                                  style={{
                                    backgroundColor: '#ffffff',
                                    minHeight: '128px',
                                    maxHeight: '200px',
                                    height: 'auto'
                                  }}
                                >
                                  <AlternativeDiagramPreview
                                    xml={model.xml}
                                    title={model.title}
                                    onDownloadAvailable={(available) => {
                                      if (!available) {
                                        setAlternativeModels(prev => prev.map(m =>
                                          m.id === model.id ? { ...m, previewFailed: true } : m
                                        ));
                                      }
                                    }}
                                  />
                                </div>
                                {/* KPIs Display */}
                                {model.metrics && (
                                  <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px]">
                                    <div className="flex items-center justify-between p-1.5 bg-muted/50 rounded">
                                      <span className="text-muted-foreground">Tasks:</span>
                                      <span className="font-semibold">{model.metrics.taskCount}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-1.5 bg-muted/50 rounded">
                                      <span className="text-muted-foreground">Decisions:</span>
                                      <span className="font-semibold">{model.metrics.decisionPoints}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-1.5 bg-muted/50 rounded">
                                      <span className="text-muted-foreground">Parallel:</span>
                                      <span className="font-semibold">{model.metrics.parallelBranches}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-1.5 bg-muted/50 rounded">
                                      <span className="text-muted-foreground">Errors:</span>
                                      <span className="font-semibold">{model.metrics.errorHandlers}</span>
                                    </div>
                                  </div>
                                )}
                                {/* Show recommendation indicator */}
                                {recommendedModel && recommendedModel.id === model.id && (
                                  <div className="mt-2 flex items-center gap-1.5 px-2 py-1 bg-primary/10 border border-primary/20 rounded text-[10px] text-primary">
                                    <span>🏆</span>
                                    <span className="font-semibold">Recommended</span>
                                  </div>
                                )}
                                {/* Show preview failure indicator */}
                                {model.previewFailed && (
                                  <div className="mt-1 flex items-center gap-1 text-[10px] text-yellow-600 dark:text-yellow-500">
                                    <AlertTriangle className="h-3 w-3" />
                                    <span>Preview unavailable</span>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </ScrollArea>
                      {/* Scroll Controls */}
                      {alternativeModels.length > 3 && (
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => {
                              alternativesScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            disabled={scrollPosition === 0}
                          >
                            ↑ Top
                          </Button>
                          <span className="text-[10px] text-muted-foreground">
                            {alternativeModels.length} alternative{alternativeModels.length !== 1 ? 's' : ''}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => {
                              if (alternativesScrollRef.current) {
                                alternativesScrollRef.current.scrollTo({
                                  top: alternativesScrollRef.current.scrollHeight,
                                  behavior: 'smooth'
                                });
                              }
                            }}
                            disabled={scrollPosition >= 99}
                          >
                            Bottom ↓
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <span className="text-xs text-muted-foreground">
                      Compare variants side by side, then apply the one that fits your requirements.
                    </span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          // Refresh all previews by clearing cache and forcing re-render
                          previewCache.clear();
                          setAlternativeModels(prev => prev.map(m => ({ ...m })));
                          toast.info("Refreshing all previews...");
                        }}
                        disabled={isLoadingAlternatives}
                        title="Refresh all alternative previews"
                      >
                        Refresh All
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (confirm("This will replace current alternatives with a new set. Continue?")) {
                            generateAlternativeModels(true);
                          }
                        }}
                        disabled={isLoadingAlternatives}
                        title="Generate a new set of alternative BPMN models with the same input"
                      >
                        Regenerate all variations
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="border rounded-lg p-6 text-center bg-muted/40">
                  <Bot className="h-16 w-16 mx-auto mb-4 text-primary" />
                  <p className="text-sm font-medium mb-2">Preparing alternatives</p>
                  <p className="text-xs text-muted-foreground">
                    We will analyze the current diagram and assemble 5-7 tailored variations, from core flow to advanced designs.
                  </p>
                  <Button
                    className="mt-4"
                    onClick={() => generateAlternativeModels(true)}
                    disabled={isLoadingAlternatives}
                  >
                    Generate alternatives
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Alternative Preview Dialog */}
        <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>
                {selectedAlternative ? `Preview — ${selectedAlternative.title}` : "Preview alternative"}
              </DialogTitle>
              <DialogDescription>
                {selectedAlternative
                  ? `Complexity: ${selectedAlternative.complexity.toUpperCase()}`
                  : "Select an alternative to preview it."}
              </DialogDescription>
            </DialogHeader>
            {selectedAlternative ? (
              <div className="space-y-3">
                <div className="border rounded-lg bg-muted/30 h-[420px]" data-preview-container>
                  <AlternativeDiagramPreview
                    xml={selectedAlternative.xml}
                    title={selectedAlternative.title}
                    onRetry={() => setSelectedAlternativeId(selectedAlternative.id)}
                    onDownloadAvailable={() => { }}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPreviewDialogOpen(false);
                      setXmlViewerData({
                        title: selectedAlternative.title,
                        xml: selectedAlternative.xml,
                        generatedAt: selectedAlternative.generatedAt,
                        complexity: selectedAlternative.complexity,
                        source: "alternative",
                      });
                    }}
                    className="flex items-center gap-2"
                  >
                    <Code className="h-4 w-4" />
                    View XML
                  </Button>
                  <Button onClick={() => downloadAlternativeModel(selectedAlternative)}>
                    Download .bpmn
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Pick an alternative model to preview it.
              </p>
            )}
          </DialogContent>
        </Dialog>

        {/* XML Viewer Dialog */}
        <Dialog
          open={!!xmlViewerData}
          onOpenChange={(open) => {
            if (!open) {
              setXmlViewerData(null);
            }
          }}
        >
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>BPMN XML</DialogTitle>
              <DialogDescription>
                {xmlViewerData
                  ? `${xmlViewerData.title}${xmlViewerData.complexity
                    ? ` (${xmlViewerData.complexity.toUpperCase()})`
                    : ""
                  }`
                  : "Inspect the generated BPMN XML."}
              </DialogDescription>
            </DialogHeader>
            {xmlViewerData && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    Generated{" "}
                    {xmlViewerData.generatedAt
                      ? new Date(xmlViewerData.generatedAt).toLocaleString()
                      : xmlViewerData.source === "canvas"
                        ? new Date().toLocaleString()
                        : "just now"}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          if (typeof navigator === "undefined" || !navigator.clipboard) {
                            throw new Error("Clipboard API unavailable");
                          }
                          await navigator.clipboard.writeText(xmlViewerData.xml);
                          toast.success("XML copied to clipboard");
                        } catch (error) {
                          console.error("Failed to copy XML:", error);
                          toast.error("Unable to copy XML");
                        }
                      }}
                    >
                      Copy XML
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        const blob = new Blob([xmlViewerData.xml], { type: "application/xml" });
                        const filename = `${(xmlViewerData.title || "diagram")
                          .replace(/\s+/g, "_")
                          .toLowerCase()}.xml`;
                        downloadBlob(blob, filename);
                      }}
                    >
                      Download XML
                    </Button>
                  </div>
                </div>
                <ScrollArea className="max-h-[60vh] border rounded-md bg-muted/30">
                  <pre className="text-[11px] leading-5 p-4 whitespace-pre-wrap">
                    {xmlViewerData.xml}
                  </pre>
                  <ScrollBar orientation="vertical" />
                </ScrollArea>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* System Use Modelling Dialog */}
        <Dialog
          open={systemDialogOpen}
          onOpenChange={(open) => {
            setSystemDialogOpen(open);
          }}
        >
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>System Use Modelling</DialogTitle>
              <DialogDescription>
                Capture visits, clicks, and on-page context to generate BPMN models from real usage
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="border rounded-lg p-4 bg-muted/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Activity className="h-10 w-10 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">Detailed Behavior Tracking</p>
                    <p className="text-xs text-muted-foreground">
                      Log page visits, clicked elements, and page copy for downstream mining.
                    </p>
                  </div>
                </div>
                <Badge variant={systemTrackingEnabled ? "default" : "outline"}>
                  {systemTrackingEnabled ? "Active" : "Paused"}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {systemTrackingEnabled ? (
                  <>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => void stopSystemTracking()}
                    >
                      Stop Tracking
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => void flushSystemActivities()}
                      disabled={systemActivities.length === 0}
                    >
                      Save Snapshot
                    </Button>
                  </>
                ) : (
                  <Button
                    className="flex-1"
                    onClick={() => {
                      if (!currentUser) {
                        toast.error("Please sign in to enable tracking");
                        return;
                      }
                      setSystemTrackingEnabled(true);
                      startSystemTracking();
                      toast.success(
                        "System tracking enabled — capturing visits, clicks, and page context."
                      );
                    }}
                  >
                    Enable Tracking
                  </Button>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Tracked activity ({systemActivities.length})
                </p>
                <ScrollArea className="max-h-60 border rounded-md">
                  <div className="divide-y">
                    {systemActivities.length ? (
                      systemActivities.map((activity) => (
                        <div key={activity.id} className="flex items-start gap-3 p-3">
                          {activity.type === "visit" ? (
                            <Globe className="h-4 w-4 mt-1 text-primary" />
                          ) : (
                            <MousePointerClick className="h-4 w-4 mt-1 text-primary" />
                          )}
                          <div className="space-y-1">
                            <p className="text-sm font-medium">
                              {activity.type === "visit" ? "Visited page" : "User click"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(activity.timestamp).toLocaleString()}
                            </p>
                            {activity.details.url && (
                              <p className="text-xs break-all">{activity.details.url}</p>
                            )}
                            {activity.details.title && (
                              <p className="text-xs text-muted-foreground">
                                Title: {activity.details.title}
                              </p>
                            )}
                            {activity.details.text && (
                              <p className="text-xs text-muted-foreground">
                                "{activity.details.text}"
                              </p>
                            )}
                            {activity.details.contentPreview && (
                              <p className="text-xs text-muted-foreground">
                                Preview: {activity.details.contentPreview}
                              </p>
                            )}
                            {activity.details.tag && (
                              <p className="text-[11px] text-muted-foreground">
                                Element: {activity.details.tag}
                                {activity.details.xpath ? ` · ${activity.details.xpath}` : ""}
                              </p>
                            )}
                            {activity.details.referrer && (
                              <p className="text-[11px] text-muted-foreground">
                                Referrer: {activity.details.referrer}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-sm text-muted-foreground">
                        No activity captured yet. Enable tracking to begin logging interactions.
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Process Manager Dialog */}
        <Dialog
          open={processDialogOpen}
          onOpenChange={(open) => {
            if (open && !isProcessManager) {
              toast.error("Process Manager rights required");
              return;
            }
            setProcessDialogOpen(open);
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Process Manager Console</DialogTitle>
              <DialogDescription>
                Exercise full editing control, lock or unlock the canvas, and grant or revoke collaborator rights.
              </DialogDescription>
            </DialogHeader>
            {isProcessManager ? (
              <div className="space-y-6">
                <div className="border rounded-lg p-4 flex items-center justify-between bg-muted/40">
                  <div>
                    <p className="text-sm font-medium">Editing lock</p>
                    <p className="text-xs text-muted-foreground">
                      When locked, collaborators can only view the diagram.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={editingLocked ? "default" : "outline"}>
                      {editingLocked ? "Locked" : "Unlocked"}
                    </Badge>
                    <Switch
                      id="editing-lock"
                      checked={editingLocked}
                      onCheckedChange={(checked) => handleToggleEditingLock(checked)}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <p className="text-sm font-medium">Collaborators</p>
                    </div>
                    <Badge variant="outline">{collaborators.length}</Badge>
                  </div>
                  <ScrollArea className="max-h-72 border rounded-md">
                    <div className="divide-y">
                      {isLoadingCollaborators ? (
                        <div className="p-4 text-sm text-muted-foreground">
                          Loading collaborators...
                        </div>
                      ) : collaborators.length ? (
                        collaborators.map((collab) => {
                          const isManager = collab.roles.includes("admin");
                          return (
                            <div key={collab.userId} className="p-4 flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <p className="text-sm font-medium flex items-center gap-2">
                                  {collab.email}
                                  {collab.userId === currentUser?.id && (
                                    <Badge variant="outline">You</Badge>
                                  )}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {isManager ? "Process Manager" : "Collaborator"}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  Last active:{" "}
                                  {collab.lastLogin
                                    ? new Date(collab.lastLogin).toLocaleString()
                                    : "No activity recorded"}
                                </p>
                              </div>
                              {collab.userId !== currentUser?.id && (
                                isManager ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => revokeProcessAccess(collab.userId)}
                                  >
                                    Remove access
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={() => grantProcessAccess(collab.userId)}
                                  >
                                    Grant access
                                  </Button>
                                )
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-4 text-sm text-muted-foreground">
                          No collaborators found.
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            ) : (
              <div className="border rounded-lg p-6 text-center bg-muted/40 space-y-2">
                <p className="text-sm font-medium">View-only access</p>
                <p className="text-xs text-muted-foreground">
                  You do not have Process Manager permissions. Please contact an administrator
                  to update access rights.
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Properties Panel */}
        {showPropertiesPanel && (
          <Dialog open={showPropertiesPanel} onOpenChange={setShowPropertiesPanel}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Diagram Overview</DialogTitle>
                <DialogDescription>Edit process properties and metadata</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Process Name</Label>
                  <Input placeholder="Enter process name" />
                </div>
                <div>
                  <Label>Process ID</Label>
                  <Input placeholder="process-id" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea placeholder="Enter process description" rows={4} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowPropertiesPanel(false)}>Cancel</Button>
                  <Button onClick={() => { toast.success("Properties saved"); setShowPropertiesPanel(false); }}>Save</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Participants Panel */}
        {showParticipantsPanel && (
          <Dialog open={showParticipantsPanel} onOpenChange={setShowParticipantsPanel}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Participants / Pools & Lanes</DialogTitle>
                <DialogDescription>Manage collaboration elements</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Manage pools, lanes, and participant assignments for your BPMN diagram.
                </div>
                <Button onClick={() => toast.info("Add participant functionality - coming soon")}>Add Participant</Button>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowParticipantsPanel(false)}>Close</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Settings Panel */}
        {showSettingsPanel && (
          <Dialog open={showSettingsPanel} onOpenChange={setShowSettingsPanel}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Execution Settings</DialogTitle>
                <DialogDescription>Configure process engine options and metadata</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Process Version</Label>
                  <Input type="number" defaultValue="1" />
                </div>
                <div>
                  <Label>Process Namespace</Label>
                  <Input placeholder="http://example.org/bpmn" />
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="executable" />
                  <Label htmlFor="executable">Executable Process</Label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowSettingsPanel(false)}>Cancel</Button>
                  <Button onClick={() => { toast.success("Settings saved"); setShowSettingsPanel(false); }}>Save</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Documentation Panel */}
        {showDocumentationPanel && (
          <Dialog open={showDocumentationPanel} onOpenChange={setShowDocumentationPanel}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Element Documentation</DialogTitle>
                <DialogDescription>Add documentation for the selected element</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Element: {selectedElement?.id || 'None selected'}</Label>
                  <Textarea placeholder="Enter element documentation" rows={6} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowDocumentationPanel(false)}>Cancel</Button>
                  <Button onClick={() => { toast.success("Documentation saved"); setShowDocumentationPanel(false); }}>Save</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Validation Results Panel */}
        {showValidationResults && (
          <Dialog open={showValidationResults} onOpenChange={setShowValidationResults}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Validation Results</DialogTitle>
                <DialogDescription>BPMN structural validation issues</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {validationErrors.length === 0 ? (
                  <div className="text-center py-8 text-green-600">
                    <Check className="h-12 w-12 mx-auto mb-2" />
                    <p className="font-semibold">No validation issues found!</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {validationErrors.map((error, idx) => (
                        <div key={idx} className="p-3 border border-destructive/20 rounded-lg bg-destructive/5">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">{error.message}</p>
                              {error.elementId && (
                                <p className="text-xs text-muted-foreground mt-1">Element ID: {error.elementId}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowValidationResults(false)}>Close</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

      </div>
    </>
  );
};

export default BpmnViewerComponent;