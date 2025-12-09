import { motion } from "framer-motion";
import { Factory, Building2, Heart, Server } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useScrollReveal, staggerContainerVariants, staggerItemVariants } from "@/hooks/useScrollReveal";
import { useReducedMotion, getReducedMotionTransition } from "@/hooks/useReducedMotion";

const targetGroups = [
  {
    icon: Factory,
    title: "Manufacturing Operations",
    problems: [
      {
        label: "Invisible Bottlenecks:",
        description: 'Delays in "Order-to-Cash" or production lines',
      },
      {
        label: "Compliance Deviations:",
        description: '"Maverick" behaviors bypassing ISO/Safety standards',
      },
    ],
    color: "text-orange-500",
    bgGradient: "from-orange-500/20 to-orange-500/5",
  },
  {
    icon: Building2,
    title: "Financial Services",
    problems: [
      {
        label: "High Cycle Times:",
        description: "Latency in loan origination and customer onboarding",
      },
      {
        label: "Regulatory Gaps:",
        description: "Inability to prove 100% audit compliance",
      },
    ],
    color: "text-blue-500",
    bgGradient: "from-blue-500/20 to-blue-500/5",
  },
  {
    icon: Heart,
    title: "Healthcare Systems",
    problems: [
      {
        label: "Care Path Variation:",
        description: "Inconsistent patient journeys driving up costs",
      },
      {
        label: "Protocol Non-Adherence:",
        description: "Staff deviating from standard triage or discharge rules",
      },
    ],
    color: "text-red-500",
    bgGradient: "from-red-500/20 to-red-500/5",
  },
  {
    icon: Server,
    title: "IT & DevOps",
    problems: [
      {
        label: "SLA Breaches:",
        description: 'Excessive "ticket requests" between support teams',
      },
      {
        label: "Shadow IT:",
        description: "Changes made to production without formal approvals",
      },
    ],
    color: "text-purple-500",
    bgGradient: "from-purple-500/20 to-purple-500/5",
  },
];

const TargetGroups = () => {
  const prefersReducedMotion = useReducedMotion();
  const { ref, isInView } = useScrollReveal({ threshold: 0.1 });

  return (
    <motion.section
      className="py-24 bg-background relative overflow-hidden"
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={getReducedMotionTransition(prefersReducedMotion) || { duration: 0.5 }}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted/30 to-transparent pointer-events-none" />
      
      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          className="text-center mb-16"
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={getReducedMotionTransition(prefersReducedMotion) || { duration: 0.4 }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Who We Serve
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Empowering industries with AI-driven process intelligence
          </p>
        </motion.div>

        <motion.div
          ref={ref}
          className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto"
          variants={staggerContainerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {targetGroups.map((group, index) => (
            <motion.div
              key={index}
              variants={prefersReducedMotion ? undefined : staggerItemVariants}
              whileHover={prefersReducedMotion ? {} : {
                y: -8,
                scale: 1.02,
              }}
              transition={getReducedMotionTransition(prefersReducedMotion) || { duration: 0.3 }}
            >
              <Card
                className="card-hover cursor-pointer border-border/50 hover:border-primary bg-card/50 backdrop-blur-sm h-full rounded-2xl shadow-md transition-all relative overflow-hidden group"
                style={{
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                }}
                role="article"
                aria-label={`Target Group: ${group.title}`}
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
                      className={`w-16 h-16 rounded-xl bg-gradient-to-br ${group.bgGradient} flex items-center justify-center tech-glow`}
                      whileHover={prefersReducedMotion ? {} : {
                        scale: 1.1,
                      }}
                      transition={{ duration: 0.2 }}
                    >
                      <group.icon className={`h-8 w-8 ${group.color}`} />
                    </motion.div>
                    <CardTitle className="text-2xl">{group.title}</CardTitle>
                  </div>
                </CardHeader>

                <CardContent className="relative z-10 space-y-4">
                  {group.problems.map((problem, pIndex) => (
                    <div key={pIndex} className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        {problem.label}
                      </p>
                      <p className="text-sm text-muted-foreground pl-4 border-l-2 border-primary/30">
                        {problem.description}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
};

export default TargetGroups;
