/**
 * Enterprise Style Profile Manager
 * Manages and retrieves enterprise style profiles for BPMN generation
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { EnterpriseStyleProfile } from "./types/bpmn-ir.ts";

/**
 * Default style profile
 */
const DEFAULT_STYLE_PROFILE: EnterpriseStyleProfile = {
  task_naming: "Verb + Business Object",
  gateway_naming: "Question Form",
  service_task_prefix: "Auto -",
  lane_policy: "lane_per_actor",
  end_event_policy: "explicit",
};

/**
 * Get enterprise style profile from database or return default
 */
export async function getStyleProfile(
  enterpriseId?: string,
  projectId?: string,
  supabase?: any
): Promise<EnterpriseStyleProfile> {
  // If no supabase client, return default
  if (!supabase || !enterpriseId) {
    return DEFAULT_STYLE_PROFILE;
  }

  try {
    // Try to get project-level profile first
    if (projectId) {
      const { data: projectProfile, error: projectError } = await supabase
        .from("enterprise_style_profiles")
        .select("*")
        .eq("enterprise_id", enterpriseId)
        .eq("project_id", projectId)
        .single();

      if (!projectError && projectProfile) {
        return mergeStyleProfile(DEFAULT_STYLE_PROFILE, projectProfile.style_profile);
      }
    }

    // Fall back to enterprise-level profile
    const { data: enterpriseProfile, error: enterpriseError } = await supabase
      .from("enterprise_style_profiles")
      .select("*")
      .eq("enterprise_id", enterpriseId)
      .is("project_id", null)
      .single();

    if (!enterpriseError && enterpriseProfile) {
      return mergeStyleProfile(DEFAULT_STYLE_PROFILE, enterpriseProfile.style_profile);
    }
  } catch (error) {
    console.warn("[Style Profile Manager] Error fetching profile:", error);
  }

  // Return default if no profile found
  return DEFAULT_STYLE_PROFILE;
}

/**
 * Merge custom style profile with default (custom overrides default)
 */
function mergeStyleProfile(
  defaultProfile: EnterpriseStyleProfile,
  customProfile: Partial<EnterpriseStyleProfile>
): EnterpriseStyleProfile {
  return {
    task_naming: customProfile.task_naming || defaultProfile.task_naming,
    gateway_naming: customProfile.gateway_naming || defaultProfile.gateway_naming,
    service_task_prefix: customProfile.service_task_prefix ?? defaultProfile.service_task_prefix,
    lane_policy: customProfile.lane_policy || defaultProfile.lane_policy,
    end_event_policy: customProfile.end_event_policy || defaultProfile.end_event_policy,
  };
}
