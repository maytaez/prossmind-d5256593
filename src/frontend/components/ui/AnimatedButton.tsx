import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button, ButtonProps } from "@/components/ui/button";
import { Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnimatedButtonProps extends ButtonProps {
  isLoading?: boolean;
  showSuccess?: boolean;
  successDuration?: number;
  onSuccessComplete?: () => void;
}

const AnimatedButton = React.forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  (
    {
      className,
      children,
      isLoading = false,
      showSuccess = false,
      successDuration = 2000,
      onSuccessComplete,
      onClick,
      ...props
    },
    ref
  ) => {
    const [ripples, setRipples] = React.useState<Array<{ id: number; x: number; y: number }>>([]);
    const buttonRef = React.useRef<HTMLButtonElement>(null);

    React.useImperativeHandle(ref, () => buttonRef.current as HTMLButtonElement);

    React.useEffect(() => {
      if (showSuccess) {
        const timer = setTimeout(() => {
          onSuccessComplete?.();
        }, successDuration);
        return () => clearTimeout(timer);
      }
    }, [showSuccess, successDuration, onSuccessComplete]);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (buttonRef.current && !isLoading && !showSuccess) {
        const rect = buttonRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const newRipple = {
          id: Date.now(),
          x,
          y,
        };

        setRipples((prev) => [...prev, newRipple]);

        setTimeout(() => {
          setRipples((prev) => prev.filter((ripple) => ripple.id !== newRipple.id));
        }, 600);
      }

      onClick?.(e);
    };

    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="relative inline-block"
      >
        <Button
          ref={buttonRef}
          className={cn("relative overflow-hidden", className)}
          onClick={handleClick}
          disabled={isLoading || showSuccess}
          {...props}
        >
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading...</span>
              </motion.div>
            ) : showSuccess ? (
              <motion.div
                key="success"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="flex items-center gap-2"
              >
                <Check className="h-4 w-4" />
                <span>Success!</span>
              </motion.div>
            ) : (
              <motion.div
                key="content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {children}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Ripple effects */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {ripples.map((ripple) => (
              <motion.span
                key={ripple.id}
                className="absolute rounded-full bg-white/30"
                style={{
                  left: ripple.x,
                  top: ripple.y,
                  width: 0,
                  height: 0,
                }}
                animate={{
                  width: 200,
                  height: 200,
                  x: -100,
                  y: -100,
                  opacity: [0.5, 0],
                }}
                transition={{
                  duration: 0.6,
                  ease: "easeOut",
                }}
              />
            ))}
          </div>
        </Button>
      </motion.div>
    );
  }
);

AnimatedButton.displayName = "AnimatedButton";

export { AnimatedButton };





