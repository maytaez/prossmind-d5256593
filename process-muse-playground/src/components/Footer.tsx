import { Shield, MapPin, CheckCircle2, Github, Twitter, Linkedin } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="border-t border-border/50 bg-background/95 backdrop-blur-sm">
      <div className="container mx-auto px-6 py-12 md:py-16">
        {/* Main Footer Content - 3 Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-8">
          {/* Product Column */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Product</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/features" className="hover:text-foreground transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="hover:text-foreground transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link to="/vision-ai" className="hover:text-foreground transition-colors">
                  Vision AI
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Column */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Legal</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/privacy" className="hover:text-foreground transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-foreground transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-foreground transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Company Column */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Company</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/about" className="hover:text-foreground transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-foreground transition-colors">
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Social Icons */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <a 
            href="https://github.com" 
            target="_blank" 
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <Github className="h-5 w-5" aria-hidden="true" />
          </a>
          <a 
            href="https://twitter.com" 
            target="_blank" 
            rel="noopener noreferrer"
            aria-label="Twitter"
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <Twitter className="h-5 w-5" aria-hidden="true" />
          </a>
          <a 
            href="https://linkedin.com" 
            target="_blank" 
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <Linkedin className="h-5 w-5" aria-hidden="true" />
          </a>
        </div>

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

