import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { ExpertsData, Expert } from '@/types/experts';
import { Linkedin, Loader2, AlertCircle } from 'lucide-react';

const CLOUDFRONT_URL = 'https://cdn.prossmind.com/config/experts.json';

const ExpertsSection = () => {
  const [expertsData, setExpertsData] = useState<ExpertsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { ref, isInView } = useScrollReveal({ threshold: 0.1 });
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const fetchExperts = async () => {
      try {
        // Try CloudFront first
        let response = await fetch(CLOUDFRONT_URL, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        // If CloudFront fails, fallback to local file for development
        if (!response.ok) {
          console.warn('CloudFront URL failed, falling back to local experts.json');
          response = await fetch('/experts.json', {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
            },
          });
        }

        if (!response.ok) {
          throw new Error(`Failed to fetch experts data: ${response.status}`);
        }

        const data: ExpertsData = await response.json();
        setExpertsData(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching experts data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load experts');
      } finally {
        setIsLoading(false);
      }
    };

    fetchExperts();
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <section className="py-20 md:py-24 bg-background">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Loading experts...</span>
          </div>
        </div>
      </section>
    );
  }

  // Error state
  if (error || !expertsData) {
    return (
      <section className="py-20 md:py-24 bg-background">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <AlertCircle className="h-6 w-6 mr-2" />
            <span>Unable to load experts at this time</span>
          </div>
        </div>
      </section>
    );
  }

  // Filter active experts and sort by priority
  const activeExperts = expertsData.items
    .filter((expert) => expert.active)
    .sort((a, b) => a.priority - b.priority);

  return (
    <motion.section
      className="py-12 md:py-20 bg-background relative overflow-hidden"
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={prefersReducedMotion ? {} : { duration: 0.7 }}
    >
      <div className="container mx-auto px-6 max-w-7xl">
        {/* Section Header */}
        <motion.div
          className="text-center mb-12 md:mb-16"
          initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={prefersReducedMotion ? {} : { duration: 0.6, delay: 0.2 }}
        >
          <h2 className="text-2xl md:text-4xl font-bold mb-3 md:mb-4 text-foreground">
            {expertsData.title}
          </h2>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            {expertsData.subtitle}
          </p>
        </motion.div>

        {/* Experts Grid */}
        <motion.div
          ref={ref}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
        >
          {activeExperts.length > 0 ? (
            activeExperts.map((expert, index) => (
              <ExpertCard
                key={expert.id}
                expert={expert}
                index={index}
                prefersReducedMotion={prefersReducedMotion}
                isInView={isInView}
              />
            ))
          ) : (
            <div className="col-span-full text-center text-muted-foreground">
              No active experts found
            </div>
          )}
        </motion.div>
      </div>
    </motion.section>
  );
};

interface ExpertCardProps {
  expert: Expert;
  index: number;
  prefersReducedMotion: boolean;
  isInView: boolean;
}

const ExpertCard = ({ expert, index, prefersReducedMotion, isInView }: ExpertCardProps) => {
  const [imageError, setImageError] = useState(false);

  return (
    <motion.div
      className="group relative flex items-start gap-4 p-6 rounded-xl bg-card/50 backdrop-blur-sm border border-border hover:border-primary/50 transition-all duration-300"
      initial={{ opacity: 1, y: 0 }}
      animate={
        isInView && !prefersReducedMotion
          ? { opacity: 1, y: 0 }
          : { opacity: 1, y: 0 }
      }
      transition={{
        duration: 0.6,
        delay: index * 0.08,
        ease: [0.2, 0.9, 0.3, 1],
      }}
      whileHover={
        prefersReducedMotion
          ? {}
          : {
              y: -4,
              boxShadow: '0 0 14px rgba(0, 140, 255, 0.15)',
            }
      }
    >
      {/* Profile Photo */}
      <div className="flex-shrink-0">
        <div className="relative w-20 h-20 rounded-full overflow-hidden bg-muted">
          {!imageError ? (
            <img
              src={expert.photoUrl}
              alt={expert.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
              onError={() => setImageError(true)}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary/10">
              <span className="text-2xl font-bold text-primary">
                {expert.name.charAt(0)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Expert Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1">
            <h3 className="text-base font-semibold text-foreground mb-1 line-clamp-2">
              {expert.name}
            </h3>
            <p className="text-sm text-primary font-medium line-clamp-1">
              {expert.title}
            </p>
          </div>
          {expert.linkedInUrl && (
            <a
              href={expert.linkedInUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 p-2 rounded-lg hover:bg-primary/10 transition-colors duration-200"
              aria-label={`Visit ${expert.name}'s LinkedIn profile`}
            >
              <Linkedin className="h-4 w-4 text-primary" />
            </a>
          )}
        </div>
        <p className="text-sm text-muted-foreground line-clamp-3">
          {expert.description}
        </p>
      </div>
    </motion.div>
  );
};

export default ExpertsSection;
