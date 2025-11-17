/**
 * Projects service for managing user's BPMN/PID diagram projects
 */

import { supabase } from "@/integrations/supabase/client";

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  diagram_type: "bpmn" | "pid";
  bpmn_xml: string;
  created_at: string;
  updated_at: string;
  last_accessed_at: string;
}

export interface ProjectInsert {
  user_id: string;
  name: string;
  description?: string | null;
  diagram_type: "bpmn" | "pid";
  bpmn_xml: string;
}

export interface ProjectUpdate {
  name?: string;
  description?: string | null;
  bpmn_xml?: string;
}

export interface ProjectFilters {
  diagramType?: "all" | "bpmn" | "pid";
}

/**
 * Create a new project
 */
export async function createProject(
  project: ProjectInsert
): Promise<{ data: Project | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from("projects")
      .insert(project)
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as Project, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error("Unknown error"),
    };
  }
}

/**
 * Get all projects for a user with optional filtering
 */
export async function getProjects(
  userId: string,
  filters?: ProjectFilters
): Promise<{ data: Project[] | null; error: Error | null }> {
  try {
    let query = supabase
      .from("projects")
      .select("*")
      .eq("user_id", userId)
      .order("last_accessed_at", { ascending: false });

    if (filters?.diagramType && filters.diagramType !== "all") {
      query = query.eq("diagram_type", filters.diagramType);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as Project[], error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error("Unknown error"),
    };
  }
}

/**
 * Get a single project by ID
 */
export async function getProject(
  projectId: string,
  userId: string
): Promise<{ data: Project | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", userId)
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as Project, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error("Unknown error"),
    };
  }
}

/**
 * Update a project
 */
export async function updateProject(
  projectId: string,
  userId: string,
  updates: ProjectUpdate
): Promise<{ data: Project | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", projectId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as Project, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error("Unknown error"),
    };
  }
}

/**
 * Delete a project
 */
export async function deleteProject(
  projectId: string,
  userId: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId)
      .eq("user_id", userId);

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
 * Update the last accessed timestamp for a project
 */
export async function updateLastAccessed(
  projectId: string,
  userId: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from("projects")
      .update({ last_accessed_at: new Date().toISOString() })
      .eq("id", projectId)
      .eq("user_id", userId);

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
 * Get recent projects for a user (limited count)
 */
export async function getRecentProjects(
  userId: string,
  limit: number = 6
): Promise<{ data: Project[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", userId)
      .order("last_accessed_at", { ascending: false })
      .limit(limit);

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as Project[], error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error("Unknown error"),
    };
  }
}


