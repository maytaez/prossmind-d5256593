import { useEffect, useState } from "react";

/**
 * Hook to check if user prefers reduced motion
 * Returns true if prefers-reduced-motion is set to 'reduce'
 */
export const useReducedMotion = (): boolean => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check initial preference
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    // Listen for changes
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  return prefersReducedMotion;
};

/**
 * Get reduced motion variants for Framer Motion
 * Returns variants that disable animations when reduced motion is preferred
 */
export const getReducedMotionVariants = (prefersReducedMotion: boolean) => {
  if (prefersReducedMotion) {
    return {
      hidden: { opacity: 1 },
      visible: { opacity: 1 },
    };
  }
  return undefined; // Use default variants
};

/**
 * Get reduced motion transition for Framer Motion
 * Returns transition that disables animations when reduced motion is preferred
 */
export const getReducedMotionTransition = (prefersReducedMotion: boolean) => {
  if (prefersReducedMotion) {
    return { duration: 0 };
  }
  return undefined; // Use default transition
};




