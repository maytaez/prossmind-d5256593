import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { FeatureFlags, loadFeatureFlags, saveFeatureFlags, defaultFeatureFlags } from "@/config/featureFlags";
import { shouldDisableHeavyVisuals } from "@/utils/deviceDetection";

interface FeatureFlagsContextType {
  flags: FeatureFlags;
  setFlag: (key: keyof FeatureFlags, value: boolean) => void;
  setFlags: (flags: Partial<FeatureFlags>) => void;
  resetFlags: () => void;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType | undefined>(undefined);

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlagsState] = useState<FeatureFlags>(() => {
    if (typeof window === "undefined") {
      return defaultFeatureFlags;
    }
    return loadFeatureFlags();
  });

  // Load flags from localStorage on mount and apply device-based optimizations
  useEffect(() => {
    const loadedFlags = loadFeatureFlags();
    
    // Disable heavy visuals on low-power devices
    if (shouldDisableHeavyVisuals()) {
      setFlagsState({
        ...loadedFlags,
        heavyVisuals: false,
        gradientBackgrounds: false,
      });
    } else {
      setFlagsState(loadedFlags);
    }
  }, []);

  // Save flags to localStorage whenever they change
  useEffect(() => {
    saveFeatureFlags(flags);
  }, [flags]);

  const setFlag = (key: keyof FeatureFlags, value: boolean) => {
    setFlagsState((prev) => {
      const updated = { ...prev, [key]: value };
      return updated;
    });
  };

  const setFlags = (newFlags: Partial<FeatureFlags>) => {
    setFlagsState((prev) => {
      const updated = { ...prev, ...newFlags };
      return updated;
    });
  };

  const resetFlags = () => {
    setFlagsState(defaultFeatureFlags);
    saveFeatureFlags(defaultFeatureFlags);
  };

  return (
    <FeatureFlagsContext.Provider value={{ flags, setFlag, setFlags, resetFlags }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  const context = useContext(FeatureFlagsContext);
  if (context === undefined) {
    throw new Error("useFeatureFlags must be used within a FeatureFlagsProvider");
  }
  return context;
}

