import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "@/context/ThemeContext";

const FloatingCTA = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const handleScroll = () => {
      const heroSection = document.querySelector('section');
      const heroHeight = heroSection?.offsetHeight || 700;
      const scrollY = window.scrollY;

      // Show CTA after scrolling past hero section
      setIsVisible(scrollY > heroHeight * 0.7);
      
      // Show scroll to top button when scrolled far down
      setShowScrollTop(scrollY > 500);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTry = () => {
    const trySection = document.querySelector('[data-section="try-prossmind"]');
    trySection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (prefersReducedMotion) {
    return null;
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-6 right-6 z-50 flex flex-col gap-3"
        >
          <Button
            onClick={scrollToTry}
            size="lg"
            className="rounded-full shadow-2xl hover:shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
            aria-label="Try ProssMind for free"
          >
            Try It Free
            <ArrowUp className="h-4 w-4 rotate-180" aria-hidden="true" />
          </Button>
          {showScrollTop && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <Button
                onClick={scrollToTop}
                size="icon"
                variant="outline"
                className="rounded-full shadow-lg hover:shadow-xl w-12 h-12"
                aria-label="Scroll to top"
              >
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              </Button>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FloatingCTA;



