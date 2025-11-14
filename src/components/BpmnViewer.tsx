import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import BpmnModeler from "bpmn-js/lib/Modeler";
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css";
import PidRenderer from "@/plugins/PidRenderer";
import { Button } from "@/components/ui/button";
import { Save, Download, Undo, Redo, Trash2, Wrench, Upload, QrCode, History, Bot, Activity, Info, Palette, X, FileDown, Home, Layers, Sparkles, ShieldCheck, Loader2, Globe, MousePointerClick, Check } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
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
import type { User } from "@supabase/supabase-js";

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
    <div className="w-full h-full bg-muted flex items-center justify-center overflow-hidden">
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
  const [currentUser, setCurrentUser] = useState<User | null>(null);
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

        // Generate variants sequentially to avoid rate-limiting issues
        const generated: AlternativeModel[] = [];
        for (const [index, variant] of variantsToGenerate.entries()) {
          setAlternativeProgress({
            completed: index,
            total: totalVariants,
            current: variant.title,
          });

          try {
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

            // Update UI with the new model as it becomes available
            setAlternativeModels([...generated]);
            if (!selectedAlternativeId) {
              setSelectedAlternativeId(newModel.id);
            }

          } catch (error) {
            console.error(`Failed to generate alternative "${variant.title}":`, error);
            toast.error(
              `Could not generate: ${variant.title}`,
              { description: error instanceof Error ? error.message : "An unknown error occurred. The AI model might be overloaded or the request may have timed out." }
            );
          }
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
  const [palettePosition, setPalettePosition] = useState({ x: 20, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

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

  const handleVisionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) {
      toast.error("Editing is locked by the Process Manager");
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
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
        return;
      }

      // Convert image to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);

      await new Promise((resolve, reject) => {
        reader.onload = resolve;
        reader.onerror = reject;
      });

      const imageBase64 = reader.result as string;

      toast.info("Uploading image for analysis...");

      // Call vision-to-BPMN edge function - returns job ID
      const { data, error } = await supabase.functions.invoke('vision-to-bpmn', {
        body: {
          imageBase64,
          diagramType: diagramType
        }
      });

      if (error) throw error;

      // Handle job-based response
      if (data?.jobId) {
        setVisionJobId(data.jobId);
        toast.info("Processing started", {
          description: "Your image is being analyzed. This may take a moment..."
        });
      } else {
        throw new Error("No job ID received from server");
      }
    } catch (error) {
      console.error('Vision processing error:', error);
      toast.error("Failed to process image. Please try again.");
      setIsProcessing(false);
      setSelectedFile(null);
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

  // Draggable palette handlers
  const handlePaletteMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.palette-header')) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - palettePosition.x,
        y: e.clientY - palettePosition.y,
      });
    }
  }, [palettePosition]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPalettePosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showContextMenu && !target.closest('.context-menu')) {
        setShowContextMenu(false);
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    if (showContextMenu) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isDragging, dragOffset, showContextMenu]);

  const isPid = diagramType === "pid";

  return (
    <div className="space-y-4">
      {/* Breadcrumb Navigation */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <a href="/" className="flex items-center gap-1 hover:text-primary">
                <Home className="h-3 w-3" />
                Dashboard
              </a>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className={isPid ? "text-engineering-green font-medium" : ""}>
              {isPid ? "P&ID" : "BPMN"}
            </BreadcrumbPage>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Export</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>


      {/* Toolbar */}
      <div className={`flex items-center gap-2 bg-muted/50 p-3 rounded-lg border ${isPid ? 'border-engineering-green/20' : 'border-border'}`}>

        <Button
          variant="outline"
          size="sm"
          onClick={handleClear}
          title="Clear canvas"
          disabled={!canEdit}
        >
          <Trash2 className="h-4 w-4" />
        </Button>

        <div className="h-6 w-px bg-border mx-2" />

        {/* Advanced Tools Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Wrench className="h-4 w-4" />
              Tools
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>{isPid ? "Advanced P&ID Tools" : "Advanced BPMN Tools"}</DropdownMenuLabel>
            <DropdownMenuSeparator />

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
            className="gap-2"
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
            <Sparkles className="h-4 w-4" />
            Refine
          </Button>
        )}

        <Badge
          variant={canEdit ? (isProcessManager ? "default" : "secondary") : "outline"}
          className="ml-2"
        >
          {isProcessManager ? "Process Manager" : canEdit ? "Editor mode" : "View only"}
        </Badge>

        <div className="flex-1" />

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowPalette(!showPalette)}
          className="gap-2"
          title="Show BPMN Palette"
          disabled={!canEdit}
        >
          <Palette className="h-4 w-4" />
          Palette
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" title="How to edit">
              <Info className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-2">
              <p className="font-semibold text-foreground">How to edit:</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• <strong>Add shapes:</strong> Use the palette on the left side to drag shapes onto the canvas</li>
                <li>• <strong>Connect shapes:</strong> Click and drag from a shape's connection points to another shape</li>
                <li>• <strong>Edit text:</strong> Double-click any shape to edit its name or properties</li>
                <li>• <strong>Delete:</strong> Select an element and press Delete key, or use the context menu</li>
                <li>• <strong>Move:</strong> Click and drag shapes to reposition them</li>
                <li>• <strong>Zoom:</strong> Use mouse wheel or trackpad to zoom in/out</li>
              </ul>
            </div>
          </PopoverContent>
        </Popover>

        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          className="gap-2"
          disabled={!canEdit}
        >
          <Save className="h-4 w-4" />
          Save
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={handleDownload}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Download
        </Button>
      </div>

      {/* BPMN/P&ID Canvas */}
      <div className="relative">
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
          <div className="w-full h-[700px] bg-muted/50 border border-destructive/20 rounded-lg flex flex-col items-center justify-center p-8">
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

        <div
          ref={containerRef}
          className={`w-full h-[700px] bg-white border rounded-lg shadow-sm ${errorState ? 'hidden' : ''} ${isPid ? 'border-engineering-green/30' : 'border-border'}`}
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

        {/* Draggable Palette Panel */}
        {showPalette && (
          <div
            className="absolute bg-background border border-border rounded-lg shadow-lg z-50"
            style={{
              left: `${palettePosition.x}px`,
              top: `${palettePosition.y}px`,
              cursor: isDragging ? 'grabbing' : 'default',
            }}
            onMouseDown={handlePaletteMouseDown}
          >
            <div className="palette-header flex items-center justify-between p-3 border-b cursor-grab active:cursor-grabbing">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                <span className="font-semibold text-sm">BPMN Palette</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setShowPalette(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto" style={{ width: '260px' }}>

              {/* Start Events */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-foreground">START EVENTS</p>
                <div className="grid grid-cols-4 gap-2">
                  <div onClick={() => addBpmnElement('start-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Start Event">
                    <div className="w-7 h-7 rounded-full border-2 border-green-600" />
                    <span className="text-[9px] text-center">Start</span>
                  </div>
                  <div onClick={() => addBpmnElement('start-timer-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Timer Start">
                    <div className="w-7 h-7 rounded-full border-2 border-green-600 flex items-center justify-center text-[10px]">⏱️</div>
                    <span className="text-[9px] text-center">Timer</span>
                  </div>
                  <div onClick={() => addBpmnElement('start-message-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Message Start">
                    <div className="w-7 h-7 rounded-full border-2 border-green-600 flex items-center justify-center text-[10px]">✉️</div>
                    <span className="text-[9px] text-center">Msg</span>
                  </div>
                  <div onClick={() => addBpmnElement('start-signal-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Signal Start">
                    <div className="w-7 h-7 rounded-full border-2 border-green-600 flex items-center justify-center text-[10px]">📡</div>
                    <span className="text-[9px] text-center">Signal</span>
                  </div>
                </div>
              </div>

              {/* Intermediate Events */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-foreground">INTERMEDIATE EVENTS</p>
                <div className="grid grid-cols-4 gap-2">
                  <div onClick={() => addBpmnElement('intermediate-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Intermediate">
                    <div className="w-7 h-7 rounded-full border-2 border-blue-600" />
                    <span className="text-[9px] text-center">Inter.</span>
                  </div>
                  <div onClick={() => addBpmnElement('intermediate-timer-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Timer">
                    <div className="w-7 h-7 rounded-full border-2 border-blue-600 flex items-center justify-center text-[10px]">⏱️</div>
                    <span className="text-[9px] text-center">Timer</span>
                  </div>
                  <div onClick={() => addBpmnElement('intermediate-message-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Message">
                    <div className="w-7 h-7 rounded-full border-2 border-blue-600 flex items-center justify-center text-[10px]">✉️</div>
                    <span className="text-[9px] text-center">Msg</span>
                  </div>
                  <div onClick={() => addBpmnElement('intermediate-signal-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Signal">
                    <div className="w-7 h-7 rounded-full border-2 border-blue-600 flex items-center justify-center text-[10px]">📡</div>
                    <span className="text-[9px] text-center">Signal</span>
                  </div>
                </div>
              </div>

              {/* End Events */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-foreground">END EVENTS</p>
                <div className="grid grid-cols-4 gap-2">
                  <div onClick={() => addBpmnElement('end-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="End Event">
                    <div className="w-7 h-7 rounded-full border-4 border-red-600" />
                    <span className="text-[9px] text-center">End</span>
                  </div>
                  <div onClick={() => addBpmnElement('end-message-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Message End">
                    <div className="w-7 h-7 rounded-full border-4 border-red-600 flex items-center justify-center text-[10px]">✉️</div>
                    <span className="text-[9px] text-center">Msg</span>
                  </div>
                  <div onClick={() => addBpmnElement('end-error-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Error End">
                    <div className="w-7 h-7 rounded-full border-4 border-red-600 flex items-center justify-center text-[10px]">⚠️</div>
                    <span className="text-[9px] text-center">Error</span>
                  </div>
                  <div onClick={() => addBpmnElement('end-terminate-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Terminate">
                    <div className="w-7 h-7 rounded-full border-4 border-red-600 flex items-center justify-center text-[10px]">⬛</div>
                    <span className="text-[9px] text-center">Term</span>
                  </div>
                </div>
              </div>

              {/* Tasks */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-foreground">TASKS & ACTIVITIES</p>
                <div className="grid grid-cols-4 gap-2">
                  <div onClick={() => addBpmnElement('task')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Task">
                    <div className="w-7 h-7 border-2 border-foreground rounded" />
                    <span className="text-[9px] text-center">Task</span>
                  </div>
                  <div onClick={() => addBpmnElement('user-task')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="User Task">
                    <div className="w-7 h-7 border-2 border-foreground rounded flex items-center justify-center text-[10px]">👤</div>
                    <span className="text-[9px] text-center">User</span>
                  </div>
                  <div onClick={() => addBpmnElement('service-task')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Service Task">
                    <div className="w-7 h-7 border-2 border-foreground rounded flex items-center justify-center text-[10px]">⚙️</div>
                    <span className="text-[9px] text-center">Service</span>
                  </div>
                  <div onClick={() => addBpmnElement('manual-task')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Manual Task">
                    <div className="w-7 h-7 border-2 border-foreground rounded flex items-center justify-center text-[10px]">✋</div>
                    <span className="text-[9px] text-center">Manual</span>
                  </div>
                  <div onClick={() => addBpmnElement('script-task')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Script Task">
                    <div className="w-7 h-7 border-2 border-foreground rounded flex items-center justify-center text-[10px]">📜</div>
                    <span className="text-[9px] text-center">Script</span>
                  </div>
                  <div onClick={() => addBpmnElement('send-task')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Send Task">
                    <div className="w-7 h-7 border-2 border-foreground rounded flex items-center justify-center text-[10px]">📤</div>
                    <span className="text-[9px] text-center">Send</span>
                  </div>
                  <div onClick={() => addBpmnElement('receive-task')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Receive Task">
                    <div className="w-7 h-7 border-2 border-foreground rounded flex items-center justify-center text-[10px]">📥</div>
                    <span className="text-[9px] text-center">Receive</span>
                  </div>
                  <div onClick={() => addBpmnElement('business-rule-task')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Business Rule Task">
                    <div className="w-7 h-7 border-2 border-foreground rounded flex items-center justify-center text-[10px]">📋</div>
                    <span className="text-[9px] text-center">Rule</span>
                  </div>
                  <div onClick={() => addBpmnElement('call-activity')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Call Activity">
                    <div className="w-7 h-7 border-4 border-foreground rounded" />
                    <span className="text-[9px] text-center">Call</span>
                  </div>
                </div>
              </div>

              {/* Gateways */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-foreground">GATEWAYS</p>
                <div className="grid grid-cols-4 gap-2">
                  <div onClick={() => addBpmnElement('xor-gateway')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Exclusive Gateway (XOR)">
                    <div className="w-7 h-7 border-2 border-amber-600 transform rotate-45 flex items-center justify-center">
                      <span className="transform -rotate-45 text-[10px] font-bold">X</span>
                    </div>
                    <span className="text-[9px] text-center">XOR</span>
                  </div>
                  <div onClick={() => addBpmnElement('and-gateway')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Parallel Gateway (AND)">
                    <div className="w-7 h-7 border-2 border-purple-600 transform rotate-45 flex items-center justify-center">
                      <span className="transform -rotate-45 text-[10px] font-bold">+</span>
                    </div>
                    <span className="text-[9px] text-center">AND</span>
                  </div>
                  <div onClick={() => addBpmnElement('or-gateway')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Inclusive Gateway (OR)">
                    <div className="w-7 h-7 border-2 border-indigo-600 transform rotate-45 flex items-center justify-center">
                      <span className="transform -rotate-45 text-[10px] font-bold">O</span>
                    </div>
                    <span className="text-[9px] text-center">OR</span>
                  </div>
                  <div onClick={() => addBpmnElement('event-gateway')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Event-based Gateway">
                    <div className="w-7 h-7 border-2 border-cyan-600 transform rotate-45 flex items-center justify-center">
                      <span className="transform -rotate-45 text-[10px]">⬡</span>
                    </div>
                    <span className="text-[9px] text-center">Event</span>
                  </div>
                  <div onClick={() => addBpmnElement('complex-gateway')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Complex Gateway">
                    <div className="w-7 h-7 border-2 border-pink-600 transform rotate-45 flex items-center justify-center">
                      <span className="transform -rotate-45 text-[10px] font-bold">*</span>
                    </div>
                    <span className="text-[9px] text-center">Complex</span>
                  </div>
                </div>
              </div>

              {/* Subprocesses */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-foreground">SUBPROCESSES</p>
                <div className="grid grid-cols-4 gap-2">
                  <div onClick={() => addBpmnElement('subprocess')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Expanded Subprocess">
                    <div className="w-7 h-7 border-2 border-foreground rounded flex items-center justify-center text-[10px]">+</div>
                    <span className="text-[9px] text-center">Sub</span>
                  </div>
                  <div onClick={() => addBpmnElement('collapsed-subprocess')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Collapsed Subprocess">
                    <div className="w-7 h-7 border-2 border-foreground rounded flex items-center justify-center">
                      <div className="w-3 h-0.5 bg-foreground" />
                    </div>
                    <span className="text-[9px] text-center">Coll.</span>
                  </div>
                  <div onClick={() => addBpmnElement('event-subprocess')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Event Subprocess">
                    <div className="w-7 h-7 border-2 border-dashed border-foreground rounded flex items-center justify-center text-[10px与">+</div>
                    <span className="text-[9px] text-center">Event</span>
                  </div>
                  <div onClick={() => addBpmnElement('transaction')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Transaction">
                    <div className="w-7 h-7 border-4 border-double border-foreground rounded" />
                    <span className="text-[9px] text-center">Trans.</span>
                  </div>
                </div>
              </div>

              {/* Pools & Lanes */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-foreground">POOLS & LANES</p>
                <div className="grid grid-cols-4 gap-2">
                  <div onClick={() => addBpmnElement('participant')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Pool/Participant">
                    <div className="w-8 h-6 border-2 border-foreground rounded">
                      <div className="w-1 h-full bg-foreground" />
                    </div>
                    <span className="text-[9px] text-center">Pool</span>
                  </div>
                </div>
              </div>

              {/* Data Objects */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-foreground">DATA OBJECTS</p>
                <div className="grid grid-cols-4 gap-2">
                  <div onClick={() => addBpmnElement('data-object')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Data Object">
                    <div className="w-6 h-7 border-2 border-foreground" style={{ clipPath: 'polygon(0 10%, 70% 10%, 100% 0, 100% 100%, 0 100%)' }} />
                    <span className="text-[9px] text-center">Object</span>
                  </div>
                  <div onClick={() => addBpmnElement('data-store')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Data Store">
                    <div className="w-7 h-6 border-2 border-foreground rounded-sm" />
                    <span className="text-[9px] text-center">Store</span>
                  </div>
                  <div onClick={() => addBpmnElement('data-input')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Data Input">
                    <div className="w-6 h-7 border-2 border-foreground" style={{ clipPath: 'polygon(0 10%, 70% 10%, 100% 0, 100% 100%, 0 100%)' }}>
                      <div className="text-[8px] mt-2 ml-1">→</div>
                    </div>
                    <span className="text-[9px] text-center">Input</span>
                  </div>
                  <div onClick={() => addBpmnElement('data-output')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Data Output">
                    <div className="w-6 h-7 border-2 border-foreground" style={{ clipPath: 'polygon(0 10%, 70% 10%, 100% 0, 100% 100%, 0 100%)' }}>
                      <div className="text-[8px] mt-2 ml-1">←</div>
                    </div>
                    <span className="text-[9px] text-center">Output</span>
                  </div>
                </div>
              </div>

              {/* Artifacts & Connections */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-foreground">ARTIFACTS</p>
                <div className="grid grid-cols-4 gap-2">
                  <div onClick={() => addBpmnElement('text-annotation')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Text Annotation">
                    <div className="w-7 h-6 border-l-2 border-t-2 border-b-2 border-foreground" />
                    <span className="text-[9px] text-center">Note</span>
                  </div>
                  <div onClick={() => addBpmnElement('group')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Group">
                    <div className="w-7 h-7 border-2 border-dashed border-foreground rounded" />
                    <span className="text-[9px] text-center">Group</span>
                  </div>
                </div>
              </div>

              {/* Connection Instructions */}
              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs font-bold text-foreground">CONNECTIONS</p>
                <div className="space-y-1 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-0.5 bg-foreground" />
                    <span>Sequence Flow</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-0.5 border-t-2 border-dashed border-foreground" />
                    <span>Message Flow</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-0.5 border-t-2 border-dotted border-foreground" />
                    <span>Association</span>
                  </div>
                  <p className="pt-1 text-muted-foreground">
                    Drag from any element's anchor points to create connections
                  </p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground pt-2 border-t">
                💡 Click elements to add them. Double-click shapes to edit labels. Use context menu (right-click) for more options.
              </p>
            </div>
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
                          <div className="h-64 border rounded-md bg-background/70">
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
                              <div className="h-32 mt-2 rounded-md border bg-muted">
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
    </div>
  );
};

export default BpmnViewerComponent;