import { motion, useScroll, useTransform } from "framer-motion";
import { ReactNode } from "react";

interface AnimatedGradientProps {
  children?: ReactNode;
  className?: string;
  speed?: number;
}

const AnimatedGradient = ({ children, className = "", speed = 1 }: AnimatedGradientProps) => {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 1000], [0, 100 * speed]);

  return (
    <motion.div
      className={`absolute inset-0 animated-gradient ${className}`}
      style={{ y }}
    >
      {children}
    </motion.div>
  );
};

export default AnimatedGradient;



