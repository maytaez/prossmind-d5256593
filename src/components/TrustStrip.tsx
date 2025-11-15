import { Shield, Server, Globe } from "lucide-react";
import { motion } from "framer-motion";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * TrustStrip - Displays trust signals below the navigation
 * Shows compliance and hosting information to build user confidence
 */
const TrustStrip = () => {
  const prefersReducedMotion = useReducedMotion();

  const trustBadges = [
    {
      icon: Server,
      label: "Swiss Hosted",
      title: "Swiss Hosted Infrastructure",
      description: "All data is hosted in Switzerland, ensuring maximum privacy and data sovereignty. Our infrastructure complies with Swiss data protection laws.",
      link: "#",
    },
    {
      icon: Shield,
      label: "GDPR Compliant",
      title: "GDPR Compliance",
      description: "We are fully compliant with the General Data Protection Regulation (GDPR). Your data is processed with the highest standards of privacy and security.",
      link: "#",
    },
    {
      icon: Globe,
      label: "SOC 2 Pending",
      title: "SOC 2 Certification",
      description: "We are currently undergoing SOC 2 Type II certification to demonstrate our commitment to security, availability, and confidentiality.",
      link: "#",
    },
  ];

  return (
    <div className="bg-muted/50 dark:bg-muted/30 py-2 text-sm text-muted-foreground text-center border-b border-border/50">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-center gap-6 flex-wrap">
          {trustBadges.map((badge, index) => (
            <Popover key={index}>
              <PopoverTrigger asChild>
                <motion.button
                  className="flex items-center gap-2 hover:text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded px-2 py-1"
                  whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
                  whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
                  aria-label={`Learn more about ${badge.label}`}
                >
                  <badge.icon className="h-4 w-4" aria-hidden="true" />
                  <span>{badge.label}</span>
                </motion.button>
              </PopoverTrigger>
              <PopoverContent className="w-80" side="bottom" align="center">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">{badge.title}</h4>
                  <p className="text-xs text-muted-foreground">{badge.description}</p>
                </div>
              </PopoverContent>
            </Popover>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TrustStrip;

