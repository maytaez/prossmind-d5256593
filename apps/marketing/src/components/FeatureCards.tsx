import { Bot, Workflow, Eye, Plug, BarChart3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@prossmind/ui/card";
import { motion } from "framer-motion";
import { useFeatureFlags } from "@/context/FeatureFlagsContext";
import { useReducedMotion } from "@/context/ThemeContext";

const features = [
  {
    icon: Bot,
    title: "AI Agent Generator",
    description: "Create intelligent agents that can automate complex workflows and tasks.",
  },
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
    icon: Plug,
    title: "Smart Integrations",
    description: "Connect with your favorite tools and platforms seamlessly.",
  },
  {
    icon: BarChart3,
    title: "Advanced Analytics",
    description: "Get insights and performance metrics for all your automated processes.",
  },
];

const FeatureCards = () => {
  const { flags } = useFeatureFlags();
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = flags.animations && !prefersReducedMotion;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.95, rotate: -2 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      rotate: 0,
      transition: {
        duration: 0.6,
        ease: [0.34, 1.56, 0.64, 1], // Spring easing for natural feel
      },
    },
  };

  return (
    <section className="py-24 bg-muted/30 relative">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16 slide-up">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Powerful Features
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need to automate and optimize your business processes
          </p>
        </div>

        {shouldAnimate ? (
          <motion.div
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {features.map((feature, index) => (
              <motion.div 
                key={index} 
                variants={itemVariants}
                whileHover={{ y: -15, scale: 1.03 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="relative"
              >
                <Card 
                  className="card-hover-3d cursor-pointer border-border/50 hover:border-primary/80 bg-card/50 backdrop-blur-sm flex flex-col h-full rounded-2xl shadow-md p-6 relative overflow-hidden group"
                  role="article"
                  aria-label={`Feature: ${feature.title}`}
                >
                  {/* Background overlay on hover */}
                  <motion.div
                    className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    initial={false}
                  />
                  
                  <CardHeader className="flex-shrink-0 relative z-10">
                    <motion.div 
                      className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6 tech-glow relative"
                      whileHover={{ scale: 1.2, rotate: 360 }}
                      animate={{
                        rotate: [-2, 2, -2],
                      }}
                      transition={{
                        rotate: {
                          duration: 4,
                          repeat: Infinity,
                          ease: "easeInOut",
                        },
                        scale: { duration: 0.3 },
                      }}
                    >
                      <motion.div
                        animate={{
                          rotate: [-2, 2, -2],
                        }}
                        transition={{
                          duration: 4,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                        className="relative z-10"
                      >
                        <feature.icon 
                          className="h-7 w-7 text-primary relative z-10"
                          style={{
                            filter: 'drop-shadow(0 0 10px rgba(100,180,255,0.8))',
                          }}
                        />
                      </motion.div>
                      {/* Halo effect */}
                      <motion.div
                        className="absolute inset-0 rounded-xl bg-primary/20 blur-xl"
                        animate={{
                          opacity: [0.5, 0.8, 0.5],
                          scale: [1, 1.2, 1],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                    </motion.div>
                    <CardTitle className="text-2xl mb-2 relative z-10">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col relative z-10">
                    <CardDescription className="text-base leading-relaxed break-words overflow-visible min-h-0">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                  
                  {/* Shimmer effect on entrance */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full"
                    initial={{ x: '-100%' }}
                    animate={{ x: '200%' }}
                    transition={{
                      duration: 1.5,
                      delay: index * 0.15 + 0.3,
                      ease: "easeInOut",
                    }}
                  />
                </Card>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className="card-hover cursor-pointer border-border/50 hover:border-primary/60 bg-card/50 backdrop-blur-sm flex flex-col h-full rounded-2xl shadow-md p-6"
                role="article"
                aria-label={`Feature: ${feature.title}`}
              >
                <CardHeader className="flex-shrink-0">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6 tech-glow">
                    <feature.icon className="h-7 w-7 text-primary" />
                  </div>
                  <CardTitle className="text-2xl mb-2">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col">
                  <CardDescription className="text-base leading-relaxed break-words overflow-visible min-h-0">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default FeatureCards;
