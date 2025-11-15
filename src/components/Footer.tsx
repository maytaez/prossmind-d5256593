import { Shield, MapPin, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useScrollReveal, staggerContainerVariants, staggerItemVariants } from "@/hooks/useScrollReveal";

const Footer = () => {
  const { ref, isInView } = useScrollReveal({ threshold: 0.1 });

  return (
    <footer className="border-t border-border bg-background">
      <div className="container mx-auto px-6 py-12">
        {/* Main Footer Content - 3 Column Layout */}
        <motion.div 
          ref={ref}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8"
          variants={staggerContainerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {/* Product Column */}
          <motion.div variants={staggerItemVariants}>
            <h3 className="font-semibold text-lg mb-4">Product</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/features" className="hover:text-foreground transition-colors relative group">
                  Features
                  <motion.span
                    className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300"
                    whileHover={{ width: "100%" }}
                  />
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="hover:text-foreground transition-colors relative group">
                  Pricing
                  <motion.span
                    className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300"
                    whileHover={{ width: "100%" }}
                  />
                </Link>
              </li>
              <li>
                <Link to="/vision-ai" className="hover:text-foreground transition-colors relative group">
                  Vision AI
                  <motion.span
                    className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300"
                    whileHover={{ width: "100%" }}
                  />
                </Link>
              </li>
            </ul>
          </motion.div>

          {/* Legal Column */}
          <motion.div variants={staggerItemVariants}>
            <h3 className="font-semibold text-lg mb-4">Legal</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/privacy" className="hover:text-foreground transition-colors relative group">
                  Privacy Policy
                  <motion.span
                    className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300"
                    whileHover={{ width: "100%" }}
                  />
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-foreground transition-colors relative group">
                  Terms of Service
                  <motion.span
                    className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300"
                    whileHover={{ width: "100%" }}
                  />
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-foreground transition-colors relative group">
                  Contact
                  <motion.span
                    className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300"
                    whileHover={{ width: "100%" }}
                  />
                </Link>
              </li>
            </ul>
          </motion.div>

          {/* Company Column */}
          <motion.div variants={staggerItemVariants}>
            <h3 className="font-semibold text-lg mb-4">Company</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/about" className="hover:text-foreground transition-colors relative group">
                  About Us
                  <motion.span
                    className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300"
                    whileHover={{ width: "100%" }}
                  />
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-foreground transition-colors relative group">
                  Contact Us
                  <motion.span
                    className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300"
                    whileHover={{ width: "100%" }}
                  />
                </Link>
              </li>
            </ul>
          </motion.div>
        </motion.div>

        {/* Compliance Badges */}
        <div className="flex flex-wrap items-center gap-4 justify-center md:justify-start mb-8 pb-8 border-b border-border">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <Shield className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="text-sm font-medium text-foreground">GDPR</span>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="text-sm font-medium text-foreground">Swiss Hosted</span>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-border">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm font-medium text-muted-foreground">SOC 2 pending</span>
          </div>
        </div>

        {/* Copyright */}
        <div className="text-sm text-muted-foreground text-center">
          <p>© {new Date().getFullYear()} ProssMind. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

