import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useReducedMotion, getReducedMotionTransition } from "@/hooks/useReducedMotion";

interface TourStep {
  target: string; // CSS selector for the element to highlight
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
}

interface ProductTourProps {
  steps: TourStep[];
  onComplete?: () => void;
  storageKey?: string;
}

/**
 * ProductTour - Guided product tour system with step-by-step overlays
 */
const ProductTour = ({ steps, onComplete, storageKey = "product-tour-completed" }: ProductTourProps) => {
  const prefersReducedMotion = useReducedMotion();
  const [currentStep, setCurrentStep] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);

  // Check if tour was already completed
  useEffect(() => {
    const completed = localStorage.getItem(storageKey);
    if (!completed) {
      setIsOpen(true);
    }
  }, [storageKey]);

  // Update target element when step changes
  useEffect(() => {
    if (!isOpen || currentStep >= steps.length) return;

    const step = steps[currentStep];
    const element = document.querySelector(step.target) as HTMLElement;
    setTargetElement(element);

    if (element) {
      // Scroll element into view
      element.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" });
    }
  }, [currentStep, isOpen, steps, prefersReducedMotion]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    setIsOpen(false);
    localStorage.setItem(storageKey, "true");
    onComplete?.();
  };

  const handleSkip = () => {
    handleComplete();
  };

  if (!isOpen || currentStep >= steps.length) return null;

  const step = steps[currentStep];
  const targetRect = targetElement?.getBoundingClientRect();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleSkip}
          />

          {/* Highlight box */}
          {targetRect && (
            <motion.div
              className="fixed z-50 pointer-events-none"
              style={{
                left: targetRect.left - 8,
                top: targetRect.top - 8,
                width: targetRect.width + 16,
                height: targetRect.height + 16,
              }}
              initial={prefersReducedMotion ? {} : { scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={getReducedMotionTransition(prefersReducedMotion) || { duration: 0.3 }}
            >
              <div className="absolute inset-0 border-4 border-primary rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
            </motion.div>
          )}

          {/* Tooltip */}
          <motion.div
            className="fixed z-50 bg-card border border-border rounded-lg shadow-lg p-6 max-w-sm"
            style={{
              left: targetRect
                ? step.position === "right"
                  ? targetRect.right + 20
                  : step.position === "left"
                  ? targetRect.left - 320
                  : targetRect.left + targetRect.width / 2 - 160
                : "50%",
              top: targetRect
                ? step.position === "bottom"
                  ? targetRect.bottom + 20
                  : step.position === "top"
                  ? targetRect.top - 200
                  : targetRect.top - 180
                : "50%",
            }}
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={getReducedMotionTransition(prefersReducedMotion) || { duration: 0.3 }}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">{step.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleSkip}
                aria-label="Close tour"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Step {currentStep + 1} of {steps.length}
              </div>
              <div className="flex gap-2">
                {currentStep > 0 && (
                  <Button variant="outline" size="sm" onClick={handlePrevious}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                )}
                <Button size="sm" onClick={handleNext}>
                  {currentStep < steps.length - 1 ? (
                    <>
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </>
                  ) : (
                    "Finish"
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ProductTour;





