/**
 * Stage 0: Input Normalization
 * Standardizes and prepares user input for processing
 */

import { detectLanguage, getLanguageName } from "./language-detection.ts";
import type { NormalizedInput, NormalizationOptions } from "./types/semantic-core.ts";

/**
 * Normalize user input by cleaning, extracting metadata, and detecting language
 */
export async function normalizeInput(
  rawInput: string,
  options: NormalizationOptions = {}
): Promise<NormalizedInput> {
  // Clean whitespace and normalize line breaks
  let content = rawInput.trim();
  content = content.replace(/\r\n/g, "\n");
  content = content.replace(/\r/g, "\n");
  content = content.replace(/\n{3,}/g, "\n\n"); // Max 2 consecutive newlines

  // Detect and handle markdown/code blocks
  // Remove markdown code fences but keep content
  content = content.replace(/```[\w]*\n?/g, "");
  content = content.replace(/```/g, "");

  // Try to extract metadata if provided in structured format
  const metadata: NormalizedInput["metadata"] = {};
  
  // Check for JSON-like structure at the start
  const jsonMatch = content.match(/^\s*\{[\s\S]*?\}\s*/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.input?.content || parsed.input?.type === "text") {
        // Extract metadata from structured input
        if (parsed.request_id) metadata.request_id = parsed.request_id;
        if (parsed.enterprise_id) metadata.enterprise_id = parsed.enterprise_id;
        if (parsed.project_id) metadata.project_id = parsed.project_id;
        
        // Use the actual content
        if (parsed.input?.content) {
          content = parsed.input.content;
        }
        
        // Extract options if provided
        if (parsed.options) {
          if (parsed.options.verbosity) {
            options.verbosity = parsed.options.verbosity;
          }
          if (parsed.options.return_intermediate !== undefined) {
            options.return_intermediate = parsed.options.return_intermediate;
          }
        }
      }
    } catch {
      // Not valid JSON, continue with original content
    }
  }

  // Extract metadata from options if provided
  if (options.request_id) metadata.request_id = options.request_id;
  if (options.enterprise_id) metadata.enterprise_id = options.enterprise_id;
  if (options.project_id) metadata.project_id = options.project_id;

  // Language detection (reuse existing function)
  const languageCode = detectLanguage(content);
  const languageName = getLanguageName(languageCode);

  return {
    content,
    language: { code: languageCode, name: languageName },
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    options: {
      verbosity: options.verbosity || "normal",
      return_intermediate: options.return_intermediate ?? false,
    },
  };
}
