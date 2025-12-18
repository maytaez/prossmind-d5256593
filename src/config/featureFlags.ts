/**
 * Feature Flags Configuration
 * Toggle features on/off by setting flags to true or false
 */

export const featureFlags = {
  /**
   * Show team section on the Contact page
   * Set to true to display the "Meet Our Team" section with team member profiles
   * Set to false to hide the team section completely
   */
  showTeamSection: false,

  /**
   * Show language preference selector in BPMN Viewer and Modeling Agent Mode
   * Set to true to display the language preference dropdown
   * Set to false to hide the language preference feature
   */
  showLanguagePreference: false,

  /**
   * Enable P&ID (Piping and Instrumentation Diagram) functionality
   * Set to true to enable P&ID diagram generation, viewing, and editing
   * Set to false to disable all P&ID features (BPMN only mode)
   * 
   * When disabled:
   * - P&ID tab will be hidden from diagram generators
   * - P&ID projects won't be accessible
   * - P&ID templates will be hidden
   * - Vision AI won't process P&ID diagrams
   * - Backend functions will reject P&ID requests
   */
  enablePidDiagrams: false,
} as const;
