import { Button } from "@/components/ui/button";
import { AnimatedButton } from "@/components/ui/AnimatedButton";
import { ArrowRight, Sparkles, ChevronRight, Quote } from "lucide-react";
import heroMindProcess from "@/assets/hero-mind-process.jpg";
import { motion, useScroll, useTransform } from "framer-motion";
import ParticleBackground from "@/components/animations/ParticleBackground";
import ConnectionLines from "@/components/animations/ConnectionLines";
import LottieAnimation from "@/components/animations/LottieAnimation";
import { scrollRevealVariants } from "@/hooks/useScrollReveal";
import { useReducedMotion, getReducedMotionTransition } from "@/hooks/useReducedMotion";
import { useRef, useEffect, useState } from "react";
import { navigateToApp } from "@/utils/subdomain";
import { supabase } from "@/integrations/supabase/client";

const testimonials = [
  {
    quote: "What used to take days now takes minutes. The AI-powered BPMN generation is remarkably intuitive and incredibly accurate."
  },
  {
    quote: "Finally, a tool that makes process modeling accessible to everyone. The ease of use and speed are unmatched."
  }
];

const Hero = () => {
  const prefersReducedMotion = useReducedMotion();
  const heroImageRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  const handleTryItFree = () => {
    navigateToApp(user ? '/dashboard' : '/auth');
  };

  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, 100]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);
  
  // Calculate center position for connection lines
  const [centerPos, setCenterPos] = useState({ x: 0, y: 0 });
  
  useEffect(() => {
    if (heroImageRef.current) {
      const rect = heroImageRef.current.getBoundingClientRect();
      setCenterPos({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }
  }, []);

  return (
    <motion.section 
      className="relative min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-background dark:to-card text-hero-foreground dark:text-foreground overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      {/* Particle background */}
      <ParticleBackground />
      
      <div className="container mx-auto px-8 md:px-12 pb-8 md:pb-16 relative z-10">
        <div className="grid md:grid-cols-2 gap-16 items-center min-h-[600px]">
          <motion.div 
            className="space-y-6 md:space-y-8 flex flex-col justify-center"
            initial="hidden"
            animate="visible"
            variants={scrollRevealVariants}
          >
            <motion.div 
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30 text-xs font-medium mb-2"
              style={{ width: 'fit-content' }}
              initial={prefersReducedMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={getReducedMotionTransition(prefersReducedMotion) || { delay: 0.2, duration: 0.5 }}
            >
              <Sparkles className="h-3 w-3 text-primary" />
              <span>AI-Powered Process Intelligence</span>
            </motion.div>
            
            <motion.h1 
              className="text-5xl md:text-7xl font-bold leading-tight tracking-tight"
              initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={getReducedMotionTransition(prefersReducedMotion) || { delay: 0.4, duration: 0.7, ease: "easeOut" }}
            >
              ProssMind
            </motion.h1>
            
            <motion.p 
              className="text-lg md:text-xl text-foreground/80 dark:text-foreground/80 max-w-lg leading-relaxed"
              initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={getReducedMotionTransition(prefersReducedMotion) || { delay: 1.1, duration: 0.6 }}
            >
              Transform complex processes into intelligent workflows with AI-powered automation.
            </motion.p>

            <motion.div 
              className="flex flex-col gap-4 sm:flex-row sm:gap-6 pt-2"
              initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={getReducedMotionTransition(prefersReducedMotion) || { delay: 0.5, duration: 0.6 }}
            >
              <motion.div
                whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                transition={getReducedMotionTransition(prefersReducedMotion) || { duration: 0.2 }}
              >
                <Button 
                  size="lg" 
                  className="group text-base px-8 py-6 shadow-lg hover:shadow-xl transition-all focus-visible:outline-2 focus-visible:outline-offset-2 relative overflow-hidden"
                  onClick={handleTryItFree}
                  aria-label="Try ProssMind for free"
                  style={{
                    background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.9))",
                  }}
                >
                  <motion.span
                    className="flex items-center"
                    whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                  >
                    Try It Free
                    <motion.span
                      className="ml-2"
                      animate={prefersReducedMotion ? { x: 0 } : { x: [0, 4, 0] }}
                      transition={getReducedMotionTransition(prefersReducedMotion) || { duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
                    >
                      <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                    </motion.span>
                  </motion.span>
                </Button>
              </motion.div>
              <motion.div
                whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                transition={getReducedMotionTransition(prefersReducedMotion) || { duration: 0.2 }}
              >
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="group text-base px-8 py-6 bg-hero-foreground/5 dark:bg-foreground/5 hover:bg-primary/5 border-2 border-primary/30 hover:border-primary transition-all focus-visible:outline-2 focus-visible:outline-offset-2 relative"
                  aria-label="View ProssMind features"
                  style={{
                    boxShadow: "0 0 0px rgba(100, 180, 255, 0)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = "0 0 15px rgba(100, 180, 255, 0.5)";
                    e.currentTarget.style.color = "hsl(var(--primary))";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "0 0 0px rgba(100, 180, 255, 0)";
                    e.currentTarget.style.color = "";
                  }}
                >
                  <span className="flex items-center">
                    View Features
                    <motion.span
                      initial={prefersReducedMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -5 }}
                      whileHover={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
                      transition={getReducedMotionTransition(prefersReducedMotion) || { duration: 0.2 }}
                      className="ml-2"
                    >
                      <ChevronRight className="h-5 w-5" aria-hidden="true" />
                    </motion.span>
                  </span>
                </Button>
              </motion.div>
            </motion.div>
          </motion.div>

          <motion.div 
            ref={heroImageRef}
            className="relative"
            initial={prefersReducedMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={getReducedMotionTransition(prefersReducedMotion) || { delay: 0.6, duration: 0.7 }}
          >
            {/* Connection lines with particles */}
            {centerPos.x > 0 && centerPos.y > 0 && (
              <ConnectionLines 
                containerRef={heroImageRef}
                centerX={centerPos.x}
                centerY={centerPos.y}
              />
            )}
            
            <motion.div 
              className="absolute inset-0 bg-primary/20 dark:bg-primary/10 blur-3xl rounded-full glow-effect"
              animate={prefersReducedMotion ? { scale: 1 } : { scale: [1, 1.1, 1] }}
              transition={getReducedMotionTransition(prefersReducedMotion) || { duration: 4, repeat: Infinity }}
            />
            <motion.div 
              className="relative z-10 rounded-2xl overflow-hidden shadow-2xl border border-hero-foreground/10 dark:border-border/50"
              whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
              animate={prefersReducedMotion ? { scale: 1 } : { 
                scale: [1, 1.02, 1],
              }}
              transition={getReducedMotionTransition(prefersReducedMotion) || { 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <LottieAnimation
                src="/animations/brain-flow.json"
                autoplay={true}
                loop={true}
                className="w-full h-auto"
                aria-label="Mind and Process Mining Intelligence animation"
                lazy={true}
                fallback={
                  <img 
                    src={heroMindProcess} 
                    alt="Mind and Process Mining Intelligence" 
                    className="w-full h-auto"
                    loading="lazy"
                  />
                }
              />
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Testimonials Section */}
      <div className="container mx-auto px-8 md:px-12 pb-16 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-3 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Trusted by Industry Leaders
          </h2>
          <p className="text-foreground/70 dark:text-foreground/60 text-lg">
            See what people are saying
          </p>
        </motion.div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.4 + index * 0.15, duration: 0.6 }}
              whileHover={prefersReducedMotion ? {} : { y: -8, scale: 1.02 }}
              className="group relative"
            >
              <div className="relative h-full p-8 rounded-xl bg-gradient-to-br from-card/80 to-card/40 dark:from-card/60 dark:to-card/30 backdrop-blur-sm border border-border/50 dark:border-border/30 shadow-lg hover:shadow-xl transition-all duration-300">
                {/* Quote Icon */}
                <div className="absolute -top-3 -left-3 w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Quote className="h-6 w-6 text-primary-foreground" />
                </div>

                {/* Decorative gradient orb */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 dark:bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/20 dark:group-hover:bg-primary/10 transition-all duration-500" />

                {/* Quote Text */}
                <blockquote className="relative z-10 mt-4">
                  <p className="text-foreground/80 dark:text-foreground/70 leading-relaxed italic text-lg">
                    "{testimonial.quote}"
                  </p>
                </blockquote>

                {/* Hover effect border */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/0 via-primary/0 to-primary/0 group-hover:from-primary/10 group-hover:via-primary/5 group-hover:to-transparent transition-all duration-500 pointer-events-none" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Call to Action Section */}
      <div className="container mx-auto px-8 md:px-12 pb-20 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.8, duration: 0.8 }}
          className="text-center max-w-3xl mx-auto"
        >
          <p className="text-base md:text-lg text-foreground/80 dark:text-foreground/70 leading-relaxed mb-3">
            Join hundreds of organizations transforming their operations with AI-powered process intelligence.
          </p>
          <p className="text-lg md:text-xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
            Start seeing results in weeks, not months.
          </p>
        </motion.div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
    </motion.section>
  );
};

export default Hero;
