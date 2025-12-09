import { motion } from "framer-motion";
import { AlertTriangle, TrendingDown, Clock, Shield, Zap, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useScrollReveal, staggerContainerVariants, staggerItemVariants } from "@/hooks/useScrollReveal";
import { useReducedMotion, getReducedMotionTransition } from "@/hooks/useReducedMotion";

const problems = [
  {
    icon: AlertTriangle,
    title: "Hidden Process Inefficiencies",
    description: "Uncover invisible bottlenecks and delays that drain productivity and increase operational costs.",
    color: "text-yellow-500",
    bgGradient: "from-yellow-500/20 to-yellow-500/5",
    impact: "Up to 30% productivity loss",
  },
  {
    icon: TrendingDown,
    title: "Compliance & Regulatory Risks",
    description: "Identify and eliminate maverick behaviors that bypass critical safety and compliance standards.",
    color: "text-red-500",
    bgGradient: "from-red-500/20 to-red-500/5",
    impact: "Avoid costly penalties",
  },
  {
    icon: Clock,
    title: "Extended Cycle Times",
    description: "Reduce latency in critical processes like loan origination, customer onboarding, and patient care.",
    color: "text-blue-500",
    bgGradient: "from-blue-500/20 to-blue-500/5",
    impact: "50% faster processing",
  },
  {
    icon: Shield,
    title: "Audit Trail Gaps",
    description: "Ensure 100% audit compliance with complete visibility into every process step and decision point.",
    color: "text-green-500",
    bgGradient: "from-green-500/20 to-green-500/5",
    impact: "100% audit readiness",
  },
  {
    icon: Zap,
    title: "Process Variation",
    description: "Standardize inconsistent workflows that lead to quality issues and increased operational costs.",
    color: "text-purple-500",
    bgGradient: "from-purple-500/20 to-purple-500/5",
    impact: "Consistent quality",
  },
  {
    icon: Target,
    title: "Shadow IT & Unauthorized Changes",
    description: "Detect and prevent unauthorized modifications to production systems without proper approvals.",
    color: "text-orange-500",
    bgGradient: "from-orange-500/20 to-orange-500/5",
    impact: "Enhanced security",
  },
];

const ProblemsWeSolve = () => {
  const prefersReducedMotion = useReducedMotion();
  const { ref, isInView } = useScrollReveal({ threshold: 0.1 });

  return (
    <motion.section
      className="py-24 bg-muted/30 relative overflow-hidden"
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={getReducedMotionTransition(prefersReducedMotion) || { duration: 0.7 }}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />
      
      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          className="text-center mb-16"
          initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 30, scale: 0.95 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={getReducedMotionTransition(prefersReducedMotion) || { duration: 0.6, delay: 0.2 }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Problems We Solve
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Transform operational challenges into competitive advantages with AI-powered insights
          </p>
        </motion.div>

        <motion.div
          ref={ref}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
          variants={staggerContainerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {problems.map((problem, index) => (
            <motion.div
              key={index}
              variants={prefersReducedMotion ? undefined : staggerItemVariants}
              whileHover={prefersReducedMotion ? {} : {
                y: -12,
                scale: 1.03,
              }}
              transition={getReducedMotionTransition(prefersReducedMotion) || { duration: 0.3 }}
            >
              <Card
                className="card-hover cursor-pointer border-border/50 hover:border-primary bg-card/50 backdrop-blur-sm h-full rounded-2xl shadow-md transition-all relative overflow-hidden group"
                style={{
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                }}
                role="article"
                aria-label={`Problem: ${problem.title}`}
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

                <CardHeader className="relative z-10">
                  <motion.div
                    className={`w-14 h-14 rounded-xl bg-gradient-to-br ${problem.bgGradient} flex items-center justify-center mb-4 tech-glow`}
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
                    }}
                  >
                    <problem.icon className={`h-7 w-7 ${problem.color}`} />
                  </motion.div>
                  <CardTitle className="text-xl mb-2">{problem.title}</CardTitle>
                </CardHeader>

                <CardContent className="relative z-10 space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {problem.description}
                  </p>
                  <div className="pt-2 border-t border-border/50">
                    <p className={`text-xs font-semibold ${problem.color}`}>
                      {problem.impact}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
};

export default ProblemsWeSolve;
