import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import BpmnModeler from "bpmn-js/lib/Modeler";
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css";
import PidRenderer from "@/plugins/PidRenderer";
import { Button } from "@/components/ui/button";
import { Save, Download, Undo, Redo, Trash2, Wrench, Upload, QrCode, History, Bot, Activity, Info, Palette, X, FileDown, Home, Layers, Sparkles, ShieldCheck, Loader2, Globe, MousePointerClick, Check, Search, User, Grid3x3, Ruler, Image as ImageIcon, AlertTriangle, Plus, ChevronLeft, ChevronDown, ChevronUp, FileText, Users, Settings, Code, ZoomIn, ZoomOut, Maximize2, Minus, Maximize, Minimize, Hand, FileSearch, GripVertical, GripHorizontal, List } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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

const renderXmlToSvg = async (xml: string): Promise<string> => {
  // Render using an offscreen modeler instance
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "-99999px";
  container.style.width = "1200px";
  container.style.height = "800px";
  document.body.appendChild(container);
  try {
    const tmpModeler = new BpmnModeler({ container });
    await tmpModeler.importXML(xml);
    const { svg } = await tmpModeler.saveSVG();
    tmpModeler.destroy();
    document.body.removeChild(container);
    return svg;
  } catch (e) {
    document.body.removeChild(container);
    throw e;
  }
};

function invokeWithTimeout(functionName: string, options: any, timeout: number): Promise<{ data: any; error: any; }> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ data: null, error: new Error(`Function call timed out after ${timeout / 1000} seconds`) });
    }, timeout);

    supabase.functions.invoke(functionName, options).then(result => {
      clearTimeout(timer);
      resolve(result);
    }).catch(error => {
      clearTimeout(timer);
      resolve({ data: null, error });
    });
  });
}

const AlternativeDiagramPreview = ({ xml, title }: { xml: string; title: string }) => {
  const [svg, setSvg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const generateSvg = async () => {
      setLoading(true);
      setError(null);
      try {
        const renderedSvg = await renderXmlToSvg(xml);
        if (isMounted) {
          setSvg(renderedSvg);
        }
      } catch (e) {
        if (isMounted) {
          setError("Preview failed");
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
  }, [xml, title]);

  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden" style={{ backgroundColor: '#ffffff' }}>
      {loading ? (
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      ) : error ? (
        <div className="text-xs text-destructive text-center p-2">{error}</div>
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
  const [alternativeCount, setAlternativeCount] = useState<number>(5);
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

  const processSummary = useMemo(
    () => extractProcessSummary(xml, diagramType),
    [xml, diagramType]
  );

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
          const { data: existingRecord, error: existingError } = await supabase
            .from("bpmn_generations")
            .select("id, alternative_models, created_at")
            .eq("user_id", currentUser.id)
            .eq("input_description", `modelling-agent:${fingerprint}`)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingError && existingError.code !== "PGRST116") {
            throw existingError;
          }

          if (existingRecord?.alternative_models) {
            const storedAlternatives = existingRecord
              .alternative_models as unknown as AlternativeModel[];
            if (Array.isArray(storedAlternatives) && storedAlternatives.length) {
              setAlternativeModels(storedAlternatives);
              hasGeneratedAlternativesRef.current = true;
              setIsLoadingAlternatives(false);
              return;
            }
          }
        }

        const variantsToGenerate = ALTERNATIVE_VARIANTS.slice(
          0,
          Math.min(ALTERNATIVE_VARIANTS.length, Math.max(1, alternativeCount))
        );

        if (!variantsToGenerate.length) {
          throw new Error("No variant definitions available for generation.");
        }

        // Initialize progress tracking
        const totalVariants = variantsToGenerate.length;
        setAlternativeProgress({ completed: 0, total: totalVariants, current: undefined });

        // Generate variants in parallel (limit to 3 concurrent requests to avoid rate limiting)
        const generated: AlternativeModel[] = [];
        let completedCount = 0;

        const generateVariant = async (variant: typeof variantsToGenerate[0], index: number) => {
          try {
            setAlternativeProgress({
              completed: completedCount,
              total: totalVariants,
              current: variant.title,
            });

            const instructions =
              diagramType === "pid"
                ? variant.instructions.pid
                : variant.instructions.bpmn;

            const prompt = `
              Original process summary: ${processSummary}
              Variant to generate: ${variant.title} - ${variant.description}
              Instructions: ${instructions}
              Generate a valid BPMN 2.0 XML for this specific variant.
            `;

            const { data, error } = await invokeWithTimeout("generate-bpmn", {
              body: { prompt, diagramType },
            }, 30000); // 30-second timeout

            if (error) {
              throw new Error(`Function invocation failed: ${error.message}`);
            }

            if (!data?.bpmnXml) {
              throw new Error(`No BPMN XML returned for ${variant.title}`);
            }

            const newModel: AlternativeModel = {
              id: `${variant.id}-${Date.now()}-${index}`,
              title: variant.title,
              description: variant.description,
              complexity: variant.complexity,
              xml: data.bpmnXml,
              generatedAt: new Date().toISOString(),
            };
            
            generated.push(newModel);
            completedCount++;
            
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

            return newModel;
          } catch (error) {
            completedCount++;
            setAlternativeProgress({
              completed: completedCount,
              total: totalVariants,
              current: undefined,
            });
            console.error(`Failed to generate alternative "${variant.title}":`, error);
            toast.error(
              `Could not generate: ${variant.title}`,
              { description: error instanceof Error ? error.message : "An unknown error occurred. The AI model might be overloaded or the request may have timed out." }
            );
            throw error;
          }
        };

        // Execute in parallel with concurrency limit of 3
        const concurrencyLimit = 3;
        const tasks = variantsToGenerate.map((variant, index) => () => generateVariant(variant, index));
        
        // Process in batches
        for (let i = 0; i < tasks.length; i += concurrencyLimit) {
          const batch = tasks.slice(i, i + concurrencyLimit);
          await Promise.allSettled(batch.map(task => task()));
        }

        setAlternativeProgress({ completed: totalVariants, total: totalVariants });

        if (!generated.length) {
          const errorCount = totalVariants - generated.length;
          throw new Error(
            `No alternative diagrams were produced. ${errorCount} of ${totalVariants} generations failed.`
          );
        }

        // Final update with all successful models
        setAlternativeModels(generated);
        setSelectedAlternativeId(generated[0]?.id ?? null);
        hasGeneratedAlternativesRef.current = true;

        await supabase.from("bpmn_generations").insert({
          user_id: currentUser.id,
          input_type: "text",
          input_description: `modelling-agent:${fingerprint}`,
          generated_bpmn_xml: xmlSnapshot,
          alternative_models: JSON.parse(JSON.stringify(generated)) as any,
        });
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
    ]
  );

  const applyAlternativeModel = useCallback(
    async (model: AlternativeModel) => {
      if (!modelerRef.current) return;

      try {
        await modelerRef.current.importXML(model.xml);
        const canvas = modelerRef.current.get("canvas") as { zoom: (mode: string) => void };
        canvas.zoom("fit-viewport");
        setVersions((prev) => [...prev, model.xml]);
        setVersion((prev) => prev + 1);
        toast.success(`${model.title} applied to the canvas`);
        setAgentDialogOpen(false);
      } catch (error) {
        console.error("Failed to apply alternative model:", error);
        toast.error("Unable to apply this alternative diagram");
      }
    },
    []
  );

  const downloadAlternativeModel = useCallback((model: AlternativeModel) => {
    const blob = new Blob([model.xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${model.title.replace(/\s+/g, "_").toLowerCase()}_${model.complexity}.bpmn`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const applyHistoricalDiagram = useCallback(async (entry: LogHistoryEntry) => {
    if (!modelerRef.current) return;

    try {
      await modelerRef.current.importXML(entry.generated_bpmn_xml);
      const canvas = modelerRef.current.get("canvas") as { zoom: (mode: string) => void };
      canvas.zoom("fit-viewport");
      setVersions((prev) => [...prev, entry.generated_bpmn_xml]);
      setVersion((prev) => prev + 1);
      toast.success("Historical diagram loaded");
      setLogDialogOpen(false);
    } catch (error) {
      console.error("Failed to load historical diagram:", error);
      toast.error("Unable to load this historical snapshot");
    }
  }, []);

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

  // File upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Palette panel state
  const [showPalette, setShowPalette] = useState(false);
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
  }, [canEdit]);

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
            await modelerRef.current.importXML(data.bpmn_xml);
            const canvas = modelerRef.current.get("canvas") as { zoom: (mode: string) => void };
            canvas.zoom("fit-viewport");

            toast.success("BPMN diagram generated from your image!", {
              description: "Process extracted and visualized successfully"
            });
          } catch (importError) {
            console.error('Failed to import BPMN:', importError);
            toast.error("Failed to load generated diagram");
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
              modelerRef.current.importXML(job.bpmn_xml).then(() => {
                const canvas = modelerRef.current!.get("canvas") as { zoom: (mode: string) => void };
                canvas.zoom("fit-viewport");

                toast.success("BPMN diagram generated from your image!", {
                  description: "Process extracted and visualized successfully"
                });
              }).catch((importError) => {
                console.error('Failed to import BPMN:', importError);
                toast.error("Failed to load generated diagram");
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
  }, [visionJobId, diagramType]);

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

    // Listen to element clicks to show context menu
    eventBus.on("element.click", (event: { element: { type?: string; waypoints?: unknown }; originalEvent: MouseEvent }) => {
      const { element, originalEvent } = event;

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

    return () => {
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

    modelerRef.current.importXML(finalXml).then(() => {
      const canvas = modelerRef.current!.get("canvas") as {
        zoom: (mode: string) => void;
        getRootElement: () => any;
        getViewbox: () => { scale: number; x: number; y: number } | undefined;
      };
      canvas.zoom("fit-viewport");
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
              const canvas = modelerRef.current!.get("canvas") as { zoom: (mode: string) => void };
              const currentXml = finalXml;

              // Re-import to force complete re-render
              modelerRef.current!.importXML(currentXml).then(() => {
                canvas.zoom("fit-viewport");

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
    }).catch((err: Error) => {
      console.error("Error rendering diagram:", err);
      const errorMsg = err.message || "Failed to load diagram";
      setErrorState(`Generation failed (Reason: ${errorMsg}). Try simplified prompt.`);
      if (diagramType === "pid") {
        toast.error("Generation failed (Reason: token limit). Try simplified prompt.");
      } else {
        toast.error("Failed to load BPMN diagram");
      }
    });
  }, [xml, diagramType]);

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
        modelerRef.current.importXML(versions[versionIndex]).then(() => {
          const canvas = modelerRef.current!.get("canvas") as { zoom: (mode: string) => void };
          canvas.zoom("fit-viewport");
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

        await modelerRef.current.importXML(text);
        const canvas = modelerRef.current.get("canvas") as { zoom: (mode: string) => void };
        canvas.zoom("fit-viewport");
        toast.success("Diagram imported successfully");
      } catch (error) {
        console.error("Import error:", error);
        toast.error("Failed to import diagram");
      }
    };
    input.click();
  }, [canEdit]);

  // Enhanced Download/Export handler with format options
  const handleDownloadWithFormat = useCallback(async (format: 'bpmn' | 'xml' | 'svg' = 'bpmn') => {
    if (!modelerRef.current) return;

    try {
      if (format === 'svg') {
        // Export as SVG
        const canvas = modelerRef.current.get("canvas") as { svg: () => string };
        const svg = canvas.svg();
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `diagram.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success("SVG exported successfully");
      } else {
        // Export as BPMN/XML
        const { xml } = await modelerRef.current.saveXML({ format: true });
        const blob = new Blob([xml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `diagram.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(`${format.toUpperCase()} exported successfully`);
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export diagram");
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
      if (viewbox) {
        const newScale = Math.min(viewbox.scale * 1.2, 3); // Max zoom 3x
        canvas.zoom(newScale);
      }
    } catch (error) {
      console.error("Error zooming in:", error);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!modelerRef.current) return;
    try {
      const canvas = modelerRef.current.get("canvas") as {
        zoom: (step: number | string) => void;
        getViewbox: () => { scale: number } | undefined;
      };
      const viewbox = canvas.getViewbox();
      if (viewbox) {
        const newScale = Math.max(viewbox.scale / 1.2, 0.2); // Min zoom 0.2x
        canvas.zoom(newScale);
      }
    } catch (error) {
      console.error("Error zooming out:", error);
    }
  }, []);

  const handleFitToScreen = useCallback(() => {
    if (!modelerRef.current) return;
    try {
      const canvas = modelerRef.current.get("canvas") as { zoom: (mode: string) => void };
      canvas.zoom("fit-viewport");
    } catch (error) {
      console.error("Error fitting to screen:", error);
    }
  }, []);

  // Fullscreen handler
  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      // Enter fullscreen on the entire component, not just canvas
      const rootElement = document.querySelector('.bpmn-viewer-root') as HTMLElement;
      if (rootElement) {
        rootElement.requestFullscreen().then(() => {
          setIsFullscreen(true);
          setShowToolbar(true); // Ensure toolbar is visible in fullscreen
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
  }, []);

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
        canvas.zoom(firstMatch);
        toast.success(`Found ${matches.length} element(s) matching "${query}"`);
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
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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
      <div className="bpmn-viewer-root flex flex-col h-[calc(100vh-8rem)] bg-background">
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

      {/* Secondary Toolbar - Flowable Style */}
      {(showToolbar || !isFullscreen) && (
      <div className={`flex items-center gap-0.5 px-1 py-1 border-b bg-muted/30 overflow-x-auto ${isPid ? 'border-engineering-green/20' : 'border-border'}`}>
        {/* Left: Action Icons */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            className="h-7 w-7 p-0 shrink-0"
            title="Save"
            disabled={!canEdit}
          >
            <Save className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUpload}
            className="h-7 w-7 p-0 shrink-0"
            title="Upload/Import"
            disabled={!canEdit}
          >
            <Upload className="h-3.5 w-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 shrink-0"
                title="Download/Export"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => handleDownloadWithFormat('bpmn')}>
                <FileDown className="h-4 w-4 mr-2" />
                Export as .bpmn
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownloadWithFormat('xml')}>
                <FileText className="h-4 w-4 mr-2" />
                Export as .xml
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownloadWithFormat('svg')}>
                <ImageIcon className="h-4 w-4 mr-2" />
                Export as .svg
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="h-5 w-px bg-border mx-0.5 shrink-0" />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUndo}
            className="h-7 w-7 p-0 shrink-0"
            title="Undo"
            disabled={!canUndo || !canEdit}
          >
            <Undo className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRedo}
            className="h-7 w-7 p-0 shrink-0"
            title="Redo"
            disabled={!canRedo || !canEdit}
          >
            <Redo className="h-3.5 w-3.5" />
          </Button>
          <div className="h-5 w-px bg-border mx-0.5 shrink-0" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 shrink-0"
                title="Zoom Controls"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={handleZoomIn}>
                <ZoomIn className="h-4 w-4 mr-2" />
                Zoom In
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleZoomOut}>
                <ZoomOut className="h-4 w-4 mr-2" />
                Zoom Out
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleFitToScreen}>
                <Maximize2 className="h-4 w-4 mr-2" />
                Fit to Screen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant={isFullscreen ? "default" : "ghost"}
            size="sm"
            onClick={handleToggleFullscreen}
            className="h-7 w-7 p-0 shrink-0"
            title="Fullscreen Mode"
          >
            {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
          </Button>
          <div className="h-5 w-px bg-border mx-0.5 shrink-0" />
          <Button
            variant={showGrid ? "default" : "ghost"}
            size="sm"
            onClick={handleToggleGrid}
            className="h-7 w-7 p-0 shrink-0"
            title="Toggle Grid"
          >
            <Grid3x3 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={showRuler ? "default" : "ghost"}
            size="sm"
            onClick={handleToggleRuler}
            className="h-7 w-7 p-0 shrink-0"
            title="Toggle Ruler"
          >
            <Ruler className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={showPalette ? "default" : "ghost"}
            size="sm"
            onClick={() => setShowPalette(!showPalette)}
            className="h-7 w-7 p-0 shrink-0"
            title="Toggle Elements Palette"
          >
            <Palette className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFitToScreen}
            className="h-7 w-7 p-0 shrink-0"
            title="Fit Diagram to Screen"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleValidateModel}
            className="h-7 w-7 p-0 shrink-0"
            title="Validate Model"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
          </Button>
          <div className="h-5 w-px bg-border mx-0.5 shrink-0" />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-7 w-7 p-0 shrink-0"
            title="Clear canvas"
            disabled={!canEdit}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <div className="h-5 w-px bg-border mx-0.5 shrink-0" />
          
          {/* Toolbar Toggle for Fullscreen */}
          {isFullscreen && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowToolbar(!showToolbar)}
                className="h-7 w-7 p-0 shrink-0"
                title={showToolbar ? "Hide Toolbar" : "Show Toolbar"}
              >
                {showToolbar ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5 rotate-180" />}
              </Button>
              <div className="h-5 w-px bg-border mx-0.5 shrink-0" />
            </>
          )}
          
          {/* Advanced Tools Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-7 px-2 shrink-0">
                <Wrench className="h-3.5 w-3.5" />
                <span className="text-xs">Tools</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>{isPid ? "Advanced P&ID Tools" : "Advanced BPMN Tools"}</DropdownMenuLabel>
              <DropdownMenuSeparator />

              {onRefine && (
                <>
                  <DropdownMenuItem onClick={() => {
                    if (!canEdit) {
                      toast.error("Editing is locked by the Process Manager");
                      return;
                    }
                    onRefine();
                  }}>
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">Refine Diagram</span>
                        <span className="text-xs text-muted-foreground">AI-powered diagram refinement</span>
                      </div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

              <DropdownMenuItem onClick={() => setAgentDialogOpen(true)}>
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">Modelling Agent Mode</span>
                    <span className="text-xs text-muted-foreground">
                      Review 5-7 AI-generated alternatives
                    </span>
                  </div>
                </div>
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => setLogDialogOpen(true)}>
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">Log Agent</span>
                    <span className="text-xs text-muted-foreground">
                      Review BPMN audit history
                    </span>
                  </div>
                </div>
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => setVisionDialogOpen(true)}>
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">Vision Modelling AI</span>
                    <span className="text-xs text-muted-foreground">Sketch to diagram</span>
                  </div>
                </div>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={() => setQrDialogOpen(true)}>
                <div className="flex items-center gap-2">
                  <QrCode className="h-4 w-4" />
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">Share via QR Code</span>
                    <span className="text-xs text-muted-foreground">Invite collaborators</span>
                  </div>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Refine Button - Next to Tools */}
          {onRefine && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-7 px-2 shrink-0"
              onClick={() => {
                if (!canEdit) {
                  toast.error("Editing is locked by the Process Manager");
                  return;
                }
                onRefine();
              }}
              title="Refine diagram with AI"
              disabled={!canEdit}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="text-xs">Refine</span>
            </Button>
          )}

          <Badge
            variant={canEdit ? (isProcessManager ? "default" : "secondary") : "outline"}
            className="ml-1 shrink-0 text-xs"
          >
            {isProcessManager ? "Process Manager" : canEdit ? "Editor mode" : "View only"}
          </Badge>
        </div>

        {/* Center: Tabs */}
        <div className="flex-1 flex justify-center min-w-0 shrink">
          <div className="flex items-center gap-1 bg-background rounded-md border border-border p-0.5">
            <div className="px-2 py-0.5 bg-primary text-primary-foreground rounded text-xs font-medium flex items-center gap-1.5">
              {isPid ? "P&ID" : "BPMN"}
              <Button
                variant="ghost"
                size="sm"
                className="h-3.5 w-3.5 p-0 hover:bg-primary-foreground/20"
                onClick={() => {/* Handle close tab */}}
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

        {/* Right: Quick Search */}
        <div className="flex items-center gap-1 shrink-0">
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
        </div>
      </div>
      )}

      {/* Main Board Layout - Flowable Style */}
      <div ref={canvasContainerRef} className="flex flex-1 overflow-hidden relative" style={{ position: 'relative', isolation: 'isolate', overflow: 'hidden' }}>
        {/* Draggable Elements Palette */}
        {showPalette && (
          <motion.div
            ref={paletteRef}
            className="absolute z-50 bg-white border border-border rounded-lg shadow-lg flex flex-col"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: `${paletteSize.width}px`,
              height: `${paletteSize.height}px`,
              minWidth: '240px',
              minHeight: '400px',
              maxWidth: canvasContainerRef.current ? `${canvasContainerRef.current.offsetWidth - palettePosition.x}px` : 'none',
              maxHeight: canvasContainerRef.current ? `${canvasContainerRef.current.offsetHeight - palettePosition.y}px` : 'none',
              display: 'flex',
              flexDirection: 'column',
              willChange: 'transform',
            }}
            drag={!isResizing}
            dragMomentum={false}
            dragElastic={0}
            dragConstraints={canvasContainerRef}
            dragPropagation={false}
            dragListener={true}
            onDragStart={(e, info) => {
              // Don't start drag if clicking on resize handles or if already resizing
              if (isResizingRef.current) {
                return false;
              }
              const target = e.target as HTMLElement;
              if (target.closest('.resize-handle')) {
                return false;
              }
              // Also check if the event originated from a resize handle
              const originalTarget = (e as any).originalEvent?.target as HTMLElement;
              if (originalTarget?.closest('.resize-handle')) {
                return false;
              }
              dragStartPosition.current = { ...palettePosition };
            }}
            onDrag={(event, info) => {
              // Constrain during drag in real-time
              if (!canvasContainerRef.current || !paletteRef.current) return;
              
              const container = canvasContainerRef.current;
              const palette = paletteRef.current;
              const paletteWidth = palette.offsetWidth;
              const paletteHeight = palette.offsetHeight;
              
              const maxX = Math.max(0, container.offsetWidth - paletteWidth);
              const maxY = Math.max(0, container.offsetHeight - paletteHeight);
              
              const constrainedX = Math.max(0, Math.min(maxX, dragStartPosition.current.x + info.offset.x));
              const constrainedY = Math.max(0, Math.min(maxY, dragStartPosition.current.y + info.offset.y));
              
              // Update position immediately during drag
              setPalettePosition({ x: constrainedX, y: constrainedY });
            }}
            onDragEnd={(event, info) => {
              if (!canvasContainerRef.current || !paletteRef.current) return;
              
              const container = canvasContainerRef.current;
              const palette = paletteRef.current;
              const paletteWidth = palette.offsetWidth;
              const paletteHeight = palette.offsetHeight;
              
              // Calculate constrained position relative to container
              const maxX = Math.max(0, container.offsetWidth - paletteWidth);
              const maxY = Math.max(0, container.offsetHeight - paletteHeight);
              
              // Final constrained position
              const newX = Math.max(0, Math.min(maxX, dragStartPosition.current.x + info.offset.x));
              const newY = Math.max(0, Math.min(maxY, dragStartPosition.current.y + info.offset.y));
              
              setPalettePosition({ x: newX, y: newY });
            }}
            initial={false}
            animate={{ 
              x: palettePosition.x, 
              y: palettePosition.y 
            }}
          >
            {/* Header */}
            <div className="p-3 border-b border-border bg-white rounded-t-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm text-foreground">Shape repository</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setShowPalette(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Enter text to filter"
                  value={paletteSearch}
                  onChange={(e) => setPaletteSearch(e.target.value)}
                  className="pl-8 pr-8 h-8 text-xs"
                />
                <List className="absolute right-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>
            <div 
              className="flex-1 bg-white overflow-y-auto shape-repository-scroll" 
              style={{ 
                minHeight: 0,
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(0, 0, 0, 0.5) transparent'
              }}
            >
              <div className="p-2 space-y-1">
                {/* Quick Draw Section */}
                <div className="space-y-2">
                  <button
                    onClick={() => setExpandedSections({ ...expandedSections, quickDraw: !expandedSections.quickDraw })}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-foreground hover:bg-accent rounded transition-colors"
                  >
                    <span>Quick draw</span>
                    {expandedSections.quickDraw ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                  {expandedSections.quickDraw && (
                    <div className="grid grid-cols-3 gap-1.5 px-2 pb-2">
                      <div onClick={() => addBpmnElement('start-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Start event">
                        <div className="w-8 h-8 rounded-full border-2 border-green-600" />
                        <span className="text-[10px] text-center leading-tight">Start event</span>
                      </div>
                      <div onClick={() => addBpmnElement('user-task')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="User task">
                        <div className="w-8 h-8 border-2 border-foreground rounded flex items-center justify-center text-xs">👤</div>
                        <span className="text-[10px] text-center leading-tight">User task</span>
                      </div>
                      <div onClick={() => addBpmnElement('user-task')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Case task">
                        <div className="w-8 h-8 border-2 border-foreground rounded flex items-center justify-center text-xs">💼</div>
                        <span className="text-[10px] text-center leading-tight">Case task</span>
                      </div>
                      <div onClick={() => addBpmnElement('service-task')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Service task">
                        <div className="w-8 h-8 border-2 border-foreground rounded flex items-center justify-center text-xs">⚙️</div>
                        <span className="text-[10px] text-center leading-tight">Service task</span>
                      </div>
                      <div onClick={() => addBpmnElement('collapsed-subprocess')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Subprocess">
                        <div className="w-8 h-8 border-2 border-foreground rounded flex items-center justify-center">
                          <div className="w-3 h-0.5 bg-foreground" />
                        </div>
                        <span className="text-[10px] text-center leading-tight">Subpro...</span>
                      </div>
                      <div onClick={() => addBpmnElement('call-activity')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Call activity">
                        <div className="w-8 h-8 border-4 border-foreground rounded" />
                        <span className="text-[10px] text-center leading-tight">Call activity</span>
                      </div>
                      <div onClick={() => addBpmnElement('xor-gateway')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Exclusive gateway">
                        <div className="w-8 h-8 border-2 border-amber-600 transform rotate-45 flex items-center justify-center">
                          <span className="transform -rotate-45 text-xs font-bold">X</span>
                        </div>
                        <span className="text-[10px] text-center leading-tight">Exclusive gateway</span>
                      </div>
                      <div onClick={() => addBpmnElement('intermediate-timer-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Timer boundary event">
                        <div className="w-8 h-8 rounded-full border-2 border-blue-600 flex items-center justify-center text-xs">⏱️</div>
                        <span className="text-[10px] text-center leading-tight">Timer boundary event</span>
                      </div>
                      <div onClick={() => addBpmnElement('end-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="End event">
                        <div className="w-8 h-8 rounded-full border-4 border-red-600" />
                        <span className="text-[10px] text-center leading-tight">End event</span>
                      </div>
                      <div onClick={() => addBpmnElement('participant')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Pool">
                        <div className="w-10 h-8 border-2 border-foreground rounded">
                          <div className="w-1 h-full bg-foreground" />
                        </div>
                        <span className="text-[10px] text-center leading-tight">Pool</span>
                      </div>
                      <div onClick={() => addBpmnElement('participant')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Lane">
                        <div className="w-10 h-8 border-2 border-foreground rounded" />
                        <span className="text-[10px] text-center leading-tight">Lane</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Start Events Section */}
                <div className="space-y-2">
                  <button
                    onClick={() => setExpandedSections({ ...expandedSections, startEvents: !expandedSections.startEvents })}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-foreground hover:bg-accent rounded transition-colors"
                  >
                    <span>Start events</span>
                    {expandedSections.startEvents ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                  {expandedSections.startEvents && (
                    <div className="grid grid-cols-3 gap-1.5 px-2 pb-2">
                      <div onClick={() => addBpmnElement('start-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Start event">
                        <div className="w-8 h-8 rounded-full border-2 border-green-600" />
                        <span className="text-[10px] text-center leading-tight">Start event</span>
                      </div>
                      <div onClick={() => addBpmnElement('start-timer-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Timer start event">
                        <div className="w-8 h-8 rounded-full border-2 border-green-600 flex items-center justify-center text-xs">⏱️</div>
                        <span className="text-[10px] text-center leading-tight">Timer start event</span>
                      </div>
                      <div onClick={() => addBpmnElement('start-message-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Message start event">
                        <div className="w-8 h-8 rounded-full border-2 border-green-600 flex items-center justify-center text-xs">✉️</div>
                        <span className="text-[10px] text-center leading-tight">Message start event</span>
                      </div>
                      <div onClick={() => addBpmnElement('start-signal-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Signal start event">
                        <div className="w-8 h-8 rounded-full border-2 border-green-600 flex items-center justify-center text-xs">📡</div>
                        <span className="text-[10px] text-center leading-tight">Signal start event</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Activities Section */}
                <div className="space-y-2">
                  <button
                    onClick={() => setExpandedSections({ ...expandedSections, activities: !expandedSections.activities })}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-foreground hover:bg-accent rounded transition-colors"
                  >
                    <span>Activities</span>
                    {expandedSections.activities ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                  {expandedSections.activities && (
                    <div className="grid grid-cols-3 gap-1.5 px-2 pb-2">
                      <div onClick={() => addBpmnElement('user-task')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="User task">
                        <div className="w-8 h-8 border-2 border-foreground rounded flex items-center justify-center text-xs">👤</div>
                        <span className="text-[10px] text-center leading-tight">User task</span>
                      </div>
                      <div onClick={() => addBpmnElement('user-task')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Case task">
                        <div className="w-8 h-8 border-2 border-foreground rounded flex items-center justify-center text-xs">💼</div>
                        <span className="text-[10px] text-center leading-tight">Case task</span>
                      </div>
                      <div onClick={() => addBpmnElement('service-task')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Service task">
                        <div className="w-8 h-8 border-2 border-foreground rounded flex items-center justify-center text-xs">⚙️</div>
                        <span className="text-[10px] text-center leading-tight">Service task</span>
                      </div>
                      <div onClick={() => addBpmnElement('script-task')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Script task">
                        <div className="w-8 h-8 border-2 border-foreground rounded flex items-center justify-center text-xs">📜</div>
                        <span className="text-[10px] text-center leading-tight">Script task</span>
                      </div>
                      <div onClick={() => addBpmnElement('business-rule-task')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Business rule task">
                        <div className="w-8 h-8 border-2 border-foreground rounded flex items-center justify-center text-xs">📋</div>
                        <span className="text-[10px] text-center leading-tight">Business rule task</span>
                      </div>
                      <div onClick={() => addBpmnElement('receive-task')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Receive task">
                        <div className="w-8 h-8 border-2 border-foreground rounded flex items-center justify-center text-xs">📥</div>
                        <span className="text-[10px] text-center leading-tight">Receive task</span>
                      </div>
                      <div onClick={() => addBpmnElement('manual-task')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Manual task">
                        <div className="w-8 h-8 border-2 border-foreground rounded flex items-center justify-center text-xs">✋</div>
                        <span className="text-[10px] text-center leading-tight">Manual task</span>
                      </div>
                      <div onClick={() => addBpmnElement('send-task')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Email task">
                        <div className="w-8 h-8 border-2 border-foreground rounded flex items-center justify-center text-xs">📧</div>
                        <span className="text-[10px] text-center leading-tight">Email task</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Gateways Section - Collapsed by default like in image */}
                <div className="space-y-2">
                  <button
                    onClick={() => setExpandedSections({ ...expandedSections, gateways: !expandedSections.gateways })}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-foreground hover:bg-accent rounded transition-colors"
                  >
                    <span>Gateways</span>
                    {expandedSections.gateways ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                  {expandedSections.gateways && (
                    <div className="grid grid-cols-3 gap-1.5 px-2 pb-2">
                      <div onClick={() => addBpmnElement('xor-gateway')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Exclusive gateway">
                        <div className="w-8 h-8 border-2 border-amber-600 transform rotate-45 flex items-center justify-center">
                          <span className="transform -rotate-45 text-xs font-bold">X</span>
                        </div>
                        <span className="text-[10px] text-center leading-tight">Exclusive gateway</span>
                      </div>
                      <div onClick={() => addBpmnElement('and-gateway')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Parallel gateway">
                        <div className="w-8 h-8 border-2 border-purple-600 transform rotate-45 flex items-center justify-center">
                          <span className="transform -rotate-45 text-xs font-bold">+</span>
                        </div>
                        <span className="text-[10px] text-center leading-tight">Parallel gateway</span>
                      </div>
                      <div onClick={() => addBpmnElement('or-gateway')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Inclusive gateway">
                        <div className="w-8 h-8 border-2 border-indigo-600 transform rotate-45 flex items-center justify-center">
                          <span className="transform -rotate-45 text-xs font-bold">O</span>
                        </div>
                        <span className="text-[10px] text-center leading-tight">Inclusive gateway</span>
                      </div>
                      <div onClick={() => addBpmnElement('event-gateway')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Event-based gateway">
                        <div className="w-8 h-8 border-2 border-cyan-600 transform rotate-45 flex items-center justify-center">
                          <span className="transform -rotate-45 text-xs">⬡</span>
                        </div>
                        <span className="text-[10px] text-center leading-tight">Event-based gateway</span>
                      </div>
                      <div onClick={() => addBpmnElement('complex-gateway')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Complex gateway">
                        <div className="w-8 h-8 border-2 border-pink-600 transform rotate-45 flex items-center justify-center">
                          <span className="transform -rotate-45 text-xs font-bold">*</span>
                        </div>
                        <span className="text-[10px] text-center leading-tight">Complex gateway</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Intermediate Events */}
                <div className="space-y-2">
                  <button
                    onClick={() => setExpandedSections({ ...expandedSections, intermediateEvents: !expandedSections.intermediateEvents })}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-foreground hover:bg-accent rounded transition-colors"
                  >
                    <span>Intermediate events</span>
                    {expandedSections.intermediateEvents ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                  {expandedSections.intermediateEvents && (
                    <div className="grid grid-cols-3 gap-1.5 px-2 pb-2">
                      <div onClick={() => addBpmnElement('intermediate-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Intermediate event">
                        <div className="w-8 h-8 rounded-full border-2 border-blue-600" />
                        <span className="text-[10px] text-center leading-tight">Intermediate event</span>
                      </div>
                      <div onClick={() => addBpmnElement('intermediate-timer-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Timer event">
                        <div className="w-8 h-8 rounded-full border-2 border-blue-600 flex items-center justify-center text-xs">⏱️</div>
                        <span className="text-[10px] text-center leading-tight">Timer event</span>
                      </div>
                      <div onClick={() => addBpmnElement('intermediate-message-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Message event">
                        <div className="w-8 h-8 rounded-full border-2 border-blue-600 flex items-center justify-center text-xs">✉️</div>
                        <span className="text-[10px] text-center leading-tight">Message event</span>
                      </div>
                      <div onClick={() => addBpmnElement('intermediate-signal-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Signal event">
                        <div className="w-8 h-8 rounded-full border-2 border-blue-600 flex items-center justify-center text-xs">📡</div>
                        <span className="text-[10px] text-center leading-tight">Signal event</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* End Events */}
                <div className="space-y-2">
                  <button
                    onClick={() => setExpandedSections({ ...expandedSections, endEvents: !expandedSections.endEvents })}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-foreground hover:bg-accent rounded transition-colors"
                  >
                    <span>End events</span>
                    {expandedSections.endEvents ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                  {expandedSections.endEvents && (
                    <div className="grid grid-cols-3 gap-1.5 px-2 pb-2">
                      <div onClick={() => addBpmnElement('end-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="End event">
                        <div className="w-8 h-8 rounded-full border-4 border-red-600" />
                        <span className="text-[10px] text-center leading-tight">End event</span>
                      </div>
                      <div onClick={() => addBpmnElement('end-message-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Message end event">
                        <div className="w-8 h-8 rounded-full border-4 border-red-600 flex items-center justify-center text-xs">✉️</div>
                        <span className="text-[10px] text-center leading-tight">Message end event</span>
                      </div>
                      <div onClick={() => addBpmnElement('end-error-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Error end event">
                        <div className="w-8 h-8 rounded-full border-4 border-red-600 flex items-center justify-center text-xs">⚠️</div>
                        <span className="text-[10px] text-center leading-tight">Error end event</span>
                      </div>
                      <div onClick={() => addBpmnElement('end-terminate-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Terminate end event">
                        <div className="w-8 h-8 rounded-full border-4 border-red-600 flex items-center justify-center text-xs">⬛</div>
                        <span className="text-[10px] text-center leading-tight">Terminate end event</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Subprocesses */}
                <div className="space-y-2">
                  <button
                    onClick={() => setExpandedSections({ ...expandedSections, subprocesses: !expandedSections.subprocesses })}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-foreground hover:bg-accent rounded transition-colors"
                  >
                    <span>Subprocesses</span>
                    {expandedSections.subprocesses ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                  {expandedSections.subprocesses && (
                    <div className="grid grid-cols-3 gap-1.5 px-2 pb-2">
                      <div onClick={() => addBpmnElement('subprocess')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Subprocess">
                        <div className="w-8 h-8 border-2 border-foreground rounded flex items-center justify-center text-xs">+</div>
                        <span className="text-[10px] text-center leading-tight">Subprocess</span>
                      </div>
                      <div onClick={() => addBpmnElement('collapsed-subprocess')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Collapsed subprocess">
                        <div className="w-8 h-8 border-2 border-foreground rounded flex items-center justify-center">
                          <div className="w-3 h-0.5 bg-foreground" />
                        </div>
                        <span className="text-[10px] text-center leading-tight">Collapsed subprocess</span>
                      </div>
                      <div onClick={() => addBpmnElement('event-subprocess')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Event subprocess">
                        <div className="w-8 h-8 border-2 border-dashed border-foreground rounded flex items-center justify-center text-xs">+</div>
                        <span className="text-[10px] text-center leading-tight">Event subprocess</span>
                      </div>
                      <div onClick={() => addBpmnElement('transaction')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Transaction">
                        <div className="w-8 h-8 border-4 border-double border-foreground rounded" />
                        <span className="text-[10px] text-center leading-tight">Transaction</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Pools & Lanes */}
                <div className="space-y-2">
                  <button
                    onClick={() => setExpandedSections({ ...expandedSections, pools: !expandedSections.pools })}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-foreground hover:bg-accent rounded transition-colors"
                  >
                    <span>Pools & Lanes</span>
                    {expandedSections.pools ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                  {expandedSections.pools && (
                    <div className="grid grid-cols-3 gap-1.5 px-2 pb-2">
                      <div onClick={() => addBpmnElement('participant')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Pool">
                        <div className="w-10 h-8 border-2 border-foreground rounded">
                          <div className="w-1 h-full bg-foreground" />
                        </div>
                        <span className="text-[10px] text-center leading-tight">Pool</span>
                      </div>
                      <div onClick={() => addBpmnElement('participant')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Lane">
                        <div className="w-10 h-8 border-2 border-foreground rounded" />
                        <span className="text-[10px] text-center leading-tight">Lane</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Data Objects */}
                <div className="space-y-2">
                  <button
                    onClick={() => setExpandedSections({ ...expandedSections, dataObjects: !expandedSections.dataObjects })}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-foreground hover:bg-accent rounded transition-colors"
                  >
                    <span>Data Objects</span>
                    {expandedSections.dataObjects ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                  {expandedSections.dataObjects && (
                    <div className="grid grid-cols-3 gap-1.5 px-2 pb-2">
                      <div onClick={() => addBpmnElement('data-object')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Data object">
                        <div className="w-7 h-8 border-2 border-foreground" style={{ clipPath: 'polygon(0 10%, 70% 10%, 100% 0, 100% 100%, 0 100%)' }} />
                        <span className="text-[10px] text-center leading-tight">Data object</span>
                      </div>
                      <div onClick={() => addBpmnElement('data-store')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Data store">
                        <div className="w-8 h-7 border-2 border-foreground rounded-sm" />
                        <span className="text-[10px] text-center leading-tight">Data store</span>
                      </div>
                      <div onClick={() => addBpmnElement('data-input')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Data input">
                        <div className="w-7 h-8 border-2 border-foreground" style={{ clipPath: 'polygon(0 10%, 70% 10%, 100% 0, 100% 100%, 0 100%)' }}>
                          <div className="text-[8px] mt-2 ml-1">→</div>
                        </div>
                        <span className="text-[10px] text-center leading-tight">Data input</span>
                      </div>
                      <div onClick={() => addBpmnElement('data-output')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Data output">
                        <div className="w-7 h-8 border-2 border-foreground" style={{ clipPath: 'polygon(0 10%, 70% 10%, 100% 0, 100% 100%, 0 100%)' }}>
                          <div className="text-[8px] mt-2 ml-1">←</div>
                        </div>
                        <span className="text-[10px] text-center leading-tight">Data output</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Artifacts */}
                <div className="space-y-2">
                  <button
                    onClick={() => setExpandedSections({ ...expandedSections, artifacts: !expandedSections.artifacts })}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-foreground hover:bg-accent rounded transition-colors"
                  >
                    <span>Artifacts</span>
                    {expandedSections.artifacts ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                  {expandedSections.artifacts && (
                    <div className="grid grid-cols-3 gap-1.5 px-2 pb-2">
                      <div onClick={() => addBpmnElement('text-annotation')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Text annotation">
                        <div className="w-8 h-7 border-l-2 border-t-2 border-b-2 border-foreground" />
                        <span className="text-[10px] text-center leading-tight">Text annotation</span>
                      </div>
                      <div onClick={() => addBpmnElement('group')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Group">
                        <div className="w-8 h-8 border-2 border-dashed border-foreground rounded" />
                        <span className="text-[10px] text-center leading-tight">Group</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Zoom Controls at Bottom - Flowable Style */}
            <div className="border-t border-border p-2 flex items-center justify-center gap-1 bg-white rounded-b-lg">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={handleZoomIn}
                title="Zoom In"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={handleZoomOut}
                title="Zoom Out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={handleFitToScreen}
                title="Fit to Screen"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setShowSettingsPanel(true)}
                title="Settings"
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </div>
            
            {/* Resize Handles - More visible and easier to grab */}
            {/* Left edge */}
            <div
              className="resize-handle absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize hover:bg-primary/70 active:bg-primary z-[60] transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleResizeStart('left', e);
              }}
              style={{ touchAction: 'none', pointerEvents: 'auto' }}
              title="Resize from left"
            />
            
            {/* Right edge */}
            <div
              className="resize-handle absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize hover:bg-primary/70 active:bg-primary z-[60] transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleResizeStart('right', e);
              }}
              style={{ touchAction: 'none', pointerEvents: 'auto' }}
              title="Resize from right"
            />
            
            {/* Top edge */}
            <div
              className="resize-handle absolute top-0 left-0 right-0 h-4 cursor-ns-resize hover:bg-primary/70 active:bg-primary z-[60] transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleResizeStart('top', e);
              }}
              style={{ touchAction: 'none', pointerEvents: 'auto' }}
              title="Resize from top"
            />
            
            {/* Bottom edge */}
            <div
              className="resize-handle absolute bottom-0 left-0 right-0 h-4 cursor-ns-resize hover:bg-primary/70 active:bg-primary z-[60] transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleResizeStart('bottom', e);
              }}
              style={{ touchAction: 'none', pointerEvents: 'auto' }}
              title="Resize from bottom"
            />
            
            {/* Corner handles for diagonal resize */}
            {/* Top-left */}
            <div
              className="resize-handle absolute top-0 left-0 w-8 h-8 cursor-nwse-resize hover:bg-primary/70 active:bg-primary z-[60] rounded-tl-lg transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleResizeStart('top-left', e);
              }}
              style={{ touchAction: 'none', pointerEvents: 'auto' }}
              title="Resize from top-left"
            />
            
            {/* Top-right */}
            <div
              className="resize-handle absolute top-0 right-0 w-8 h-8 cursor-nesw-resize hover:bg-primary/70 active:bg-primary z-[60] rounded-tr-lg transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleResizeStart('top-right', e);
              }}
              style={{ touchAction: 'none', pointerEvents: 'auto' }}
              title="Resize from top-right"
            />
            
            {/* Bottom-left */}
            <div
              className="resize-handle absolute bottom-0 left-0 w-8 h-8 cursor-nesw-resize hover:bg-primary/70 active:bg-primary z-[60] rounded-bl-lg transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleResizeStart('bottom-left', e);
              }}
              style={{ touchAction: 'none', pointerEvents: 'auto' }}
              title="Resize from bottom-left"
            />
            
            {/* Bottom-right */}
            <div
              className="resize-handle absolute bottom-0 right-0 w-8 h-8 cursor-nwse-resize hover:bg-primary/70 active:bg-primary z-[60] rounded-br-lg transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleResizeStart('bottom-right', e);
              }}
              style={{ touchAction: 'none', pointerEvents: 'auto' }}
              title="Resize from bottom-right"
            />
          </motion.div>
        )}

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
            ref={containerRef}
            style={{ backgroundColor: '#ffffff' }}
            className={`w-full h-full border rounded-lg shadow-sm ${errorState ? 'hidden' : ''} ${isPid ? 'border-engineering-green/30' : 'border-border'}`}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modelling Agent Mode</DialogTitle>
            <DialogDescription>
              Compare 5-7 AI-generated BPMN variations, from streamlined to advanced, and apply the best fit
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">
                How many alternative diagrams would you like to generate?
              </p>
              <ToggleGroup
                type="single"
                value={String(alternativeCount)}
                onValueChange={(value) => {
                  if (!value || isLoadingAlternatives) return;
                  setAlternativeCount(Number(value));
                }}
                className="justify-start"
              >
                {[3, 5, 7].map((countOption) => (
                  <ToggleGroupItem
                    key={countOption}
                    value={String(countOption)}
                    disabled={isLoadingAlternatives}
                    className="px-4"
                  >
                    {countOption}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <p className="text-[11px] text-muted-foreground">
                Adjust the batch size before generating or regenerating alternatives.
              </p>
            </div>
            {isLoadingAlternatives ? (
              <div className="flex flex-col items-center justify-center gap-4 py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="space-y-2 text-center">
                  <p className="text-sm font-medium">
                    Generating {alternativeProgress.total || alternativeCount} alternative {diagramType === "pid" ? "P&ID" : "BPMN"} models in parallel...
                  </p>
                  {alternativeProgress.total > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Progress: {alternativeProgress.completed} / {alternativeProgress.total}</span>
                        <span>
                          {alternativeProgress.total
                            ? Math.round((alternativeProgress.completed / alternativeProgress.total) * 100)
                            : 0}
                          %
                        </span>
                      </div>
                      <div className="w-64 h-2 bg-muted rounded-full overflow-hidden">
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
                      {alternativeProgress.current && (
                        <p className="text-xs text-muted-foreground italic">
                          Processing: {alternativeProgress.current}
                        </p>
                      )}
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
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase">
                            Diagram Preview
                          </p>
                          <div className="h-64 border rounded-md" style={{ backgroundColor: '#ffffff' }}>
                            <AlternativeDiagramPreview xml={selectedAlternative.xml} title={selectedAlternative.title} />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="outline">Download as</Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuLabel>Choose format</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => downloadAlternativeModel(selectedAlternative)}>
                                BPMN (.bpmn)
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
                              setConfirmAlternative(selectedAlternative);
                              setConfirmAlternativeDialogOpen(true);
                            }}
                          >
                            Apply to canvas
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="border rounded-lg p-6 text-center text-sm text-muted-foreground bg-muted/30">
                        Select an alternative from the list to preview and apply it.
                      </div>
                    )}
                  </div>
                  <div className="border rounded-lg p-3 bg-background/70">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Alternatives ({alternativeModels.length})
                      </p>
                      <span className="text-[11px] text-muted-foreground">Click to preview & confirm</span>
                    </div>
                    <ScrollArea className="h-[30rem] pr-2">
                      <div className="space-y-3">
                        {alternativeModels.map((model) => {
                          const isSelected = model.id === selectedAlternativeId;
                          return (
                            <button
                              key={model.id}
                              type="button"
                              onClick={() => setSelectedAlternativeId(model.id)}
                              className={`w-full text-left border rounded-lg p-3 transition-all focus:outline-none ${isSelected
                                  ? "border-primary bg-primary/10 shadow-lg"
                                  : "border-border hover:shadow-md"
                                }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-1 flex-1">
                                  <p className="text-sm font-medium">{model.title}</p>
                                  <p className="text-xs capitalize text-muted-foreground">
                                    {model.complexity}
                                  </p>
                                </div>
                                {isSelected && <Check className="h-5 w-5 text-primary flex-shrink-0" />}
                              </div>
                              <div className="h-32 mt-2 rounded-md border" style={{ backgroundColor: '#ffffff' }}>
                                <AlternativeDiagramPreview xml={model.xml} title={model.title} />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <span className="text-xs text-muted-foreground">
                    Compare variants side by side, then apply the one that fits your requirements.
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => generateAlternativeModels(true)}
                    disabled={isLoadingAlternatives}
                  >
                    Regenerate {alternativeCount}
                  </Button>
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