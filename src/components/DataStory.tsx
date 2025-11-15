import { motion } from "framer-motion";
import { FileText, Brain, Workflow, CheckCircle } from "lucide-react";
import { useReducedMotion, getReducedMotionTransition } from "@/hooks/useReducedMotion";

/**
 * DataStory - 4 step sequence showing file→AI→BPMN pipeline
 */
const DataStory = () => {
  const prefersReducedMotion = useReducedMotion();

  const steps = [
    {
      icon: FileText,
      title: "Upload Your Document",
      description: "Upload images, PDFs, Word documents, or text files describing your process.",
      color: "text-blue-500",
      glowColor: "blue",
    },
    {
      icon: Brain,
      title: "AI Analysis",
      description: "Our AI analyzes your document and extracts process information using advanced NLP.",
      color: "text-purple-500",
      glowColor: "purple",
    },
    {
      icon: Workflow,
      title: "BPMN Generation",
      description: "The AI generates a complete BPMN diagram with tasks, gateways, and flows.",
      color: "text-green-500",
      glowColor: "green",
    },
    {
      icon: CheckCircle,
      title: "Ready to Use",
      description: "Download your BPMN diagram or integrate directly with your workflow tools.",
      color: "text-primary",
      glowColor: "primary",
    },
  ];

  const getGlowClass = (glowColor: string) => {
    switch (glowColor) {
      case "blue":
        return "hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] hover:shadow-blue-500/50";
      case "purple":
        return "hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] hover:shadow-purple-500/50";
      case "green":
        return "hover:shadow-[0_0_20px_rgba(34,197,94,0.5)] hover:shadow-green-500/50";
      case "primary":
        return "hover:shadow-[0_0_20px_hsl(var(--primary))] hover:shadow-primary/50";
      default:
        return "hover:shadow-[0_0_20px_rgba(59,130,246,0.5)]";
    }
  };

  return (
    <section className="py-24 bg-background relative overflow-hidden">
      <div className="container mx-auto px-6">
        <motion.div
          className="text-center mb-16"
          initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={getReducedMotionTransition(prefersReducedMotion) || { duration: 0.6 }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            How It Works
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            From document to diagram in seconds
          </p>
        </motion.div>

        <div className="max-w-4xl mx-auto">
          {/* Steps */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => {
              const Icon = step.icon;

              return (
                <motion.div
                  key={index}
                  className={`text-center space-y-4 p-6 rounded-2xl transition-all duration-300 cursor-pointer ${getGlowClass(step.glowColor)}`}
                  initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                  whileInView={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={getReducedMotionTransition(prefersReducedMotion) || {
                    duration: 0.6,
                    delay: index * 0.1,
                  }}
                  whileHover={prefersReducedMotion ? {} : { scale: 1.05, y: -5 }}
                >
                  <motion.div
                    className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center transition-all duration-300"
                    aria-hidden="true"
                  >
                    <Icon className={`h-8 w-8 ${step.color} transition-all duration-300`} aria-hidden="true" />
                  </motion.div>
                  <h3 className="text-xl font-semibold">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default DataStory;

