/**
 * Feature Flags Configuration
 * Controls UI/UX enhancements that can be toggled without code deployment
 */

export interface FeatureFlags {
  animations: boolean;
  heavyVisuals: boolean;
  neuralGraph: boolean;
  gradientBackgrounds: boolean;
  darkMode: boolean;
}

const STORAGE_KEY = 'prossmind-feature-flags';

// Default values - can be overridden by environment variables
const getDefaultFlags = (): FeatureFlags => {
  // In development, enable all features by default
  const isDev = import.meta.env.DEV;
  
  // Check for environment variable overrides
  const envFlags = import.meta.env.VITE_FEATURE_FLAGS;
  if (envFlags) {
    try {
      const parsed = JSON.parse(envFlags);
      return { ...getDefaultFlags(), ...parsed };
    } catch (e) {
      console.warn('Failed to parse VITE_FEATURE_FLAGS:', e);
    }
  }
  
  // Check device capabilities for performance optimization
  // Device detection will be handled at runtime in FeatureFlagsProvider
  // to avoid SSR issues
  
  return {
    animations: true, // Enable animations by default
    heavyVisuals: true, // Enable by default (will be disabled on low-power devices at runtime)
    neuralGraph: false, // Opt-in by default
    gradientBackgrounds: true, // Enable animated gradients by default
    darkMode: true, // Always enabled
  };
};

export const defaultFeatureFlags: FeatureFlags = getDefaultFlags();

/**
 * Load feature flags from localStorage or return defaults
 */
export const loadFeatureFlags = (): FeatureFlags => {
  if (typeof window === 'undefined') {
    return defaultFeatureFlags;
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults, but ensure animations and gradientBackgrounds are enabled
      // This ensures users get the new animations even if they had them disabled before
      return { 
        ...defaultFeatureFlags, 
        ...parsed,
        // Force enable animations and gradientBackgrounds for better UX
        animations: parsed.animations !== undefined ? parsed.animations : true,
        gradientBackgrounds: parsed.gradientBackgrounds !== undefined ? parsed.gradientBackgrounds : true,
      };
    }
  } catch (e) {
    console.warn('Failed to load feature flags from localStorage:', e);
  }
  
  return defaultFeatureFlags;
};

/**
 * Save feature flags to localStorage
 */
export const saveFeatureFlags = (flags: FeatureFlags): void => {
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
  } catch (e) {
    console.warn('Failed to save feature flags to localStorage:', e);
  }
};

