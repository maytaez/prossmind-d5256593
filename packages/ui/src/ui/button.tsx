import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2, Check, X, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@prossmind/shared/utils";
import { useRippleEffect } from "@prossmind/shared/hooks";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:scale-[1.02] active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg hover:shadow-primary/20",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md hover:shadow-lg",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground hover:border-primary/50 hover:shadow-[0_0_15px_rgba(100,180,255,0.5)] hover:bg-background/5",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        gradient: "bg-gradient-to-r from-primary to-accent text-primary-foreground hover:shadow-[0_0_20px_rgba(100,180,255,0.5)] shadow-md hover:shadow-lg transition-all duration-300",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  success?: boolean;
  error?: boolean;
  errorMessage?: string;
  showRipple?: boolean;
  showArrow?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, success, error, errorMessage, showRipple = false, showArrow = false, children, disabled, onClick, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const isDisabled = disabled || loading || success;
    const { ripples, addRipple } = useRippleEffect();
    const [isHovered, setIsHovered] = React.useState(false);
    
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (showRipple && !isDisabled) {
        addRipple(e);
      }
      onClick?.(e);
    };
    
    return (
      <div className="relative">
        <Comp
          className={cn(
            buttonVariants({ variant, size, className }),
            success && "bg-green-600 hover:bg-green-600",
            error && "border-destructive animate-shake",
            "relative overflow-hidden"
          )}
          ref={ref}
          disabled={isDisabled}
          onClick={handleClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          {...props}
        >
          {showRipple && (
            <div className="absolute inset-0 pointer-events-none">
              {ripples.map((ripple) => (
                <motion.span
                  key={ripple.id}
                  className="absolute rounded-full bg-white/50"
                  style={{
                    left: ripple.x,
                    top: ripple.y,
                  }}
                  initial={{ width: 0, height: 0, x: "-50%", y: "-50%" }}
                  animate={{ width: 400, height: 400, opacity: [0.6, 0] }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              ))}
            </div>
          )}
          
          {/* Inner shadow effect */}
          {variant === "default" && (
            <div className="absolute inset-0 rounded-md shadow-inner opacity-0 hover:opacity-20 transition-opacity duration-300 pointer-events-none" />
          )}
          
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2"
              >
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {children}
              </motion.div>
            ) : success ? (
              <motion.div
                key="success"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="flex items-center gap-2"
              >
                <motion.svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <motion.path
                    d="M20 6L9 17l-5-5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </motion.svg>
                Success!
              </motion.div>
            ) : error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                {children}
              </motion.div>
            ) : (
              <motion.div
                key="default"
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2"
              >
                {children}
                {showArrow && (
                  <motion.div
                    animate={{
                      x: isHovered ? 4 : 0,
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    <ArrowRight className="h-4 w-4 text-cyan-400" aria-hidden="true" />
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </Comp>
        {error && errorMessage && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-full mt-1 text-xs text-destructive whitespace-nowrap"
          >
            {errorMessage}
          </motion.p>
        )}
      </div>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
