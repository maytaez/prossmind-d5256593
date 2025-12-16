import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateHash, checkExactHashCache, storeExactHashCache, checkSemanticCache } from "../_shared/cache.ts";
import { generateEmbedding, isSemanticCacheEnabled, getSemanticSimilarityThreshold } from "../_shared/embeddings.ts";
import { logPerformanceMetric, measureExecutionTime } from "../_shared/metrics.ts";
import { getBpmnSystemPrompt, getPidSystemPrompt, buildMessagesWithExamples } from "../_shared/prompts.ts";
import { analyzePrompt, selectModel } from "../_shared/model-selection.ts";
import { detectLanguage, getLanguageName } from "../_shared/language-detection.ts";
import { optimizeBpmnDI, estimateTokenCount, needsDIOptimization } from "../_shared/bpmn-di-optimizer.ts";
import {
  analyzePromptComplexity,
  simplifyPrompt,
  splitPromptIntoSubPrompts,
  fallbackAnalysis,
  fallbackSplit,
} from "../_shared/prompt-analyzer.ts";
import { logGenerationRequest, logGenerationSuccess, logGenerationError } from "../_shared/dashboard-logger.ts";
// Multi-stage pipeline imports
import { normalizeInput } from "../_shared/input-normalizer.ts";
import { extractSemantics } from "../_shared/semantic-extractor.ts";
import { generateBpmnIR, deriveTemplateConstraints, generateBpmnIRWithFeedback } from "../_shared/bpmn-ir-generator.ts";
import { validateBpmnIR } from "../_shared/bpmn-ir-validator.ts";
import { generateBpmnXml } from "../_shared/bpmn-xml-generator.ts";
import { retrievePatterns } from "../_shared/pattern-retriever.ts";
import { getStyleProfile } from "../_shared/style-profile-manager.ts";
import { getSemanticCache, cacheSemanticResult, getBpmnIRCache, cacheBpmnIR } from "../_shared/multi-stage-cache.ts";
import { shouldUseMultiStage } from "../_shared/prompt-router.ts";
import type { SemanticCore } from "../_shared/types/semantic-core.ts";
import type { BpmnIR } from "../_shared/types/bpmn-ir.ts";
import type { EnterpriseStyleProfile } from "../_shared/types/bpmn-ir.ts";

interface ValidationResult {
  isValid: boolean;
  error?: string;
  errorDetails?: string;
}

interface SummarizationResult {
  summarizedPrompt: string;
  wasSummarized: boolean;
}

interface MultiStageOptions {
  diagramType: string;
  languageCode: string;
  languageName: string;
  apiKey: string;
  supabase: any;
  skipCache: boolean;
  returnIntermediate: boolean;
  enterpriseId?: string;
  projectId?: string;
}

interface MultiStageResult {
  bpmnXml: string;
  intermediate?: {
    semanticCore: SemanticCore;
    bpmnIR: BpmnIR;
    validation: any;
  };
}

/**
 * Generate BPMN using multi-stage pipeline
 */
async function generateBpmnMultiStage(prompt: string, options: MultiStageOptions): Promise<MultiStageResult> {
  const stageStartTime = Date.now();
  console.log("[Multi-Stage] Starting pipeline");

  // Stage 0: Input Normalization
  console.log("[Multi-Stage] Stage 0: Input Normalization");
  const normalized = await normalizeInput(prompt, {
    verbosity: "normal",
    return_intermediate: options.returnIntermediate,
    enterprise_id: options.enterpriseId,
    project_id: options.projectId,
  });
  console.log(`[Multi-Stage] Stage 0 completed in ${Date.now() - stageStartTime}ms`);

  // Stage 1: Semantic Extraction (with caching)
  console.log("[Multi-Stage] Stage 1: Semantic Extraction");
  const stage1Start = Date.now();
  let semanticCore: SemanticCore | null = null;
  if (!options.skipCache && options.supabase) {
    semanticCore = await getSemanticCache(normalized, options.supabase);
    if (semanticCore) {
      console.log("[Multi-Stage] Stage 1: Cache hit");
    }
  }
  if (!semanticCore) {
    semanticCore = await extractSemantics(normalized, options.apiKey);
    if (!options.skipCache && options.supabase && semanticCore) {
      // Cache asynchronously to not block
      cacheSemanticResult(normalized, semanticCore, options.supabase).catch((err) =>
        console.warn("[Multi-Stage] Failed to cache semantic result:", err),
      );
    }
  }
  if (!semanticCore) {
    throw new Error("Failed to extract semantic core");
  }
  console.log(`[Multi-Stage] Stage 1 completed in ${Date.now() - stage1Start}ms`);

  // Retrieve patterns and style profile (parallel)
  console.log("[Multi-Stage] Retrieving patterns and style profile");
  const stage2PrepStart = Date.now();
  const [patterns, styleProfile] = await Promise.all([
    retrievePatterns(semanticCore, 5, options.supabase),
    getStyleProfile(options.enterpriseId, options.projectId, options.supabase),
  ]);
  console.log(`[Multi-Stage] Patterns/style profile retrieved in ${Date.now() - stage2PrepStart}ms`);

  // Stage 2: BPMN IR Generation
  console.log("[Multi-Stage] Stage 2: BPMN IR Generation");
  const stage2Start = Date.now();
  const templateConstraints = deriveTemplateConstraints(semanticCore);
  let bpmnIR: BpmnIR | null = null;
  if (!options.skipCache && options.supabase) {
    bpmnIR = await getBpmnIRCache(semanticCore, templateConstraints, styleProfile, options.supabase);
    if (bpmnIR) {
      console.log("[Multi-Stage] Stage 2: Cache hit");
    }
  }
  if (!bpmnIR) {
    bpmnIR = await generateBpmnIR(semanticCore, templateConstraints, styleProfile, patterns, options.apiKey);
    if (!options.skipCache && options.supabase && bpmnIR) {
      // Cache asynchronously to not block
      cacheBpmnIR(semanticCore, templateConstraints, styleProfile, bpmnIR, options.supabase).catch((err) =>
        console.warn("[Multi-Stage] Failed to cache BPMN IR:", err),
      );
    }
  }
  if (!bpmnIR) {
    throw new Error("Failed to generate BPMN IR");
  }
  console.log(`[Multi-Stage] Stage 2 completed in ${Date.now() - stage2Start}ms`);

  // Stage 3: Validation + Auto-fix
  console.log("[Multi-Stage] Stage 3: Validation + Auto-fix");
  const stage3Start = Date.now();
  const validation = validateBpmnIR(bpmnIR);
  if (validation.validation_status === "auto_fixed" && validation.fixed_ir) {
    bpmnIR = validation.fixed_ir;
    console.log("[Multi-Stage] Stage 3: Auto-fixed issues");
  } else if (validation.validation_status === "requires_manual_fix") {
    console.log("[Multi-Stage] Stage 3: Retrying with validation feedback");
    // Retry Stage 2 with validation feedback
    const validationIssues = validation.issues_detected.map((i) => i.message);
    bpmnIR = await generateBpmnIRWithFeedback(
      semanticCore,
      templateConstraints,
      styleProfile,
      patterns,
      validationIssues,
      options.apiKey,
    );
  }
  console.log(`[Multi-Stage] Stage 3 completed in ${Date.now() - stage3Start}ms`);

  // Stage 4: BPMN XML Generation (deterministic)
  console.log("[Multi-Stage] Stage 4: BPMN XML Generation");
  const stage4Start = Date.now();
  if (!bpmnIR) {
    throw new Error("BPMN IR is null, cannot generate XML");
  }
  const bpmnXml = generateBpmnXml(bpmnIR, styleProfile);
  console.log(`[Multi-Stage] Stage 4 completed in ${Date.now() - stage4Start}ms`);
  console.log(`[Multi-Stage] Total pipeline time: ${Date.now() - stageStartTime}ms`);

  return {
    bpmnXml,
    intermediate: options.returnIntermediate
      ? {
          semanticCore,
          bpmnIR: bpmnIR, // bpmnIR is guaranteed non-null here
          validation,
        }
      : undefined,
  };
}

/**
 * Detect if prompt requires async generation (conservative thresholds)
 * Only use async for genuinely complex prompts that risk timeout
 */
function shouldUseAsyncGeneration(prompt: string, promptLength: number): boolean {
  // Count actual swimlane/actor mentions - look for patterns like "swimlanes for X, Y, Z"
  // or explicit actor/participant lists
  const swimlanePattern = /swimlane[s]?\s+(?:for|with|including)\s+([^.,]+(?:,\s*[^.,]+)*)/gi;
  const swimlaneMatches = [...prompt.matchAll(swimlanePattern)];
  let explicitSwimlanes = 0;

  // Count swimlanes from patterns like "swimlanes for A, B, C" -> 3 swimlanes
  for (const match of swimlaneMatches) {
    if (match[1]) {
      const swimlaneList = match[1]
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      explicitSwimlanes += swimlaneList.length;
    }
  }

  // Also count generic actor mentions
  const actors = (prompt.match(/actor|participant|swimlane|pool|lane|department|system|service/gi) || []).length;
  const complexity = (prompt.match(/subprocess|parallel|timer|boundary|escalate|event|gateway|decision/gi) || [])
    .length;

  // Use explicit swimlane count if available, otherwise fall back to generic actor count
  const totalActors = explicitSwimlanes > 0 ? explicitSwimlanes : actors;

  // Conservative thresholds - only async for truly complex prompts
  return (
    promptLength > 1500 || // Very long prompts
    totalActors >= 4 || // 4+ swimlanes/actors (improved detection)
    complexity >= 4 || // Multiple complex BPMN features
    (totalActors >= 3 && complexity >= 2) // Moderate actors + complexity
  );
}

function sanitizeBpmnXml(xml: string): string {
  let sanitized = xml;
  sanitized = sanitized.replace(/bpmns:/gi, "bpmn:");
  sanitized = sanitized.replace(/bpmndi\:BPMNShape/gi, "bpmndi:BPMNShape");
  sanitized = sanitized.replace(/bpmndi\:BPMNEdge/gi, "bpmndi:BPMNEdge");
  sanitized = sanitized.replace(/<\/\s*di:waypoint\s*>/gi, "");
  sanitized = sanitized.replace(
    /<(\s*)di:waypoint\s*([^>]*?)>/gi,
    (match: string, whitespace: string, attrs: string) => {
      if (match.includes("/>")) return match;
      const cleanAttrs = attrs.trim();
      return cleanAttrs ? `<${whitespace}di:waypoint ${cleanAttrs}/>` : `<${whitespace}di:waypoint/>`;
    },
  );
  sanitized = sanitized.replace(
    /<(\s*)di:waypoint\s*([^>]*?)\s*\n\s*>/gi,
    (_match: string, whitespace: string, attrs: string) => {
      return `<${whitespace}di:waypoint ${attrs.trim().replace(/\s+/g, " ")}/>`;
    },
  );
  sanitized = sanitized.replace(
    /<(\s*)di:waypoint([^>]*?)([^\/])>/gi,
    (_match: string, whitespace: string, attrs: string) => {
      const cleanAttrs = attrs.trim();
      return cleanAttrs ? `<${whitespace}di:waypoint ${cleanAttrs}/>` : `<${whitespace}di:waypoint/>`;
    },
  );
  sanitized = sanitized.replace(/<\s*bpmn:flowNodeRef[^>]*>[\s\S]*?<\/\s*bpmn:flowNodeRef\s*>/gi, "");
  sanitized = sanitized.replace(/<\s*bpmns:flowNodeRef[^>]*>[\s\S]*?<\/\s*bpmns:flowNodeRef\s*>/gi, "");
  sanitized = sanitized.replace(/<\/\s*bpmn:flowNodeRef\s*>/gi, "");
  sanitized = sanitized.replace(/<\/\s*bpmns:flowNodeRef\s*>/gi, "");
  sanitized = sanitized.replace(/<\s*bpmn:flowNodeRef[^>]*\/?\s*>/gi, "");
  sanitized = sanitized.replace(/<\s*bpmns:flowNodeRef[^>]*\/?\s*>/gi, "");
  sanitized = sanitized.replace(/<\s*\/\?xml/gi, "<?xml");
  sanitized = sanitized.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, "&amp;");
  sanitized = sanitized.replace(/<\/\s*[^>]*:flowNodeRef[^>]*>/gi, "");
  return sanitized.trim();
}

async function summarizeInputWithFlash(userPrompt: string, googleApiKey: string): Promise<SummarizationResult> {
  const shouldSummarize = userPrompt.length > 1500 || userPrompt.split("\n").length > 10;
  if (!shouldSummarize) return { summarizedPrompt: userPrompt, wasSummarized: false };
  console.log(`[Summarization] Summarizing prompt (length: ${userPrompt.length} chars)`);
  const summarizationPrompt = `You are a business process modeling assistant. Summarize and simplify the following prompt while preserving ALL critical information for BPMN 2.0 diagram generation.\n\nPreserve: workflow steps, decision points, participants/roles, sequence flows, exception handling, subprocesses, parallel activities, message flows, data objects.\n\nSimplify by: removing redundant explanations, consolidating similar concepts, using concise language.\n\nReturn ONLY the simplified prompt.\n\nOriginal prompt:\n${userPrompt}`;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: summarizationPrompt }] }],
          generationConfig: { maxOutputTokens: 2048, temperature: 0.3 },
        }),
      },
    );
    if (!response.ok) {
      console.warn("[Summarization] Failed");
      return { summarizedPrompt: userPrompt, wasSummarized: false };
    }
    const data = await response.json();
    const summarized = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || userPrompt;
    if (summarized && summarized.length < userPrompt.length * 0.8) {
      console.log(`[Summarization] Success: ${userPrompt.length} -> ${summarized.length} chars`);
      return { summarizedPrompt: summarized, wasSummarized: true };
    }
    return { summarizedPrompt: userPrompt, wasSummarized: false };
  } catch (error) {
    console.warn("[Summarization] Error:", error);
    return { summarizedPrompt: userPrompt, wasSummarized: false };
  }
}

// Repair truncated XML by removing incomplete elements
function repairTruncatedXml(xml: string): string {
  let repaired = xml;

  // Find and remove incomplete condition expressions
  const incompleteConditionRegex = /<bpmn:conditionExpression[^>]*>(\$\{[^}]*?)<\/bpmn:conditionExpression>/g;
  let matches: Array<{ match: string; index: number; expr: string }> = [];
  let match;

  while ((match = incompleteConditionRegex.exec(repaired)) !== null) {
    const expr = match[1];
    if (!expr.endsWith("}")) {
      matches.push({ match: match[0], index: match.index, expr });
    }
  }

  // Remove matches in reverse order to preserve indices
  for (let i = matches.length - 1; i >= 0; i--) {
    const { match: matchStr, index, expr } = matches[i];
    console.warn(`[XML Repair] Removing incomplete condition expression: ${expr}`);
    const beforeMatch = repaired.substring(0, index);
    const afterMatch = repaired.substring(index + matchStr.length);
    const sequenceFlowStart = beforeMatch.lastIndexOf("<bpmn:sequenceFlow");

    if (sequenceFlowStart !== -1) {
      const sequenceFlowEnd = afterMatch.indexOf("</bpmn:sequenceFlow>");
      if (sequenceFlowEnd !== -1) {
        repaired =
          beforeMatch.substring(0, sequenceFlowStart) +
          afterMatch.substring(sequenceFlowEnd + "</bpmn:sequenceFlow>".length);
      } else {
        repaired = beforeMatch + afterMatch;
      }
    } else {
      repaired = beforeMatch + afterMatch;
    }
  }

  repaired = repaired.replace(/<bpmn:sequenceFlow[^>]*>\s*<bpmn:conditionExpression[^>]*>(\$\{[^<}]*?)$/gm, () => {
    console.warn(`[XML Repair] Removing sequence flow with cut-off condition expression`);
    return "";
  });

  repaired = repaired.replace(/(\$\{[^}]*?)$/m, "");

  if (!repaired.trim().endsWith("</bpmn:definitions>")) {
    const lastDefinitionsIndex = repaired.lastIndexOf("</bpmn:definitions>");
    if (lastDefinitionsIndex > 0) {
      repaired = repaired.substring(0, lastDefinitionsIndex) + "</bpmn:definitions>";
    } else if (repaired.includes("<bpmn:definitions")) {
      const lastProcessIndex = repaired.lastIndexOf("</bpmn:process>");
      if (lastProcessIndex > 0) {
        repaired = repaired.substring(0, lastProcessIndex + "</bpmn:process>".length) + "\n</bpmn:definitions>";
      }
    }
  }

  return repaired;
}

function validateBpmnXml(xml: string): ValidationResult {
  if (!xml || typeof xml !== "string") return { isValid: false, error: "Invalid XML: empty or non-string input" };
  if (!xml.trim().startsWith("<?xml")) return { isValid: false, error: "Missing XML declaration" };
  if (!xml.includes("<bpmn:definitions") && !xml.includes("<bpmn:Definitions") && !xml.includes("<definitions"))
    return { isValid: false, error: "Missing BPMN definitions element" };
  if (!xml.includes("<bpmn:process") && !xml.includes("<process"))
    return { isValid: false, error: "Missing BPMN process element" };
  if (!xml.includes("<bpmndi:BPMNDiagram") && !xml.includes("<bpmndi:BPMNPlane"))
    return { isValid: false, error: "Missing BPMN diagram interchange" };

  // Check for truncated/incomplete condition expressions
  const incompleteConditionPattern = /<bpmn:conditionExpression[^>]*>(\$\{[^}]*?)<\/bpmn:conditionExpression>/g;
  let incompleteConditions: string[] = [];
  let conditionMatch;
  while ((conditionMatch = incompleteConditionPattern.exec(xml)) !== null) {
    const expr = conditionMatch[1];
    if (!expr.endsWith("}")) {
      incompleteConditions.push(conditionMatch[0]);
    }
  }
  if (incompleteConditions.length > 0) {
    return {
      isValid: false,
      error: "Truncated XML: incomplete condition expressions detected",
      errorDetails: `Found ${incompleteConditions.length} incomplete condition expression(s). The XML appears to have been truncated during generation.`,
    };
  }

  const cutOffConditionPattern = /<bpmn:conditionExpression[^>]*>(\$\{[^<}]*?)$/m;
  const cutOffMatch = xml.match(cutOffConditionPattern);
  if (cutOffMatch) {
    return {
      isValid: false,
      error: "Truncated XML: condition expressions cut off",
      errorDetails: `Found condition expression that was cut off: ${cutOffMatch[1]}. The XML appears to have been truncated during generation.`,
    };
  }

  // Check for incomplete ${ expressions anywhere (standalone, not in tags) - this catches cases like "${loanAmount" at end
  const standaloneIncompletePattern = /(\$\{[^}]*?)$/m;
  const standaloneMatch = xml.match(standaloneIncompletePattern);
  if (standaloneMatch) {
    // Check if this is at the very end of the file (no closing tags after it)
    const matchIndex = xml.lastIndexOf(standaloneMatch[0]);
    const afterMatch = xml.substring(matchIndex + standaloneMatch[0].length).trim();
    // If there's no proper closing tag after the incomplete expression, it's truncated
    if (
      !afterMatch ||
      (!afterMatch.includes("</bpmn:definitions>") && !afterMatch.includes("</bpmn:conditionExpression>"))
    ) {
      return {
        isValid: false,
        error: "Truncated XML: incomplete expression at end of file",
        errorDetails: `Found incomplete expression at end: ${standaloneMatch[1]}. The XML appears to have been truncated during generation.`,
      };
    }
  }

  // Check if XML ends properly - must end with </bpmn:definitions>
  if (!xml.trim().endsWith("</bpmn:definitions>")) {
    // Check if there's an incomplete tag or expression at the end
    const last100Chars = xml.substring(Math.max(0, xml.length - 100));
    if (last100Chars.includes("${") && !last100Chars.includes("}")) {
      return {
        isValid: false,
        error: "Truncated XML: file ends with incomplete expression",
        errorDetails: `XML does not end properly and contains incomplete expression. The XML appears to have been truncated during generation.`,
      };
    }
  }

  const unclosedWaypoints = xml.match(/<di:waypoint[^>]*[^\/]>/gi);
  if (unclosedWaypoints && unclosedWaypoints.length > 0)
    return {
      isValid: false,
      error: "Unclosed di:waypoint tags",
      errorDetails: `Found ${unclosedWaypoints.length} unclosed tags`,
    };
  if (xml.includes("bpmns:") && !xml.includes("xmlns:bpmns="))
    return { isValid: false, error: "Invalid namespace prefix bpmns:" };
  return { isValid: true };
}

async function generateBpmnXmlWithGemini(
  simplifiedPrompt: string,
  systemPrompt: string,
  diagramType: "bpmn" | "pid",
  languageCode: string,
  languageName: string,
  googleApiKey: string,
  maxTokens: number,
  temperature: number,
  retryContext?: { error: string; errorDetails?: string; attemptNumber: number },
): Promise<string> {
  let generationPrompt = simplifiedPrompt;
  if (retryContext) {
    generationPrompt = `${simplifiedPrompt}\n\n⚠️ CRITICAL: Previous BPMN XML failed validation: ${retryContext.error}${retryContext.errorDetails ? `\nDetails: ${retryContext.errorDetails}` : ""}\n\nFix: ensure all tags closed, di:waypoint self-closing, no invalid elements, proper namespaces.`;
  }
  const messages = buildMessagesWithExamples(systemPrompt, generationPrompt, diagramType, languageCode, languageName);
  const systemMessage = messages.find((m: any) => m.role === "system");
  const userMessages = messages.filter((m: any) => m.role === "user");
  console.log("[GEMINI REQUEST] Sending to Gemini 2.5 Pro");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${googleApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: userMessages.map((m: any) => ({ role: "user", parts: [{ text: m.content }] })),
        systemInstruction: systemMessage ? { parts: [{ text: systemMessage.content }] } : undefined,
        generationConfig: { maxOutputTokens: maxTokens, temperature: temperature },
      }),
    },
  );
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${errorText}`);
  }
  const data = await response.json();
  let bpmnXml = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!bpmnXml) throw new Error("No content generated from Gemini 2.5 Pro");
  bpmnXml = bpmnXml
    .replace(/```xml\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  bpmnXml = sanitizeBpmnXml(bpmnXml);

  // Optimize BPMN DI to prevent truncation
  const beforeOptimization = bpmnXml.length;
  const estimatedTokens = estimateTokenCount(bpmnXml);

  // Use aggressive optimization if we're close to or over the token limit
  const aggressive = estimatedTokens > maxTokens * 0.8;
  if (needsDIOptimization(bpmnXml, maxTokens) || aggressive) {
    console.log(
      `[BPMN DI Optimization] Before: ${beforeOptimization} chars (~${estimatedTokens} tokens), aggressive: ${aggressive}`,
    );
    bpmnXml = optimizeBpmnDI(bpmnXml, aggressive);
    const afterOptimization = bpmnXml.length;
    const reduction = (((beforeOptimization - afterOptimization) / beforeOptimization) * 100).toFixed(1);
    console.log(
      `[BPMN DI Optimization] After: ${afterOptimization} chars (~${estimateTokenCount(bpmnXml)} tokens), reduced: ${reduction}%`,
    );
  }

  console.log("[GEMINI RESPONSE] Final length:", bpmnXml.length);
  return bpmnXml;
}

async function retryBpmnGenerationIfNecessary(
  simplifiedPrompt: string,
  systemPrompt: string,
  diagramType: "bpmn" | "pid",
  languageCode: string,
  languageName: string,
  googleApiKey: string,
  maxTokens: number,
  temperature: number,
  maxAttempts: number = 3,
): Promise<string> {
  let lastValidationError: ValidationResult | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[BPMN Generation] Attempt ${attempt}/${maxAttempts}`);
    try {
      const bpmnXml = await generateBpmnXmlWithGemini(
        simplifiedPrompt,
        systemPrompt,
        diagramType,
        languageCode,
        languageName,
        googleApiKey,
        maxTokens,
        temperature,
        lastValidationError
          ? {
              error: lastValidationError.error || "Validation failed",
              errorDetails: lastValidationError.errorDetails,
              attemptNumber: attempt,
            }
          : undefined,
      );

      let xmlToValidate = bpmnXml;

      // Check for truncation and try to repair
      const validation = validateBpmnXml(xmlToValidate);
      if (!validation.isValid && validation.error?.includes("Truncated XML")) {
        console.warn(`[BPMN Generation] Truncated XML detected, attempting repair...`);
        xmlToValidate = repairTruncatedXml(xmlToValidate);
        const repairedValidation = validateBpmnXml(xmlToValidate);
        if (repairedValidation.isValid) {
          console.log(`[BPMN Generation] Truncated XML repaired successfully on attempt ${attempt}`);
          return xmlToValidate;
        } else {
          console.warn(`[BPMN Generation] Repair failed: ${repairedValidation.error}`);
          lastValidationError = repairedValidation;
        }
      } else if (validation.isValid) {
        console.log(`[BPMN Generation] Valid XML on attempt ${attempt}`);
        return xmlToValidate;
      } else {
        lastValidationError = validation;
      }

      console.warn(`[BPMN Generation] Validation failed attempt ${attempt}:`, lastValidationError.error);
      if (attempt < maxAttempts) await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`[BPMN Generation] Error attempt ${attempt}:`, error);
      if (attempt === maxAttempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error(
    `Failed to generate valid BPMN XML after ${maxAttempts} attempts. Last error: ${lastValidationError?.error || "Unknown"}`,
  );
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const startTime = Date.now();
  let cacheType: "exact_hash" | "semantic" | "none" = "none";
  let similarityScore: number | undefined;
  let modelUsed: string | undefined;
  let prompt: string | undefined;
  let promptLength = 0;
  let logId: string | null = null;
  let supabase: any = null;
  let userId: string | undefined;

  // Set up timeout detection - Deno edge functions have a 60s hard limit
  const EDGE_FUNCTION_TIMEOUT_MS = 58000; // 58s to leave buffer
  const timeoutId = setTimeout(async () => {
    // If we're still running after 58s, log timeout error
    if (supabase && logId) {
      try {
        await logGenerationError({
          supabase,
          logId,
          errorMessage: "Request timed out after 58 seconds (edge function limit)",
          errorStack: "Edge function timeout - generation exceeded time limit",
          durationMs: Date.now() - startTime,
        });
      } catch (err) {
        console.error("[Timeout Handler] Failed to log timeout error:", err);
      }
    }
  }, EDGE_FUNCTION_TIMEOUT_MS);

  try {
    let requestData;
    try {
      requestData = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    prompt = requestData.prompt;
    const diagramType = requestData.diagramType || "bpmn";
    const skipCache = requestData.skipCache === true;
    const modelingAgentMode = requestData.modelingAgentMode === true;
    if (!prompt) throw new Error("Prompt is required");
    promptLength = prompt.length;
    console.log("Generating BPMN for prompt:", prompt);
    const detectedLanguageCode = modelingAgentMode ? "en" : detectLanguage(prompt);
    const detectedLanguageName = modelingAgentMode ? "English" : getLanguageName(detectedLanguageCode);
    console.log(`Language: ${detectedLanguageName} (${detectedLanguageCode})`);

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    if (!GOOGLE_API_KEY) throw new Error("Google API key not configured");

    // Create Supabase client for logging
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && supabaseServiceKey) {
      supabase = createClient(supabaseUrl, supabaseServiceKey);
    }

    // Get user ID for logging
    if (supabase) {
      const authHeader = req.headers.get("Authorization");
      const token = authHeader?.replace("Bearer ", "");
      if (token) {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser(token);
          userId = user?.id;
        } catch (error) {
          console.warn("[Logging] Failed to get user:", error);
        }
      }
    }

    // Log generation request
    if (supabase && userId) {
      logId = await logGenerationRequest({
        supabase,
        userId,
        prompt,
        diagramType,
        detectedLanguage: detectedLanguageCode,
        sourceFunction: "generate-bpmn",
        isMultiDiagram: false,
      });
    }

    // CHECK CACHE FIRST - Skip expensive complexity analysis if we have a cached result
    let promptHash: string;
    try {
      promptHash = await generateHash(`${prompt}:${diagramType}:${detectedLanguageCode}`);
    } catch {
      throw new Error("Failed to generate prompt hash");
    }
    if (!skipCache && !modelingAgentMode) {
      let exactCache;
      try {
        exactCache = await checkExactHashCache(promptHash, diagramType);
      } catch {
        exactCache = null;
      }
      if (exactCache) {
        cacheType = "exact_hash";
        await logPerformanceMetric({
          function_name: "generate-bpmn",
          cache_type: "exact_hash",
          prompt_length: prompt.length,
          response_time_ms: Date.now() - startTime,
          cache_hit: true,
          error_occurred: false,
        });
        // Log cache hit
        if (supabase && logId) {
          await logGenerationSuccess({
            supabase,
            logId,
            resultXml: exactCache.bpmnXml,
            durationMs: Date.now() - startTime,
            cacheHit: true,
          });
        }
        return new Response(JSON.stringify({ bpmnXml: exactCache.bpmnXml, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // TIME BUDGET MANAGEMENT - Track elapsed time to prevent timeout
    const TIMEOUT_LIMIT_MS = 50000; // 50 seconds, leaving 10s buffer before edge function timeout
    const getElapsedTime = () => Date.now() - startTime;
    const hasTimeBudget = (requiredMs: number = 0) => getElapsedTime() + requiredMs < TIMEOUT_LIMIT_MS;

    console.log(`[Time Budget] Starting with ${TIMEOUT_LIMIT_MS}ms limit`);

    // MULTI-STAGE PIPELINE ROUTING (Check BEFORE async generation)
    // For complex prompts, use multi-stage pipeline which is faster and more reliable
    const useMultiStage = shouldUseMultiStage(prompt, {
      promptLength,
      forceMultiStage: requestData.forceMultiStage,
      forceDirect: requestData.forceDirect,
    });

    if (useMultiStage && diagramType === "bpmn" && !modelingAgentMode) {
      console.log("[Multi-Stage] Using multi-stage pipeline for complex prompt");
      try {
        // Check time budget before starting multi-stage (need at least 35s)
        if (!hasTimeBudget(35000)) {
          console.warn("[Multi-Stage] Insufficient time budget, using async generation instead");
          // Fall through to async generation
        } else {
          // Set a timeout for multi-stage generation (30s max)
          const multiStageTimeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("Multi-stage pipeline timeout")), 30000);
          });

          const multiStagePromise = generateBpmnMultiStage(prompt, {
            diagramType,
            languageCode: detectedLanguageCode,
            languageName: detectedLanguageName,
            apiKey: GOOGLE_API_KEY,
            supabase,
            skipCache,
            returnIntermediate: requestData.return_intermediate || false,
            enterpriseId: requestData.enterprise_id,
            projectId: requestData.project_id,
          });

          const result = await Promise.race([multiStagePromise, multiStageTimeoutPromise]);

          if (result.bpmnXml) {
            modelUsed = "multi-stage-pipeline";
            const finalValidation = validateBpmnXml(result.bpmnXml);
            if (!finalValidation.isValid) {
              throw new Error(`Multi-stage validation failed: ${finalValidation.error}`);
            }

            // Cache the result
            if (!skipCache) {
              (async () => {
                try {
                  await storeExactHashCache(promptHash, prompt, diagramType, result.bpmnXml, undefined);
                } catch {
                  /* ignore */
                }
              })();
            }

            await logPerformanceMetric({
              function_name: "generate-bpmn",
              cache_type: cacheType,
              model_used: modelUsed,
              prompt_length: promptLength,
              response_time_ms: Date.now() - startTime,
              cache_hit: false,
              error_occurred: false,
            });

            if (supabase && logId) {
              await logGenerationSuccess({
                supabase,
                logId,
                resultXml: result.bpmnXml,
                durationMs: Date.now() - startTime,
                cacheHit: false,
              });
            }

            clearTimeout(timeoutId);

            return new Response(
              JSON.stringify({
                bpmnXml: result.bpmnXml,
                cached: false,
                multiStage: true,
                intermediate: result.intermediate,
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
        }
      } catch (multiStageError) {
        console.error("[Multi-Stage] Pipeline failed, falling back to async/direct generation:", multiStageError);
        // Fall through to async generation or direct generation
      }
    }

    // INTELLIGENT PROMPT ANALYSIS - Only for extremely long prompts (trust Gemini 2.5 Pro for normal complexity)
    let finalPromptToGenerate = prompt;
    let wasSimplified = false;
    let wasSplit = false;
    let subPrompts: string[] = [];

    // ASYNC GENERATION FOR COMPLEX PROMPTS - Bypass 60s timeout using background jobs
    if (!modelingAgentMode && shouldUseAsyncGeneration(prompt, promptLength)) {
      console.log(`[Async Mode] Complex prompt detected (length: ${promptLength}), creating background job`);

      try {
        // Create Supabase client
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!supabaseUrl || !supabaseServiceKey) {
          console.warn("[Async Mode] Supabase config missing, falling back to sync");
        } else {
          const supabase = createClient(supabaseUrl, supabaseServiceKey);

          // Get user ID from JWT
          const authHeader = req.headers.get("Authorization");
          const token = authHeader?.replace("Bearer ", "");
          let userId: string | undefined;

          if (token) {
            const {
              data: { user },
            } = await supabase.auth.getUser(token);
            userId = user?.id;
          }

          // Create job in vision_bpmn_jobs table
          const { data: job, error: jobError } = await supabase
            .from("vision_bpmn_jobs")
            .insert({
              user_id: userId || null,
              source_type: "prompt",
              prompt: prompt,
              diagram_type: diagramType,
              image_data: null,
              status: "pending",
            })
            .select()
            .single();

          if (jobError || !job) {
            console.error("[Async Mode] Failed to create job:", jobError);
            console.warn("[Async Mode] Falling back to sync generation");
          } else {
            console.log(`[Async Mode] Job created: ${job.id}`);

            // Trigger async processing (fire and forget)
            fetch(`${supabaseUrl}/functions/v1/process-bpmn-job`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
              },
              body: JSON.stringify({ jobId: job.id }),
            }).catch((err) => console.error("[Async Mode] Failed to trigger processor:", err));

            // Return immediately with job ID for client polling
            return new Response(
              JSON.stringify({
                requiresPolling: true,
                jobId: job.id,
                message: "Complex prompt - generation started in background",
                estimatedTime: "60-90 seconds",
              }),
              {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }
        }
      } catch (asyncError) {
        console.error("[Async Mode] Error setting up async:", asyncError);
        console.warn("[Async Mode] Falling back to sync generation");
        // Continue with normal synchronous generation below
      }
    }

    // DISABLED FOR NORMAL USE - Only analyze extremely long prompts (>5000 chars)
    // Trust Gemini 2.5 Pro + DI optimization to handle complex prompts (proven by Modelling Agent Mode)
    if (!modelingAgentMode && promptLength > 5000) {
      console.log(
        `[Prompt Analysis] Starting analysis for ${promptLength} char prompt (elapsed: ${getElapsedTime()}ms)...`,
      );

      // Check time budget before expensive AI analysis
      if (!hasTimeBudget(20000)) {
        console.warn(
          `[Time Budget] Insufficient time for full analysis (${getElapsedTime()}ms elapsed), using fallback`,
        );
        const fallbackResult = fallbackAnalysis(prompt);
        if (fallbackResult.recommendation === "split") {
          subPrompts = fallbackSplit(prompt);
          return new Response(
            JSON.stringify({
              requiresSplit: true,
              subPrompts,
              analysis: {
                complexity: fallbackResult.complexity,
                reasoning: fallbackResult.reasoning + " (time budget exceeded)",
              },
              message: `This workflow is too complex for a single diagram. It has been split into ${subPrompts.length} sub-prompts.`,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }

      const analysisStartTime = Date.now();

      try {
        const analysis = await analyzePromptComplexity(
          prompt,
          GOOGLE_API_KEY,
          detectedLanguageCode,
          detectedLanguageName,
        );
        const analysisTime = Date.now() - analysisStartTime;
        console.log(
          `[Prompt Analysis] Completed in ${analysisTime}ms - Recommendation: ${analysis.recommendation} (elapsed: ${getElapsedTime()}ms)`,
        );

        if (analysis.recommendation === "split") {
          // Very complex - split into multiple sub-prompts
          console.log(
            `[Prompt Analysis] Splitting prompt (complexity: ${analysis.complexity.score}, actors: ${analysis.complexity.actors})`,
          );
          const splitStartTime = Date.now();

          // If analysis already provided sub-prompts, use them
          if (analysis.subPrompts && analysis.subPrompts.length > 0) {
            subPrompts = analysis.subPrompts;
          } else {
            subPrompts = await splitPromptIntoSubPrompts(
              prompt,
              GOOGLE_API_KEY,
              detectedLanguageCode,
              detectedLanguageName,
            );
          }

          const splitTime = Date.now() - splitStartTime;
          console.log(`[Prompt Analysis] Split into ${subPrompts.length} sub-prompts in ${splitTime}ms`);
          wasSplit = true;

          // Return sub-prompts to client for multi-diagram generation
          return new Response(
            JSON.stringify({
              requiresSplit: true,
              subPrompts,
              analysis: {
                complexity: analysis.complexity,
                reasoning: analysis.reasoning,
              },
              message: `This workflow is too complex for a single diagram. It has been split into ${subPrompts.length} sub-prompts for better results.`,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        } else if (analysis.recommendation === "simplify") {
          // Moderately complex - simplify
          console.log(
            `[Prompt Analysis] Simplifying prompt (complexity: ${analysis.complexity.score}, actors: ${analysis.complexity.actors})`,
          );
          const simplifyStartTime = Date.now();

          if (analysis.simplifiedPrompt) {
            finalPromptToGenerate = analysis.simplifiedPrompt;
          } else {
            finalPromptToGenerate = await simplifyPrompt(
              prompt,
              GOOGLE_API_KEY,
              detectedLanguageCode,
              detectedLanguageName,
            );
          }

          const simplifyTime = Date.now() - simplifyStartTime;
          wasSimplified = true;
          promptLength = finalPromptToGenerate.length;
          console.log(
            `[Prompt Analysis] Simplified in ${simplifyTime}ms: ${prompt.length} → ${finalPromptToGenerate.length} chars`,
          );
        } else {
          console.log(
            `[Prompt Analysis] Complexity acceptable (score: ${analysis.complexity.score}), generating directly`,
          );
        }
      } catch (error) {
        console.error("[Prompt Analysis] AI analysis failed, using fallback heuristics:", error);
        // CRITICAL SAFETY CHECK: Use fallback heuristics to avoid timeout on complex prompts
        const fallbackResult = fallbackAnalysis(prompt);

        console.log(
          `[Prompt Analysis] Fallback result: ${fallbackResult.recommendation} (score: ${fallbackResult.complexity.score})`,
        );

        if (fallbackResult.recommendation === "split") {
          console.log("[Prompt Analysis] Fallback detected complex prompt, splitting...");
          subPrompts = fallbackSplit(prompt);

          return new Response(
            JSON.stringify({
              requiresSplit: true,
              subPrompts,
              analysis: {
                complexity: fallbackResult.complexity,
                reasoning: fallbackResult.reasoning + " (fallback heuristics used due to AI timeout)",
              },
              message: `This workflow is too complex for a single diagram. It has been split into ${subPrompts.length} sub-prompts for better results.`,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        } else if (fallbackResult.recommendation === "simplify") {
          console.log("[Prompt Analysis] Fallback recommends simplification");
          // Use a simple reduction strategy - keep only substantial sentences
          finalPromptToGenerate = prompt
            .split(". ")
            .filter((s) => s.length > 20)
            .join(". ");
          wasSimplified = true;
          promptLength = finalPromptToGenerate.length;
        }
        // Otherwise continue with original prompt
      }
    } else if (modelingAgentMode) {
      console.log("[Prompt Analysis] Skipping analysis (modeling agent mode)");
    } else {
      console.log(`[Prompt Analysis] Skipping analysis (prompt length: ${promptLength} chars, threshold: 5000)`);
    }

    // Final time budget check before generation
    if (!hasTimeBudget(25000)) {
      console.warn(`[Time Budget] Insufficient time for generation (${getElapsedTime()}ms elapsed), forcing split`);
      const quickSplit = fallbackSplit(finalPromptToGenerate || prompt);

      // Log that we're forcing split due to time budget
      if (supabase && logId) {
        await logGenerationError({
          supabase,
          logId,
          errorMessage: "Insufficient time budget - prompt split automatically to prevent timeout",
          errorStack: `Time budget exceeded: ${getElapsedTime()}ms elapsed, required: 25000ms`,
          durationMs: getElapsedTime(),
        });
      }

      return new Response(
        JSON.stringify({
          requiresSplit: true,
          subPrompts: quickSplit,
          analysis: { reasoning: "Time budget exceeded before generation - prompt split automatically" },
          message: `Insufficient time to generate this diagram. It has been split into ${quickSplit.length} sub-prompts.`,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Cache already checked above, proceed with model selection
    const criteria = analyzePrompt(finalPromptToGenerate, diagramType);
    const modelSelection = selectModel(criteria);
    let { model, temperature, maxTokens } = modelSelection;
    const { complexityScore } = modelSelection;

    // For very complex prompts, generate without DI to prevent truncation
    // The client will add layout using auto-layout algorithms
    const useNoDI = promptLength > 3000 || complexityScore >= 9;
    const useCompactDI = !useNoDI && (promptLength > 2000 || complexityScore >= 7);

    const systemPrompt =
      diagramType === "pid"
        ? getPidSystemPrompt(detectedLanguageCode, detectedLanguageName)
        : getBpmnSystemPrompt(detectedLanguageCode, detectedLanguageName, false, true);

    console.log(
      `[Model Selection] ${model} with ${maxTokens} tokens (complexity: ${complexityScore}, compactDI: ${useCompactDI}, noDI: ${useNoDI})`,
    );
    if (modelingAgentMode)
      temperature =
        model === "google/gemini-2.5-pro" ? Math.min(temperature + 0.1, 0.4) : Math.min(temperature + 0.2, 0.7);
    modelUsed = model;
    // SEMANTIC CACHE DISABLED: Saves 3-5 seconds by skipping expensive embedding generation
    // Embedding generation via OpenAI API takes 2-4s for complex prompts, causing timeouts
    // Modelling Agent Mode bypasses this entirely - adopting same approach for all users
    // Exact hash cache (above) still provides instant responses for perfect matches
    if (false && !skipCache && !modelingAgentMode && isSemanticCacheEnabled()) {
      try {
        const embedding = await generateEmbedding(finalPromptToGenerate);
        const semanticCache = await checkSemanticCache(embedding, diagramType, getSemanticSimilarityThreshold());
        if (semanticCache) {
          cacheType = "semantic";
          const similarity = semanticCache!.similarity;
          const cachedXml = semanticCache!.bpmnXml;
          similarityScore = similarity;
          await logPerformanceMetric({
            function_name: "generate-bpmn",
            cache_type: "semantic",
            prompt_length: promptLength,
            complexity_score: complexityScore,
            response_time_ms: Date.now() - startTime,
            cache_hit: true,
            similarity_score: similarity,
            error_occurred: false,
          });
          // Log semantic cache hit
          if (supabase && logId) {
            await logGenerationSuccess({
              supabase,
              logId: logId!,
              resultXml: cachedXml,
              durationMs: Date.now() - startTime,
              cacheHit: true,
              cacheSimilarity: similarity,
            });
          }
          return new Response(
            JSON.stringify({
              bpmnXml: cachedXml,
              cached: true,
              similarity: similarity,
              wasSimplified,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      } catch {
        /* continue */
      }
    }

    // Final safety check - ensure we have enough time before starting generation
    const elapsedBeforeGeneration = getElapsedTime();
    if (elapsedBeforeGeneration > TIMEOUT_LIMIT_MS - 30000) {
      // Less than 30s remaining - too risky, log error and return
      const errorMsg = `Insufficient time remaining for generation (${elapsedBeforeGeneration}ms elapsed, ${TIMEOUT_LIMIT_MS - elapsedBeforeGeneration}ms remaining)`;
      console.error(`[Time Budget] ${errorMsg}`);

      if (supabase && logId) {
        await logGenerationError({
          supabase,
          logId,
          errorMessage: errorMsg,
          errorStack: "Generation aborted due to insufficient time budget",
          durationMs: elapsedBeforeGeneration,
        });
      }

      throw new Error(errorMsg);
    }

    // Use the analyzed/simplified prompt for generation
    let bpmnXml = await retryBpmnGenerationIfNecessary(
      finalPromptToGenerate,
      systemPrompt,
      diagramType,
      detectedLanguageCode,
      detectedLanguageName,
      GOOGLE_API_KEY,
      maxTokens,
      temperature,
      3,
    );
    modelUsed = "google/gemini-2.5-pro";
    let finalValidation = validateBpmnXml(bpmnXml);
    if (!finalValidation.isValid) {
      console.warn(`[BPMN Generation] Final validation failed, attempting repair: ${finalValidation.error}`);
      // Try to repair before throwing
      const repairedXml = repairTruncatedXml(bpmnXml);
      finalValidation = validateBpmnXml(repairedXml);
      if (finalValidation.isValid) {
        console.log(`[BPMN Generation] XML repaired successfully after final validation`);
        bpmnXml = repairedXml;
      } else {
        // Still invalid after repair - this is a real error
        const errorMsg = `Final validation failed: ${finalValidation.error}${finalValidation.errorDetails ? ` - ${finalValidation.errorDetails}` : ""}`;
        if (supabase && logId) {
          await logGenerationError({
            supabase,
            logId,
            errorMessage: errorMsg,
            errorStack: `Validation failed: ${finalValidation.error}`,
            durationMs: Date.now() - startTime,
          });
        }
        throw new Error(errorMsg);
      }
    }
    if (!skipCache && !modelingAgentMode) {
      (async () => {
        try {
          // EMBEDDING GENERATION DISABLED: Skip expensive OpenAI API call (saves 1-2 seconds)
          // Store only exact hash cache without semantic embedding
          // Matches Modelling Agent Mode's efficient approach
          await storeExactHashCache(promptHash, finalPromptToGenerate, diagramType, bpmnXml, undefined);
        } catch {
          /* ignore */
        }
      })();
    }
    await logPerformanceMetric({
      function_name: "generate-bpmn",
      cache_type: cacheType,
      model_used: modelUsed,
      prompt_length: promptLength,
      complexity_score: complexityScore,
      response_time_ms: Date.now() - startTime,
      cache_hit: cacheType !== "none",
      similarity_score: similarityScore,
      error_occurred: false,
    });
    // Log successful generation
    if (supabase && logId) {
      await logGenerationSuccess({
        supabase,
        logId,
        resultXml: bpmnXml,
        durationMs: Date.now() - startTime,
        cacheHit: false,
      });
    }
    // Clear timeout on successful completion
    clearTimeout(timeoutId);

    return new Response(
      JSON.stringify({
        bpmnXml,
        cached: false,
        wasSimplified,
        originalPromptLength: wasSimplified ? prompt.length : undefined,
        simplifiedPromptLength: wasSimplified ? finalPromptToGenerate.length : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    // Clear timeout on error
    clearTimeout(timeoutId);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in generate-bpmn:", errorMessage);
    try {
      await logPerformanceMetric({
        function_name: "generate-bpmn",
        cache_type: cacheType,
        model_used: modelUsed,
        prompt_length: promptLength,
        response_time_ms: Date.now() - startTime,
        cache_hit: false,
        error_occurred: true,
        error_message: errorMessage,
      });
    } catch {
      /* ignore */
    }
    // Log error
    if (supabase && logId) {
      await logGenerationError({
        supabase,
        logId,
        errorMessage,
        errorStack: error instanceof Error ? error.stack : undefined,
        durationMs: Date.now() - startTime,
      });
    }
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    // Ensure timeout is cleared in all cases
    clearTimeout(timeoutId);
  }
});
