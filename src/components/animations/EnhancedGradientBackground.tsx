import { motion, useScroll, useTransform } from "framer-motion";

interface EnhancedGradientBackgroundProps {
  className?: string;
}

const EnhancedGradientBackground = ({ className = "" }: EnhancedGradientBackgroundProps) => {
  const { scrollY } = useScroll();
  
  // Parallax effects for different layers
  const layer1Y = useTransform(scrollY, [0, 500], [0, 50]); // Fast layer
  const layer2Y = useTransform(scrollY, [0, 500], [0, 75]); // Medium layer
  const layer3Y = useTransform(scrollY, [0, 500], [0, 100]); // Slow layer

  return (
    <>
      {/* Layer 1: Fast movement (8s cycle) - Bottom right radial gradient */}
      <motion.div
        className={`absolute bottom-0 right-0 w-[60%] h-[60%] ${className}`}
        style={{
          background: "radial-gradient(circle at bottom right, #2563EB 0%, #9333EA 40%, #06B6D4 70%, transparent 100%)",
          backgroundSize: "200% 200%",
          y: layer1Y,
        }}
        animate={{
          backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      {/* Layer 2: Medium movement (12s cycle) - Bottom right radial gradient */}
      <motion.div
        className={`absolute bottom-0 right-0 w-[70%] h-[70%] opacity-60 ${className}`}
        style={{
          background: "radial-gradient(circle at bottom right, #9333EA 0%, #06B6D4 35%, #2563EB 65%, transparent 100%)",
          backgroundSize: "200% 200%",
          y: layer2Y,
        }}
        animate={{
          backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      {/* Layer 3: Slow movement (16s cycle) - Bottom right radial gradient */}
      <motion.div
        className={`absolute bottom-0 right-0 w-[80%] h-[80%] opacity-40 ${className}`}
        style={{
          background: "radial-gradient(circle at bottom right, #06B6D4 0%, #2563EB 30%, #9333EA 60%, transparent 100%)",
          backgroundSize: "200% 200%",
          y: layer3Y,
        }}
        animate={{
          backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"],
        }}
        transition={{
          duration: 16,
          repeat: Infinity,
          ease: "linear",
        }}
      />
    </>
  );
};

export default EnhancedGradientBackground;

