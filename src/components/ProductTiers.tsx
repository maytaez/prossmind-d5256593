import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X } from "lucide-react";
import { motion } from "framer-motion";
import { useScrollReveal, staggerContainerVariants, staggerItemVariants } from "@/hooks/useScrollReveal";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const products = [
  {
    name: "ProssMind Light",
    description: "Perfect for individuals and small teams",
    features: [
      { name: "Basic automation features", included: true },
      { name: "Up to 5 processes", included: true },
      { name: "Community support", included: true },
      { name: "Basic analytics", included: true },
      { name: "Vision automation", included: false },
      { name: "Priority support", included: false },
      { name: "Custom integrations", included: false },
      { name: "Custom AI models", included: false },
    ],
  },
  {
    name: "ProssMind Vision",
    description: "Advanced features for growing businesses",
    features: [
      { name: "Basic automation features", included: true },
      { name: "Unlimited processes", included: true },
      { name: "Vision automation", included: true },
      { name: "Priority support", included: true },
      { name: "Advanced analytics", included: true },
      { name: "Custom integrations", included: true },
      { name: "Custom AI models", included: false },
      { name: "On-premise deployment", included: false },
    ],
    popular: true,
  },
  {
    name: "Custom Models",
    description: "Enterprise-grade solution",
    features: [
      { name: "All Vision features", included: true },
      { name: "Custom AI models", included: true },
      { name: "Dedicated support", included: true },
      { name: "On-premise deployment", included: true },
      { name: "SLA guarantee", included: true },
      { name: "Training & consulting", included: true },
    ],
  },
];

const ProductTiers = () => {
  const { ref, isInView } = useScrollReveal({ threshold: 0.1 });
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.section 
      className="py-24 bg-background relative"
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={prefersReducedMotion ? {} : { duration: 0.7 }}
    >
      <div className="container mx-auto px-6">
        <motion.div 
          className="mb-16"
          initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 30, scale: 0.95 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={prefersReducedMotion ? {} : { duration: 0.6, delay: 0.2 }}
        >
          <div className="max-w-3xl">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Choose Your Plan
            </h2>
            <p className="text-lg text-muted-foreground">
              Select the perfect plan for your business needs
            </p>
          </div>
        </motion.div>

        <motion.div 
          ref={ref}
          className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto"
          variants={staggerContainerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {products.map((product, index) => (
            <motion.div
              key={index}
              variants={staggerItemVariants}
              whileHover={{ 
                y: -8,
                rotateY: product.popular ? 0 : 2,
                rotateX: product.popular ? 0 : 2,
                scale: product.popular ? 1.05 : 1.02,
              }}
              style={{ perspective: 1000 }}
            >
              <Card 
                className={`relative card-hover flex flex-col h-full transition-all ${
                  product.popular 
                    ? "border-primary shadow-2xl bg-gradient-to-b from-card to-primary/5 hover:border-primary/80" 
                    : "border-border bg-card/50 backdrop-blur-sm hover:border-primary/50"
                }`}
                role="article"
                aria-label={`Pricing tier: ${product.name}${product.popular ? ' - Most Popular' : ''}`}
              >
              {product.popular && (
                <motion.div 
                  className="absolute -top-4 left-1/2 -translate-x-1/2 z-10"
                  animate={{ 
                    scale: [1, 1.08, 1],
                    opacity: [0.8, 1, 0.8],
                  }}
                  transition={{ 
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  whileHover={{
                    scale: 1.1,
                  }}
                >
                  <motion.span 
                    className="bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-semibold px-6 py-2 rounded-full shadow-lg block"
                    animate={{
                      boxShadow: [
                        "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 0 20px rgba(37, 99, 235, 0.5)",
                        "0 10px 15px -3px rgba(37, 99, 235, 0.3), 0 0 30px rgba(37, 99, 235, 0.8)",
                        "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 0 20px rgba(37, 99, 235, 0.5)",
                      ],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    Most Popular
                  </motion.span>
                  {/* Occasional pop animation */}
                  <motion.div
                    animate={{
                      scale: [1, 1.15, 1],
                    }}
                    transition={{
                      duration: 0.3,
                      repeat: Infinity,
                      repeatDelay: 5,
                      ease: "easeOut",
                    }}
                    className="absolute inset-0"
                    style={{ pointerEvents: "none" }}
                  />
                </motion.div>
              )}
              
              <CardHeader className="text-center pb-8 pt-8 flex-shrink-0">
                <CardTitle className="text-2xl mb-3 font-bold">{product.name}</CardTitle>
                <CardDescription className="text-base">{product.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="flex flex-col flex-grow space-y-8">
                <ul className="space-y-4 flex-grow">
                  {product.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <div className={`rounded-full p-1 flex-shrink-0 ${
                        feature.included 
                          ? "bg-primary/10" 
                          : "bg-muted"
                      }`}>
                        {feature.included ? (
                          <Check className="h-4 w-4 text-primary" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <span className={`text-sm leading-relaxed ${
                        feature.included ? "" : "text-muted-foreground line-through"
                      }`}>
                        {feature.name}
                      </span>
                    </li>
                  ))}
                </ul>
                
                <Button 
                  className={`w-full text-base py-6 mt-auto hover:scale-[1.03] transition-all ${
                    product.popular 
                      ? "shadow-lg hover:shadow-xl" 
                      : ""
                  }`}
                  variant={product.popular ? "default" : "outline"}
                  size="lg"
                  aria-label={`Get started with ${product.name}`}
                >
                  Get Started
                </Button>
              </CardContent>
            </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
};

export default ProductTiers;
