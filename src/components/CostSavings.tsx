import { motion } from "framer-motion";
import { DollarSign, TrendingUp, Clock, Users, BarChart3, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useScrollReveal, staggerContainerVariants, staggerItemVariants } from "@/hooks/useScrollReveal";
import { useReducedMotion, getReducedMotionTransition } from "@/hooks/useReducedMotion";

const savings = [
  {
    icon: DollarSign,
    title: "Operational Cost Reduction",
    metric: "25-40%",
    description: "Reduce operational costs by eliminating inefficiencies and automating manual processes.",
    color: "text-green-500",
    bgGradient: "from-green-500/20 to-green-500/5",
  },
  {
    icon: Clock,
    title: "Time Savings",
    metric: "50-70%",
    description: "Cut process cycle times in half through intelligent automation and optimization.",
    color: "text-blue-500",
    bgGradient: "from-blue-500/20 to-blue-500/5",
  },
  {
    icon: Users,
    title: "Resource Optimization",
    metric: "30-45%",
    description: "Free up your team to focus on high-value work instead of repetitive tasks.",
    color: "text-purple-500",
    bgGradient: "from-purple-500/20 to-purple-500/5",
  },
  {
    icon: TrendingUp,
    title: "Productivity Gains",
    metric: "35-60%",
    description: "Boost overall productivity by streamlining workflows and reducing bottlenecks.",
    color: "text-orange-500",
    bgGradient: "from-orange-500/20 to-orange-500/5",
  },
  {
    icon: BarChart3,
    title: "Compliance Improvement",
    metric: "90-100%",
    description: "Achieve near-perfect audit compliance and reduce regulatory risk exposure.",
    color: "text-red-500",
    bgGradient: "from-red-500/20 to-red-500/5",
  },
  {
    icon: Sparkles,
    title: "ROI Timeline",
    metric: "3-6 months",
    description: "See measurable returns on investment within the first quarter of implementation.",
    color: "text-primary",
    bgGradient: "from-primary/20 to-primary/5",
  },
];

const CostSavings = () => {
  const prefersReducedMotion = useReducedMotion();
  const { ref, isInView } = useScrollReveal({ threshold: 0.1 });

  return (
    <motion.section
      className="py-24 bg-background relative overflow-hidden"
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={getReducedMotionTransition(prefersReducedMotion) || { duration: 0.7 }}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent pointer-events-none" />
      <motion.div
        className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl"
        animate={prefersReducedMotion ? { scale: 1, opacity: 0.3 } : {
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={getReducedMotionTransition(prefersReducedMotion) || {
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl"
        animate={prefersReducedMotion ? { scale: 1, opacity: 0.3 } : {
          scale: [1.2, 1, 1.2],
          opacity: [0.5, 0.3, 0.5],
        }}
        transition={getReducedMotionTransition(prefersReducedMotion) || {
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      
      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          className="text-center mb-16"
          initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 30, scale: 0.95 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={getReducedMotionTransition(prefersReducedMotion) || { duration: 0.6, delay: 0.2 }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Measurable Impact
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Real cost savings and efficiency gains our clients achieve with ProssMind
          </p>
        </motion.div>

        <motion.div
          ref={ref}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
          variants={staggerContainerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {savings.map((saving, index) => (
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
                aria-label={`Savings: ${saving.title}`}
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
                  <div className="flex items-center gap-4 mb-4">
                    <motion.div
                      className={`w-14 h-14 rounded-xl bg-gradient-to-br ${saving.bgGradient} flex items-center justify-center tech-glow`}
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
                      <saving.icon className={`h-7 w-7 ${saving.color}`} />
                    </motion.div>
                    <CardTitle className="text-2xl">{saving.title}</CardTitle>
                  </div>
                </CardHeader>

                <CardContent className="relative z-10 space-y-4">
                  <motion.div
                    className="text-center py-4"
                    whileHover={prefersReducedMotion ? {} : { scale: 1.1 }}
                    transition={getReducedMotionTransition(prefersReducedMotion) || { duration: 0.2 }}
                  >
                    <p className={`text-4xl font-bold ${saving.color}`}>
                      {saving.metric}
                    </p>
                  </motion.div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {saving.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
};

export default CostSavings;
