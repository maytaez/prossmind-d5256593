import { motion, useInView, useMotionValue, useSpring } from "framer-motion";
import { useRef, useEffect, useState } from "react";

interface CounterAnimationProps {
  value: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

const CounterAnimation = ({ 
  value, 
  duration = 2, 
  className = "",
  prefix = "",
  suffix = ""
}: CounterAnimationProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 100, damping: 30 });
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (isInView) {
      motionValue.set(value);
    }
  }, [isInView, value, motionValue]);

  useEffect(() => {
    const unsubscribe = spring.on("change", (latest) => {
      setDisplayValue(Math.floor(latest));
    });
    return () => unsubscribe();
  }, [spring]);

  return (
    <motion.span
      ref={ref}
      className={className}
    >
      {prefix}
      {displayValue}
      {suffix}
    </motion.span>
  );
};

export default CounterAnimation;

