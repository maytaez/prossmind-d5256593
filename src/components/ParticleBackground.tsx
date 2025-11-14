import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/context/ThemeContext";

/**
 * ParticleBackground - Animated particle effect for hero section
 * Lazy-loaded and feature-flagged for performance
 * Enhanced with mouse tracking, depth layering, collision detection, edge gravity, and color variation
 */
const ParticleBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const prefersReducedMotion = useReducedMotion();
  const mousePosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (prefersReducedMotion || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Mouse tracking
    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Particle system with depth layers
    type Particle = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      opacity: number;
      rotation: number;
      rotationSpeed: number;
      trail: Array<{ x: number; y: number; opacity: number }>;
      layer: number; // 0 = close, 1 = medium, 2 = far
      baseHue: number; // HSL hue value
      collisionRadius: number;
    };

    const particles: Particle[] = [];

    // Fixed particle count: 15-20 particles distributed across 3 layers
    const particleCount = 15 + Math.floor(Math.random() * 6); // 15-20 particles

    // Initialize particles with depth layers
    for (let i = 0; i < particleCount; i++) {
      const layer = Math.floor((i / particleCount) * 3); // Distribute across 3 layers
      const baseHue = 219 + (layer * 20); // Blue to cyan to purple variation
      
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3 * (1 - layer * 0.3), // Slower for far layers
        vy: -(Math.random() * 0.5 + 0.3) * (1 - layer * 0.3), // Slower for far layers
        radius: (Math.random() * 2 + 1.5) * (1 - layer * 0.2), // Smaller for far layers
        opacity: (Math.random() * 0.4 + 0.3) * (1 - layer * 0.3), // More transparent for far layers
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.02 * (1 - layer * 0.3),
        trail: [],
        layer,
        baseHue,
        collisionRadius: (Math.random() * 2 + 1.5) * 2, // Detection radius for collisions
      });
    }

    // Collision detection helper
    const checkCollision = (p1: Particle, p2: Particle): boolean => {
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance < (p1.collisionRadius + p2.collisionRadius);
    };

    // Edge gravity helper - slows particles near edges
    const applyEdgeGravity = (particle: Particle) => {
      const edgeThreshold = 100;
      const gravityStrength = 0.02;
      
      // Left edge
      if (particle.x < edgeThreshold) {
        particle.vx += gravityStrength * (1 - particle.x / edgeThreshold);
      }
      // Right edge
      if (particle.x > canvas.width - edgeThreshold) {
        particle.vx -= gravityStrength * (1 - (canvas.width - particle.x) / edgeThreshold);
      }
      // Top edge
      if (particle.y < edgeThreshold) {
        particle.vy += gravityStrength * (1 - particle.y / edgeThreshold);
      }
      // Bottom edge
      if (particle.y > canvas.height - edgeThreshold) {
        particle.vy -= gravityStrength * (1 - (canvas.height - particle.y) / edgeThreshold);
      }
    };

    // Mouse attraction - particles move slightly toward cursor
    const applyMouseAttraction = (particle: Particle) => {
      const mouse = mousePosRef.current;
      const dx = mouse.x - particle.x;
      const dy = mouse.y - particle.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxDistance = 300;
      const attractionStrength = 0.0005 * (1 - particle.layer * 0.3); // Stronger for closer layers
      
      if (distance < maxDistance && distance > 0) {
        const force = (1 - distance / maxDistance) * attractionStrength;
        particle.vx += (dx / distance) * force;
        particle.vy += (dy / distance) * force;
      }
    };

    // Animation loop
    const animate = () => {
      // Clear with slight fade for trail effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update particles
      particles.forEach((particle, i) => {
        // Apply mouse attraction
        applyMouseAttraction(particle);
        
        // Apply edge gravity
        applyEdgeGravity(particle);
        
        // Check collisions with other particles
        particles.slice(i + 1).forEach((otherParticle) => {
          if (checkCollision(particle, otherParticle)) {
            // Simple collision response - swap velocities with some damping
            const tempVx = particle.vx;
            const tempVy = particle.vy;
            const damping = 0.8;
            
            particle.vx = otherParticle.vx * damping;
            particle.vy = otherParticle.vy * damping;
            otherParticle.vx = tempVx * damping;
            otherParticle.vy = tempVy * damping;
          }
        });
        
        // Update position based on layer speed
        const layerSpeed = 1 - particle.layer * 0.3; // Far layers move slower
        particle.x += particle.vx * layerSpeed;
        particle.y += particle.vy * layerSpeed;
        particle.rotation += particle.rotationSpeed;

        // Wrap around edges with smooth transition
        if (particle.x < -particle.radius) particle.x = canvas.width + particle.radius;
        if (particle.x > canvas.width + particle.radius) particle.x = -particle.radius;
        if (particle.y < -particle.radius) particle.y = canvas.height + particle.radius;
        if (particle.y > canvas.height + particle.radius) particle.y = -particle.radius;

        // Update trail
        particle.trail.push({ x: particle.x, y: particle.y, opacity: particle.opacity });
        if (particle.trail.length > 5) {
          particle.trail.shift();
        }

        // Color variation based on position and layer
        const hueVariation = (particle.x / canvas.width) * 60; // 0-60 degree hue shift
        const currentHue = (particle.baseHue + hueVariation) % 360;
        const saturation = 70 + particle.layer * 10; // More saturated for closer layers
        const lightness = 50 - particle.layer * 5; // Brighter for closer layers

        // Draw trail (glow effect) with color variation
        if (particle.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(particle.trail[0].x, particle.trail[0].y);
          for (let i = 1; i < particle.trail.length; i++) {
            const trailPoint = particle.trail[i];
            const trailOpacity = (trailPoint.opacity * (i / particle.trail.length)) * 0.3;
            ctx.lineTo(trailPoint.x, trailPoint.y);
            ctx.strokeStyle = `hsla(${currentHue}, ${saturation}%, ${lightness}%, ${trailOpacity})`;
            ctx.lineWidth = 2 * (1 - particle.layer * 0.2);
            ctx.stroke();
          }
        }

        // Draw particle with rotation and color variation
        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rotation);
        
        // Bloom effect - outer glow layer
        ctx.filter = 'blur(20px) brightness(1.2)';
        const bloomGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, particle.radius * 4);
        bloomGradient.addColorStop(0, `hsla(${currentHue}, ${saturation}%, ${lightness}%, ${particle.opacity * 0.4})`);
        bloomGradient.addColorStop(0.5, `hsla(${currentHue}, ${saturation}%, ${lightness}%, ${particle.opacity * 0.2})`);
        bloomGradient.addColorStop(1, `hsla(${currentHue}, ${saturation}%, ${lightness}%, 0)`);
        
        ctx.beginPath();
        ctx.arc(0, 0, particle.radius * 3, 0, Math.PI * 2);
        ctx.fillStyle = bloomGradient;
        ctx.fill();
        
        // Reset filter for main glow
        ctx.filter = 'blur(8px) brightness(1.1)';
        
        // Glow effect with color variation
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, particle.radius * 2);
        gradient.addColorStop(0, `hsla(${currentHue}, ${saturation}%, ${lightness}%, ${particle.opacity})`);
        gradient.addColorStop(0.5, `hsla(${currentHue}, ${saturation}%, ${lightness}%, ${particle.opacity * 0.5})`);
        gradient.addColorStop(1, `hsla(${currentHue}, ${saturation}%, ${lightness}%, 0)`);
        
        ctx.beginPath();
        ctx.arc(0, 0, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Reset filter for core particle
        ctx.filter = 'none';
        
        // Core particle with color variation
        ctx.beginPath();
        ctx.arc(0, 0, particle.radius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${currentHue}, ${saturation}%, ${lightness}%, ${particle.opacity})`;
        ctx.fill();
        
        ctx.restore();
      });

      // Draw connection lines between nearby particles (only for same or adjacent layers)
      particles.forEach((particle, i) => {
        particles.slice(i + 1).forEach((otherParticle) => {
          const layerDiff = Math.abs(particle.layer - otherParticle.layer);
          if (layerDiff <= 1) { // Only connect particles in same or adjacent layers
            const dx = particle.x - otherParticle.x;
            const dy = particle.y - otherParticle.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const maxDistance = 150 * (1 - Math.max(particle.layer, otherParticle.layer) * 0.2);
            
            if (distance < maxDistance) {
              const opacity = (1 - distance / maxDistance) * 0.2 * (1 - layerDiff * 0.3);
              const avgHue = ((particle.baseHue + otherParticle.baseHue) / 2) % 360;
              ctx.beginPath();
              ctx.moveTo(particle.x, particle.y);
              ctx.lineTo(otherParticle.x, otherParticle.y);
              ctx.strokeStyle = `hsla(${avgHue}, 70%, 50%, ${opacity})`;
              ctx.lineWidth = 1 * (1 - Math.max(particle.layer, otherParticle.layer) * 0.2);
              ctx.stroke();
            }
          }
        });
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", handleMouseMove);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [prefersReducedMotion]);

  if (prefersReducedMotion) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 opacity-30"
        style={{
          filter: 'blur(0.5px)',
        }}
        aria-hidden="true"
      />
      {/* Atmospheric backdrop glow layer */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(100, 180, 255, 0.15) 0%, transparent 70%)',
          backdropFilter: 'blur(40px)',
          mixBlendMode: 'screen',
        }}
        aria-hidden="true"
      />
    </div>
  );
};

export default ParticleBackground;


