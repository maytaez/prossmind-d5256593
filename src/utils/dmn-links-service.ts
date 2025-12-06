/**
 * Service for managing BPMN-DMN links
 */

import { supabase } from "@/integrations/supabase/client";

export interface DmnLink {
  id: string;
  project_id: string;
  bpmn_gateway_id: string;
  dmn_decision_id: string;
  dmn_project_id: string;
  created_at: string;
  updated_at: string;
}

export interface DmnLinkInsert {
  project_id: string;
  bpmn_gateway_id: string;
  dmn_decision_id: string;
  dmn_project_id: string;
}

/**
 * Create a link between a BPMN gateway and a DMN decision table
 */
export async function createDmnLink(
  link: DmnLinkInsert
): Promise<{ data: DmnLink | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from("dmn_links")
      .insert(link)
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as DmnLink, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error("Unknown error"),
    };
  }
}

/**
 * Get all links for a BPMN project
 */
export async function getLinksForProject(
  projectId: string
): Promise<{ data: DmnLink[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from("dmn_links")
      .select("*")
      .eq("project_id", projectId);

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as DmnLink[], error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error("Unknown error"),
    };
  }
}

/**
 * Get links for a specific BPMN gateway
 */
export async function getLinksForGateway(
  projectId: string,
  gatewayId: string
): Promise<{ data: DmnLink[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from("dmn_links")
      .select("*")
      .eq("project_id", projectId)
      .eq("bpmn_gateway_id", gatewayId);

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as DmnLink[], error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error("Unknown error"),
    };
  }
}

/**
 * Get links for a specific DMN decision
 */
export async function getLinksForDmnDecision(
  dmnProjectId: string,
  decisionId: string
): Promise<{ data: DmnLink[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from("dmn_links")
      .select("*")
      .eq("dmn_project_id", dmnProjectId)
      .eq("dmn_decision_id", decisionId);

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as DmnLink[], error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error("Unknown error"),
    };
  }
}

/**
 * Delete a DMN link
 */
export async function deleteDmnLink(
  linkId: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from("dmn_links")
      .delete()
      .eq("id", linkId);

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
 * Delete all links for a BPMN gateway
 */
export async function deleteLinksForGateway(
  projectId: string,
  gatewayId: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from("dmn_links")
      .delete()
      .eq("project_id", projectId)
      .eq("bpmn_gateway_id", gatewayId);

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






