import { Bot, Workflow, Eye, Plug, BarChart3, Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { useScrollReveal, staggerContainerVariants, staggerItemVariants } from "@/hooks/useScrollReveal";
import { useReducedMotion, getReducedMotionTransition } from "@/hooks/useReducedMotion";

const features = [
  {
    icon: Workflow,
    title: "Process Generator",
    description: "Design and build automated business processes with powerful AI capabilities.",
  },
  {
    icon: Eye,
    title: "Vision Automation",
    description: "Automate visual tasks with advanced computer vision and image processing.",
  },
  {
    icon: Download,
    title: "BPMN Integration",
    description: "Download BPMN diagrams and integrate with SAP Signavio, Camunda, Flowable, and more.",
  },
];

const FeatureCards = () => {
  const prefersReducedMotion = useReducedMotion();
  const { ref, isInView } = useScrollReveal({ threshold: 0.1 });

  return (
    <motion.section 
      className="py-24 bg-muted/30 relative"
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={getReducedMotionTransition(prefersReducedMotion) || { duration: 0.7 }}
    >
      <div className="container mx-auto px-6">
        <motion.div 
          className="text-center mb-16"
          initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 30, scale: 0.95 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={getReducedMotionTransition(prefersReducedMotion) || { duration: 0.6, delay: 0.2 }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Powerful Features
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need to automate and optimize your business processes
          </p>
        </motion.div>

        <motion.div 
          ref={ref}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
          variants={staggerContainerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={prefersReducedMotion ? undefined : staggerItemVariants}
              whileHover={prefersReducedMotion ? {} : { 
                y: -12,
                rotateY: 2,
                rotateX: 2,
                scale: 1.03,
              }}
              transition={getReducedMotionTransition(prefersReducedMotion) || { duration: 0.3 }}
              style={{ perspective: 1000 }}
            >
              <Card 
                className="card-hover cursor-pointer border-border/50 hover:border-primary bg-card/50 backdrop-blur-sm flex flex-col h-full rounded-2xl shadow-md transition-all p-6 relative overflow-hidden group"
                style={{
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                }}
                role="article"
                aria-label={`Feature: ${feature.title}`}
              >
                {/* Gradient border animation */}
                <motion.div
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    background: "linear-gradient(45deg, hsl(var(--primary)), hsl(var(--accent)))",
                    padding: "1px",
                  }}
                  initial={false}
                >
                  <div className="w-full h-full bg-card/50 backdrop-blur-sm rounded-2xl" />
                </motion.div>

                <CardHeader className="flex-shrink-0 relative z-10">
                  <div className="flex items-center gap-4 mb-4">
                    <motion.div 
                      className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center tech-glow relative"
                      animate={prefersReducedMotion ? { rotate: 0 } : {
                        rotate: [-2, 2, -2],
                      }}
                      transition={getReducedMotionTransition(prefersReducedMotion) || {
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      whileHover={prefersReducedMotion ? {} : { 
                        scale: 1.15,
                        rotate: 15,
                        filter: "brightness(1.3)",
                      }}
                    >
                      <motion.div
                        whileHover={prefersReducedMotion ? {} : { scale: 1.2 }}
                        transition={getReducedMotionTransition(prefersReducedMotion) || { duration: 0.2 }}
                        style={{
                          filter: "drop-shadow(0 0 20px hsl(var(--primary)))",
                        }}
                      >
                        <feature.icon className="h-7 w-7 text-primary" />
                      </motion.div>
                      <motion.div
                        className="absolute inset-0 rounded-xl bg-primary/20 blur-xl"
                        animate={prefersReducedMotion ? { scale: 1, opacity: 0 } : { 
                          scale: [1, 1.3, 1],
                          opacity: [0, 0.8, 0],
                        }}
                        transition={getReducedMotionTransition(prefersReducedMotion) || { 
                          duration: 1.5,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                    </motion.div>
                    <CardTitle className="text-2xl">{feature.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col relative z-10">
                  <CardDescription className="text-base leading-relaxed break-words overflow-visible min-h-0">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
};

export default FeatureCards;
