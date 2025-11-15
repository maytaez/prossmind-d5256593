import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { motion } from "framer-motion";
import { useScrollReveal, staggerContainerVariants, staggerItemVariants } from "@/hooks/useScrollReveal";

const products = [
  {
    name: "ProssMind Light",
    description: "Perfect for individuals and small teams",
    features: [
      "Basic automation features",
      "Up to 5 processes",
      "Community support",
      "Basic analytics",
    ],
  },
  {
    name: "ProssMind Vision",
    description: "Advanced features for growing businesses",
    features: [
      "All Light features",
      "Unlimited processes",
      "Vision automation",
      "Priority support",
      "Advanced analytics",
      "Custom integrations",
    ],
    popular: true,
  },
  {
    name: "Custom Models",
    description: "Enterprise-grade solution",
    features: [
      "All Vision features",
      "Custom AI models",
      "Dedicated support",
      "On-premise deployment",
      "SLA guarantee",
      "Training & consulting",
    ],
  },
];

const ProductTiers = () => {
  const { ref, isInView } = useScrollReveal({ threshold: 0.1 });

  return (
    <section className="py-24 bg-background relative">
      <div className="container mx-auto px-6">
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Choose Your Plan
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Select the perfect plan for your business needs
          </p>
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
                      <div className="rounded-full bg-primary/10 p-1 flex-shrink-0">
                        <Check className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm leading-relaxed">{feature}</span>
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
    </section>
  );
};

export default ProductTiers;
