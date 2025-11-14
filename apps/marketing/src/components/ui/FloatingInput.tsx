import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X } from "lucide-react";
import { cn } from "@prossmind/shared/utils";

export interface FloatingInputProps extends React.ComponentProps<"input"> {
  label: string;
  error?: boolean;
  success?: boolean;
  errorMessage?: string;
}

const FloatingInput = React.forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ className, label, error, success, errorMessage, value, onFocus, onBlur, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const [hasValue, setHasValue] = React.useState(!!value);
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    React.useEffect(() => {
      setHasValue(!!value || (inputRef.current?.value?.length ?? 0) > 0);
    }, [value]);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      setHasValue(!!e.target.value);
      onBlur?.(e);
    };

    const isFloating = isFocused || hasValue;

    return (
      <div className="relative w-full">
        <div className="relative">
          <motion.label
            className={cn(
              "absolute left-3 pointer-events-none transition-colors duration-300",
              isFloating
                ? "top-2 text-xs text-primary"
                : "top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
            )}
            animate={{
              top: isFloating ? 8 : "50%",
              fontSize: isFloating ? 12 : 14,
              transform: isFloating ? "translateY(0)" : "translateY(-50%)",
            }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {label}
          </motion.label>
          <motion.input
            ref={inputRef}
            type="text"
            className={cn(
              "flex h-10 w-full rounded-md border bg-background px-3 pt-4 pb-2 text-base ring-offset-background",
              "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
              error
                ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive"
                : success
                ? "border-green-500 focus-visible:border-green-500 focus-visible:ring-green-500"
                : "border-input",
              error && "animate-pulse-error",
              className
            )}
            value={value}
            onFocus={handleFocus}
            onBlur={handleBlur}
            animate={{
              borderColor: error 
                ? "hsl(var(--destructive))" 
                : success 
                ? "rgb(34, 197, 94)" 
                : isFocused 
                ? "hsl(var(--primary) / 0.8)" 
                : "hsl(var(--input))",
              boxShadow: isFocused && !error && !success
                ? "0 0 30px rgba(100, 180, 255, 0.4), 0 0 15px rgba(100, 180, 255, 0.2)"
                : "none",
              backgroundColor: isFocused 
                ? "hsl(var(--background) / 1.05)" 
                : "hsl(var(--background))",
            }}
            transition={{ duration: 0.3 }}
            {...props}
          />
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
                <X className="h-4 w-4 text-destructive" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {error && errorMessage && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1 text-xs text-destructive"
          >
            {errorMessage}
          </motion.p>
        )}
      </div>
    );
  }
);
FloatingInput.displayName = "FloatingInput";

export { FloatingInput };

