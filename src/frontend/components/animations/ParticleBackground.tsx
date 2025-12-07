import { motion } from "framer-motion";
import { useRef, useEffect } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
}

const ParticleBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Initialize particles (15-20 particles for better performance)
    const particleCount = Math.min(20, Math.max(15, Math.floor((canvas.width * canvas.height) / 20000)));
    particlesRef.current = Array.from({ length: particleCount }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3 - 0.2, // Upward floating motion
      size: Math.random() * 2 + 1,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.02,
      opacity: Math.random() * 0.5 + 0.3,
    }));

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;

      // Update and draw particles
      particles.forEach((particle) => {
        let newX = particle.x + particle.vx;
        let newY = particle.y + particle.vy;

        // Update rotation
        particle.rotation += particle.rotationSpeed;

        // Wrap around edges (with fade in/out effect)
        if (newX < 0) {
          newX = canvas.width;
          particle.opacity = Math.random() * 0.5 + 0.3; // Reset opacity
        }
        if (newX > canvas.width) {
          newX = 0;
          particle.opacity = Math.random() * 0.5 + 0.3;
        }
        if (newY < 0) {
          newY = canvas.height;
          particle.opacity = Math.random() * 0.5 + 0.3;
        }
        if (newY > canvas.height) {
          newY = 0;
          particle.opacity = Math.random() * 0.5 + 0.3;
        }

        particle.x = newX;
        particle.y = newY;

        // Draw particle with rotation
        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rotation);
        ctx.beginPath();
        ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(37, 99, 235, ${particle.opacity})`;
        ctx.fill();
        ctx.restore();
      });

      // Draw connections
      particles.forEach((particle, i) => {
        particles.slice(i + 1).forEach((otherParticle) => {
          const dx = particle.x - otherParticle.x;
          const dy = particle.y - otherParticle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 150) {
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(otherParticle.x, otherParticle.y);
            ctx.strokeStyle = `rgba(37, 99, 235, ${0.1 * (1 - distance / 150)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <motion.canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
    />
  );
};

export default ParticleBackground;

