import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import heroMindProcess from "@/assets/hero-mind-process.jpg";

const Hero = () => {
  const scrollToTry = () => {
    const trySection = document.querySelector('[data-section="try-prossmind"]');
    trySection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="relative min-h-[700px] bg-gradient-to-b from-gray-50 to-white dark:from-background dark:to-card text-hero-foreground dark:text-foreground overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-hero-bg via-hero-bg to-primary/20 dark:from-background dark:via-card dark:to-primary/10" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.15),transparent_50%)] dark:bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.08),transparent_50%)]" />
      
      <div className="container mx-auto px-6 py-24 md:py-32 relative z-10">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div className="space-y-8 slide-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30 text-sm font-medium mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>AI-Powered Process Intelligence</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold leading-tight tracking-tight">
              <span className="bg-gradient-to-r from-foreground to-foreground/70 dark:from-foreground dark:to-foreground/70 bg-clip-text text-transparent">
                ProssMind
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-foreground/80 dark:text-foreground/80 max-w-lg leading-relaxed">
              Swiss AI Process Intelligence · GDPR Compliant · Locally Hosted.
            </p>

            <div className="flex flex-col gap-8 pt-4 px-8 sm:flex-row sm:px-0 sm:gap-8">
              <Button 
                size="lg" 
                className="group text-base px-8 py-6 shadow-lg hover:shadow-xl hover:scale-[1.03] transition-all focus-visible:outline-2 focus-visible:outline-offset-2"
                onClick={scrollToTry}
                aria-label="Try ProssMind for free"
              >
                Try It Free
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-base px-8 py-6 bg-hero-foreground/5 dark:bg-foreground/5 hover:bg-hero-foreground/10 dark:hover:bg-foreground/10 border-hero-foreground/20 dark:border-border hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 transition-all"
                aria-label="View ProssMind features"
              >
                View Features
              </Button>
            </div>
          </div>

          <div className="relative slide-up stagger-2">
            <div className="absolute inset-0 bg-primary/20 dark:bg-primary/10 blur-3xl rounded-full animate-pulse" />
            <div className="relative z-10 rounded-2xl overflow-hidden shadow-2xl border border-hero-foreground/10 dark:border-border/50">
              <img 
                src={heroMindProcess} 
                alt="Mind and Process Mining Intelligence" 
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};

export default Hero;
