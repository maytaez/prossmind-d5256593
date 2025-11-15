import Navigation from "@/components/Navigation";
import { Bot, Workflow, Eye, Zap, Shield, Gauge } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PageContainer from "@/components/layout/PageContainer";
import { motion } from "framer-motion";
import { useReducedMotion, getReducedMotionTransition } from "@/hooks/useReducedMotion";

const featuresDetailed = [
  {
    icon: Bot,
    title: "AI Agent Generator",
    description: "Create intelligent agents that can automate complex workflows and tasks with advanced machine learning capabilities.",
    benefits: ["Natural language processing", "Self-learning algorithms", "Multi-task handling"],
  },
  {
    icon: Workflow,
    title: "Process Generator",
    description: "Design and build automated business processes with powerful AI capabilities and intuitive visual tools. Download BPMN diagrams and integrate seamlessly with SAP Signavio, Camunda, Flowable, and more.",
    benefits: ["Visual process builder", "Real-time monitoring", "Automatic optimization", "Export BPMN diagrams", "Integration with SAP Signavio, Camunda, Flowable"],
  },
  {
    icon: Eye,
    title: "Vision Automation",
    description: "Automate visual tasks with advanced computer vision and image processing powered by state-of-the-art AI.",
    benefits: ["Image recognition", "OCR capabilities", "Video analysis"],
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Process automation that runs at incredible speeds with minimal latency and maximum efficiency.",
    benefits: ["Sub-second response", "Real-time processing", "Edge computing"],
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "Bank-level security with end-to-end encryption, ensuring your data and processes are always protected.",
    benefits: ["256-bit encryption", "SOC 2 compliant", "GDPR ready"],
  },
  {
    icon: Gauge,
    title: "Performance Analytics",
    description: "Deep insights into your automation performance with comprehensive analytics and reporting tools.",
    benefits: ["Real-time dashboards", "Custom reports", "Predictive insights"],
  },
];

const Features = () => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="pt-24 pb-20">
        <PageContainer>
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold mb-4">
              Powerful <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Features</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Everything you need to automate your business processes with cutting-edge AI technology
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {featuresDetailed.map((feature, index) => (
              <motion.div
                key={index}
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
                  className="card-hover cursor-pointer border-border/50 hover:border-primary bg-card/50 backdrop-blur-sm flex flex-col h-full rounded-2xl shadow-md transition-all relative overflow-hidden group"
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
                    <motion.div 
                      className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4 relative"
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
                    <CardTitle className="text-2xl mb-2">{feature.title}</CardTitle>
                    <CardDescription className="text-base mt-2">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col relative z-10">
                    <ul className="space-y-2">
                      {feature.benefits.map((benefit, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </PageContainer>
      </main>
    </div>
  );
};

export default Features;
