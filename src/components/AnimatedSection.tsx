import { ReactNode } from "react";
import { motion } from "framer-motion";
import { useFeatureFlags } from "@/context/FeatureFlagsContext";
import { useReducedMotion } from "@/context/ThemeContext";

interface AnimatedSectionProps {
  children: ReactNode;
  variant?: "fade-up" | "fade-in" | "slide-up";
  delay?: number;
  className?: string;
}

const AnimatedSection = ({
  children,
  variant = "fade-up",
  delay = 0,
  className = "",
}: AnimatedSectionProps) => {
  const { flags } = useFeatureFlags();
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = flags.animations && !prefersReducedMotion;

  if (!shouldAnimate) {
    return <div className={className}>{children}</div>;
  }

  const variants = {
    "fade-up": {
      hidden: { opacity: 0, y: 30 },
      visible: { opacity: 1, y: 0 },
    },
    "fade-in": {
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
    },
    "slide-up": {
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0 },
    },
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      transition={{
        duration: 0.6,
        delay,
        ease: [0.4, 0, 0.2, 1],
      }}
      variants={variants[variant]}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export default AnimatedSection;

