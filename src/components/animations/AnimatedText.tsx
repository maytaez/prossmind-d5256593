import { motion } from "framer-motion";
import { ReactNode } from "react";

interface AnimatedTextProps {
  text: string;
  className?: string;
  delay?: number;
  staggerDelay?: number;
}

const AnimatedText = ({ text, className = "", delay = 0, staggerDelay = 0.05 }: AnimatedTextProps) => {
  const characters = text.split("");

  return (
    <span className={className}>
      {characters.map((char, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: delay + index * staggerDelay,
            duration: 0.6,
            ease: "easeOut",
          }}
          style={{ display: "inline-block" }}
        >
          {char === " " ? "\u00A0" : char}
        </motion.span>
      ))}
    </span>
  );
};

export default AnimatedText;




