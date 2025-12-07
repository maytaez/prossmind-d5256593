import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const AnimatedTabs = TabsPrimitive.Root;

const AnimatedTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground relative gap-1",
      className
    )}
    {...props}
  />
));
AnimatedTabsList.displayName = TabsPrimitive.List.displayName;

const AnimatedTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, ...props }, ref) => {
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [isActive, setIsActive] = React.useState(false);

  React.useImperativeHandle(ref, () => triggerRef.current as HTMLButtonElement);

  React.useEffect(() => {
    const checkActive = () => {
      if (triggerRef.current) {
        setIsActive(triggerRef.current.getAttribute("data-state") === "active");
      }
    };
    checkActive();
    const observer = new MutationObserver(checkActive);
    if (triggerRef.current) {
      observer.observe(triggerRef.current, { attributes: true, attributeFilter: ["data-state"] });
    }
    return () => observer.disconnect();
  }, []);

  return (
    <TabsPrimitive.Trigger
      ref={triggerRef}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 relative z-10 flex-1",
        "data-[state=active]:text-foreground",
        "hover:text-foreground/90",
        className
      )}
      {...props}
    >
      <span className="relative z-10 flex items-center justify-center w-full">{children}</span>
      {isActive && (
        <motion.div
          layoutId="activeTabIndicator"
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
          initial={false}
          transition={{ type: "spring", stiffness: 380, damping: 30, duration: 0.4 }}
        />
      )}
    </TabsPrimitive.Trigger>
  );
});
AnimatedTabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const AnimatedTabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => {
  const [direction, setDirection] = React.useState(1);
  const prevValueRef = React.useRef<string>();

  React.useEffect(() => {
    if (prevValueRef.current && props.value) {
      const prevIndex = parseInt(prevValueRef.current) || 0;
      const currentIndex = parseInt(props.value as string) || 0;
      setDirection(currentIndex > prevIndex ? 1 : -1);
    }
    prevValueRef.current = props.value as string;
  }, [props.value]);

  return (
    <AnimatePresence mode="wait" custom={direction}>
      <TabsPrimitive.Content
        key={props.value}
        ref={ref}
        className={cn(
          "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className
        )}
        {...props}
        asChild
      >
        <motion.div
          custom={direction}
          initial={{ opacity: 0, x: direction * 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -20 }}
          transition={{ 
            opacity: { duration: 0.3 },
            x: { duration: 0.2 },
            ease: "easeInOut" 
          }}
        >
          {props.children}
        </motion.div>
      </TabsPrimitive.Content>
    </AnimatePresence>
  );
});
AnimatedTabsContent.displayName = TabsPrimitive.Content.displayName;

export { AnimatedTabs, AnimatedTabsList, AnimatedTabsTrigger, AnimatedTabsContent };

