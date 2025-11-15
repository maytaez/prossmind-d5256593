import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Check, AlertCircle } from "lucide-react";

interface AnimatedInputProps extends React.ComponentProps<"input"> {
  label?: string;
  error?: string;
  success?: boolean;
  showLabel?: boolean;
}

const AnimatedInput = React.forwardRef<HTMLInputElement, AnimatedInputProps>(
  ({ className, label, error, success, showLabel = true, value, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const [hasValue, setHasValue] = React.useState(!!value);

    React.useEffect(() => {
      setHasValue(!!value || (typeof value === "string" && value.length > 0));
    }, [value]);

    const shouldFloatLabel = isFocused || hasValue;

    return (
      <div className="relative w-full">
        {showLabel && label && (
          <motion.label
            className={cn(
              "absolute left-3 text-muted-foreground pointer-events-none transition-colors",
              shouldFloatLabel
                ? "top-2 text-xs"
                : "top-1/2 -translate-y-1/2 text-sm"
            )}
            initial={false}
            animate={{
              y: shouldFloatLabel ? 0 : "50%",
              fontSize: shouldFloatLabel ? "0.75rem" : "0.875rem",
            }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {label}
          </motion.label>
        )}

        <motion.div 
          className="relative"
          animate={{
            boxShadow: isFocused && !error && !success 
              ? "0 0 20px rgba(100, 180, 255, 0.3)" 
              : "none",
          }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            animate={{
              x: error ? [0, -10, 10, -10, 10, 0] : 0,
            }}
            transition={{
              duration: 0.5,
              times: [0, 0.2, 0.4, 0.6, 0.8, 1],
            }}
          >
            <Input
              ref={ref}
              className={cn(
                showLabel && label && "pt-6 pb-2",
                error && "border-destructive focus-visible:ring-destructive",
                success && "border-green-500 focus-visible:ring-green-500",
                isFocused && !error && !success && "border-primary",
                className
              )}
              style={{
                backgroundColor: isFocused ? "hsl(var(--background) / 1.05)" : undefined,
                transition: "all 0.3s ease",
              }}
              value={value}
              onFocus={(e) => {
                setIsFocused(true);
                props.onFocus?.(e);
              }}
              onBlur={(e) => {
                setIsFocused(false);
                props.onBlur?.(e);
              }}
              onChange={(e) => {
                setHasValue(!!e.target.value);
                props.onChange?.(e);
              }}
              {...props}
            />
          </motion.div>

          {/* Animated underline */}
          <motion.div
            className={cn(
              "absolute bottom-0 left-0 h-0.5",
              error ? "bg-destructive" : success ? "bg-green-500" : "bg-primary"
            )}
            initial={{ width: 0 }}
            animate={{ width: isFocused ? "100%" : 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />

          {/* Success/Error icons */}
          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <Check className="h-4 w-4 text-green-500" />
              </motion.div>
            )}
            {error && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <AlertCircle className="h-4 w-4 text-destructive" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Error message */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-1 text-sm text-destructive"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

AnimatedInput.displayName = "AnimatedInput";

export { AnimatedInput };

