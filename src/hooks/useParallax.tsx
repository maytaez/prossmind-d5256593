import { useEffect, useState } from "react";

export const useParallax = (speed: number = 1) => {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      return; // Disable parallax if user prefers reduced motion
    }

    const handleScroll = () => {
      const scrollY = window.scrollY;
      setOffset(scrollY * speed);
    };

    // Throttle scroll listener to 60fps
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [speed]);

  return offset;
};

