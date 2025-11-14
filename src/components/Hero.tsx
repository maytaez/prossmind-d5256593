import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import heroMindProcess from "@/assets/hero-mind-process.jpg";
import { useFeatureFlags } from "@/context/FeatureFlagsContext";
import { useReducedMotion } from "@/context/ThemeContext";
import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { useParallax } from "@/hooks/useParallax";

// Lazy load particle effect component
const ParticleBackground = lazy(() => import("@prossmind/shared/components").then(m => ({ default: m.ParticleBackground })).catch(() => ({ default: () => null })));

const Hero = () => {
  const { flags } = useFeatureFlags();
  const prefersReducedMotion = useReducedMotion();
  const [showParticles, setShowParticles] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const scrollToTry = () => {
    const trySection = document.querySelector('[data-section="try-prossmind"]');
    trySection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Lazy load particles only if feature flag is enabled and motion is not reduced
  useEffect(() => {
    if (flags.heavyVisuals && !prefersReducedMotion && flags.gradientBackgrounds) {
      // Delay loading to improve initial page load
      const timer = setTimeout(() => {
        setShowParticles(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [flags.heavyVisuals, flags.gradientBackgrounds, prefersReducedMotion]);

  const shouldShowGradient = flags.gradientBackgrounds && !prefersReducedMotion;
  const shouldShowParticles = showParticles && flags.heavyVisuals && !prefersReducedMotion;
  
  // Parallax offsets for 3-layer system
  const backgroundOffset = useParallax(0.3); // Slowest scroll (background)
  const middleOffset = useParallax(0.6); // Medium scroll (particles)
  const foregroundOffset = useParallax(1.0); // Normal scroll (foreground)

  return (
    <section className="relative min-h-[700px] bg-gradient-to-b from-blue-600 via-blue-800 to-black dark:from-blue-950 dark:via-blue-900 dark:to-black text-hero-foreground dark:text-foreground overflow-hidden pt-16">
      {/* Background layer - slowest parallax (0.3x) */}
      {shouldShowGradient ? (
        <motion.div 
          className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-cyan-500 dark:from-blue-900 dark:via-purple-900 dark:to-cyan-800 animate-gradient-shift opacity-20 dark:opacity-10 blur-[5px]"
          style={{
            transform: `translateY(${backgroundOffset}px)`,
            filter: 'blur(5px) brightness(0.8)',
          }}
        />
      ) : null}
      <motion.div 
        className="absolute inset-0 bg-gradient-to-br from-blue-950 via-blue-900 to-black dark:from-blue-950 dark:via-blue-900 dark:to-black opacity-90 dark:opacity-95"
        style={{
          transform: `translateY(${backgroundOffset}px)`,
        }}
      />
      <motion.div 
        className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.15),transparent_50%)] dark:bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.08),transparent_50%)]"
        style={{
          transform: `translateY(${backgroundOffset}px)`,
          filter: 'blur(3px)',
        }}
      />

      {/* Middle layer - medium parallax (0.6x) - particles */}
      {shouldShowParticles && (
        <motion.div
          style={{
            transform: `translateY(${middleOffset}px)`,
          }}
        >
          <Suspense fallback={null}>
            <ParticleBackground useReducedMotion={useReducedMotion} />
          </Suspense>
        </motion.div>
      )}
      
      {/* Foreground layer - normal scroll (1x) - text/buttons */}
      <motion.div 
        className="container mx-auto px-6 py-16 md:py-24 relative z-10"
        style={{
          transform: `translateY(${foregroundOffset}px)`,
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Column - Text Content */}
          <div className="space-y-8 mb-8 md:mb-0">
            <motion.div 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30 text-sm font-medium mb-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <Sparkles className="h-4 w-4 text-primary" />
              <span>AI-Powered Process Intelligence</span>
            </motion.div>
            
            <h1 className="text-5xl md:text-6xl font-bold leading-tight tracking-tighter">
              <motion.span 
                className="bg-gradient-to-r from-foreground to-foreground/70 dark:from-foreground dark:to-foreground/70 bg-clip-text text-transparent inline-block"
                initial="hidden"
                animate="visible"
              >
                {"ProssMind".split("").map((char, index) => (
                  <motion.span
                    key={index}
                    className="inline-block"
                    variants={{
                      hidden: { opacity: 0, y: 20 },
                      visible: { 
                        opacity: 1, 
                        y: 0,
                        transition: {
                          delay: 0.2 + (index * 0.05),
                          duration: 0.4,
                          ease: "easeOut"
                        }
                      }
                    }}
                  >
                    {char === " " ? "\u00A0" : char}
                  </motion.span>
                ))}
              </motion.span>
            </h1>
            
            <motion.p 
              className="text-xl md:text-2xl text-foreground/80 dark:text-foreground/80 max-w-lg leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              Swiss AI Process Intelligence · GDPR Compliant · Locally Hosted.
            </motion.p>

            <motion.div 
              className="flex flex-col gap-4 pt-4 sm:flex-row sm:gap-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <Button 
                size="lg" 
                className="group text-base px-8 py-6 rounded-full shadow-lg hover:shadow-xl hover:shadow-primary/20 hover:scale-[1.03] active:scale-[0.98] transition-all focus-visible:outline-2 focus-visible:outline-offset-2"
                onClick={scrollToTry}
                aria-label="Try ProssMind for free"
                showRipple
                showArrow
              >
                Try It Free
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="group text-base px-8 py-6 rounded-full bg-gradient-to-r from-gray-800 to-gray-900 dark:from-gray-800 dark:to-gray-900 hover:from-gray-700 hover:to-gray-800 dark:hover:from-gray-700 dark:hover:to-gray-800 border-gray-700 dark:border-gray-600 hover:shadow-[0_0_20px_rgba(100,180,255,0.3)] hover:scale-[1.05] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 transition-all duration-300"
                aria-label="View ProssMind features"
                showArrow
              >
                View Features
              </Button>
            </motion.div>
          </div>

          {/* Right Column - Preview Image */}
          <motion.div 
            className="relative"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <motion.div 
              className="absolute inset-0 bg-primary/20 dark:bg-primary/10 blur-3xl rounded-full"
              animate={!prefersReducedMotion ? {
                scale: [1, 1.05, 1],
                opacity: [0.3, 0.5, 0.3],
              } : {}}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <motion.div 
              className="relative z-10 rounded-2xl overflow-hidden shadow-2xl border border-hero-foreground/10 dark:border-border/50 drop-shadow-[0_0_30px_rgba(100,180,255,0.5)]"
              animate={!prefersReducedMotion ? {
                scale: [1, 1.02, 1],
              } : {}}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <img 
                src={heroMindProcess} 
                alt="Mind and Process Mining Intelligence" 
                className="w-full h-auto"
                loading="eager"
              />
            </motion.div>
            {/* Animated gradient overlay for motion blur effect */}
            {!prefersReducedMotion && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent rounded-2xl pointer-events-none"
                animate={{
                  x: ['-100%', '100%'],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  repeatDelay: 2,
                  ease: "easeInOut",
                }}
              />
            )}
          </motion.div>
        </div>
      </motion.div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent z-20" />
    </section>
  );
};

export default Hero;
