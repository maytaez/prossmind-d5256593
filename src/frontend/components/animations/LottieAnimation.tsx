import { useEffect, useRef, useState } from "react";
import lottie, { AnimationItem } from "lottie-web";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface LottieAnimationProps {
  src: string;
  autoplay?: boolean;
  loop?: boolean;
  className?: string;
  "aria-label"?: string;
  lazy?: boolean;
  fallback?: React.ReactNode;
}

/**
 * LottieAnimation - Reusable Lottie animation component with lazy loading and reduced motion support
 */
const LottieAnimation = ({
  src,
  autoplay = true,
  loop = true,
  className = "",
  "aria-label": ariaLabel,
  lazy = true,
  fallback,
}: LottieAnimationProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<AnimationItem | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const [shouldLoad, setShouldLoad] = useState(!lazy);

  // Lazy loading: Load when container is near viewport
  useEffect(() => {
    if (!lazy || shouldLoad) return;

    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldLoad(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: "100px", // Start loading 100px before entering viewport
        threshold: 0,
      }
    );

    observer.observe(container);

    // Fallback: Load on idle if IntersectionObserver is not supported
    if (typeof window.requestIdleCallback !== "undefined") {
      const idleCallback = window.requestIdleCallback(() => {
        if (!shouldLoad) {
          setShouldLoad(true);
        }
      });
      return () => {
        observer.disconnect();
        window.cancelIdleCallback(idleCallback);
      };
    }

    return () => observer.disconnect();
  }, [lazy, shouldLoad]);

  // Load Lottie animation
  useEffect(() => {
    if (!shouldLoad || !containerRef.current || prefersReducedMotion) {
      if (prefersReducedMotion && fallback) {
        setIsLoaded(true);
      }
      return;
    }

    let mounted = true;

    const loadAnimation = async () => {
      try {
        // Load animation JSON
        const response = await fetch(src);
        if (!response.ok) {
          throw new Error(`Failed to load animation: ${response.statusText}`);
        }
        const animationData = await response.json();

        if (!mounted || !containerRef.current) return;

        // Create Lottie animation
        const animation = lottie.loadAnimation({
          container: containerRef.current,
          renderer: "svg",
          loop,
          autoplay,
          animationData,
        });

        animationRef.current = animation;
        setIsLoaded(true);
      } catch (error) {
        console.error("Error loading Lottie animation:", error);
        if (mounted) {
          setHasError(true);
          setIsLoaded(true);
        }
      }
    };

    loadAnimation();

    return () => {
      mounted = false;
      if (animationRef.current) {
        animationRef.current.destroy();
        animationRef.current = null;
      }
    };
  }, [src, shouldLoad, prefersReducedMotion, autoplay, loop, fallback]);

  // Show fallback if reduced motion is preferred or error occurred
  if (prefersReducedMotion && fallback) {
    return <div className={className}>{fallback}</div>;
  }

  if (hasError && fallback) {
    return <div className={className}>{fallback}</div>;
  }

  return (
    <div
      ref={containerRef}
      className={className}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : "true"}
      role={ariaLabel ? "img" : undefined}
    />
  );
};

export default LottieAnimation;





