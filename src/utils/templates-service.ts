/**
 * Templates service for fetching and managing BPMN/PID diagram templates
 */

import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type Template = Database["public"]["Tables"]["templates"]["Row"];
type TemplateInsert = Database["public"]["Tables"]["templates"]["Insert"];
type TemplateUpdate = Database["public"]["Tables"]["templates"]["Update"];

export interface TemplateFilters {
  category?: string;
  diagramType?: "bpmn" | "pid";
}

/**
 * Fetch templates with optional filtering
 */
export async function getTemplates(
  filters?: TemplateFilters
): Promise<{ data: Template[] | null; error: Error | null }> {
  try {
    let query = supabase
      .from("templates")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (filters?.category && filters.category !== "all") {
      query = query.eq("category", filters.category);
    }

    if (filters?.diagramType) {
      query = query.eq("diagram_type", filters.diagramType);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as Template[], error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error("Unknown error"),
    };
  }
}

/**
 * Fetch a single template by ID
 */
export async function getTemplateById(
  id: string
): Promise<{ data: Template | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from("templates")
      .select("*")
      .eq("id", id)
      .eq("is_active", true)
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as Template, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error("Unknown error"),
    };
  }
}

/**
 * Use a template - increments usage count and returns the template XML
 */
export async function useTemplate(
  id: string,
  userId: string
): Promise<{ data: string | null; error: Error | null }> {
  try {
    // First, get the template
    const { data: template, error: fetchError } = await supabase
      .from("templates")
      .select("bpmn_xml, usage_count")
      .eq("id", id)
      .eq("is_active", true)
      .single();

    if (fetchError || !template) {
      return {
        data: null,
        error: new Error(fetchError?.message || "Template not found"),
      };
    }

    // Increment usage count (fire and forget - don't wait for this)
    supabase
      .from("templates")
      .update({ usage_count: (template.usage_count || 0) + 1 })
      .eq("id", id)
      .then(() => {
        // Silently handle errors for usage tracking
      })
      .catch(() => {
        // Silently handle errors for usage tracking
      });

    return { data: template.bpmn_xml, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error("Unknown error"),
    };
  }
}

/**
 * Create a new template (Admin only)
 */
export async function createTemplate(
  template: TemplateInsert
): Promise<{ data: Template | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from("templates")
      .insert(template)
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as Template, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error("Unknown error"),
    };
  }
}

/**
 * Update an existing template (Admin only)
 */
export async function updateTemplate(
  id: string,
  updates: TemplateUpdate
): Promise<{ data: Template | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from("templates")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as Template, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error("Unknown error"),
    };
  }
}

/**
 * Delete (soft delete) a template (Admin only)
 */
export async function deleteTemplate(
  id: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from("templates")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err : new Error("Unknown error"),
    };
  }
}

/**
 * Get all templates including inactive ones (Admin only)
 */
export async function getAllTemplates(
  filters?: TemplateFilters
): Promise<{ data: Template[] | null; error: Error | null }> {
  try {
    let query = supabase
      .from("templates")
      .select("*")
      .order("created_at", { ascending: false });

    if (filters?.category && filters.category !== "all") {
      query = query.eq("category", filters.category);
    }

    if (filters?.diagramType) {
      query = query.eq("diagram_type", filters.diagramType);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as Template[], error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error("Unknown error"),
    };
  }
}

