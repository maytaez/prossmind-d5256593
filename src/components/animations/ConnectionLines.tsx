import { motion } from "framer-motion";
import { useRef, useEffect, useState } from "react";

interface ConnectionLine {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  particles: Array<{
    progress: number;
    speed: number;
  }>;
}

interface ConnectionLinesProps {
  containerRef: React.RefObject<HTMLDivElement>;
  centerX: number;
  centerY: number;
}

const ConnectionLines = ({ containerRef, centerX, centerY }: ConnectionLinesProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [lines, setLines] = useState<ConnectionLine[]>([]);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    if (!containerRef.current || centerX === 0 || centerY === 0) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const relativeCenterX = centerX - containerRect.left;
    const relativeCenterY = centerY - containerRect.top;

    // Create 5-8 connection lines
    const lineCount = 6;
    const newLines: ConnectionLine[] = Array.from({ length: lineCount }, (_, i) => {
      const angle = (i / lineCount) * Math.PI * 2;
      const length = 150 + Math.random() * 100;
      const endX = relativeCenterX + Math.cos(angle) * length;
      const endY = relativeCenterY + Math.sin(angle) * length;

      // Create 3-5 particles per line
      const particleCount = 3 + Math.floor(Math.random() * 3);
      const particles = Array.from({ length: particleCount }, () => ({
        progress: Math.random(),
        speed: 0.005 + Math.random() * 0.005,
      }));

      return {
        id: i,
        startX: relativeCenterX,
        startY: relativeCenterY,
        endX,
        endY,
        particles,
      };
    });

    setLines(newLines);

    const animate = () => {
      setLines((prevLines) =>
        prevLines.map((line) => ({
          ...line,
          particles: line.particles.map((particle) => ({
            ...particle,
            progress: (particle.progress + particle.speed) % 1,
          })),
        }))
      );
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [centerX, centerY, containerRef]);

  if (!containerRef.current) return null;

  const containerRect = containerRef.current.getBoundingClientRect();

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 pointer-events-none"
      width={containerRect.width}
      height={containerRect.height}
    >
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {lines.map((line) => (
        <g key={line.id}>
          {/* Connection line */}
          <motion.line
            x1={line.startX}
            y1={line.startY}
            x2={line.endX}
            y2={line.endY}
            stroke="rgba(37, 99, 235, 0.2)"
            strokeWidth="1"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
          />

          {/* Particles flowing along line */}
          {line.particles.map((particle, pIdx) => {
            const x = line.startX + (line.endX - line.startX) * particle.progress;
            const y = line.startY + (line.endY - line.startY) * particle.progress;
            const trailOpacity = 1 - (particle.progress % 0.2) * 5;

            return (
              <g key={pIdx}>
                {/* Glow trail */}
                <circle
                  cx={x}
                  cy={y}
                  r="8"
                  fill="rgba(37, 99, 235, 0.1)"
                  opacity={trailOpacity}
                  filter="url(#glow)"
                />
                {/* Particle */}
                <motion.circle
                  cx={x}
                  cy={y}
                  r="3"
                  fill="rgba(37, 99, 235, 0.8)"
                  filter="url(#glow)"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.6, 1, 0.6],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
};

export default ConnectionLines;

