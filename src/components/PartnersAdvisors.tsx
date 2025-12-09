import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { PartnersData, Partner } from '@/types/partners';
import { ExternalLink, Loader2, AlertCircle } from 'lucide-react';

const CLOUDFRONT_URL = 'https://cdn.prossmind.com/config/partners.json';

const PartnersAdvisors = () => {
  const [partnersData, setPartnersData] = useState<PartnersData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { ref, isInView } = useScrollReveal({ threshold: 0.1 });
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const fetchPartners = async () => {
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
          console.warn('CloudFront URL failed, falling back to local partners.json');
          response = await fetch('/partners.json', {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
            },
          });
        }

        if (!response.ok) {
          throw new Error(`Failed to fetch partners data: ${response.status}`);
        }

        const data: PartnersData = await response.json();
        setPartnersData(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching partners data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load partners');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPartners();
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <section className="py-20 md:py-24 bg-background">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Loading partners...</span>
          </div>
        </div>
      </section>
    );
  }

  // Error state
  if (error || !partnersData) {
    return (
      <section className="py-20 md:py-24 bg-background">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <AlertCircle className="h-6 w-6 mr-2" />
            <span>Unable to load partners at this time</span>
          </div>
        </div>
      </section>
    );
  }

  // Filter active partners and sort by priority
  const activePartners = partnersData.items
    .filter((partner) => partner.active)
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
          <h2 className="text-2xl md:text-4xl font-bold mb-3 md:mb-4">
            {partnersData.title}
          </h2>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            {partnersData.subtitle}
          </p>
        </motion.div>

        {/* Partners Grid */}
        <motion.div
          ref={ref}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5 md:gap-8"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
        >
          {activePartners.length > 0 ? (
            activePartners.map((partner, index) => (
              <PartnerCard
                key={partner.id}
                partner={partner}
                index={index}
                prefersReducedMotion={prefersReducedMotion}
                isInView={isInView}
              />
            ))
          ) : (
            <div className="col-span-full text-center text-muted-foreground">
              No active partners found
            </div>
          )}
        </motion.div>
      </div>
    </motion.section>
  );
};

interface PartnerCardProps {
  partner: Partner;
  index: number;
  prefersReducedMotion: boolean;
  isInView: boolean;
}

const PartnerCard = ({ partner, index, prefersReducedMotion, isInView }: PartnerCardProps) => {
  const [imageError, setImageError] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  return (
    <motion.div
      className="group relative flex flex-col items-center cursor-pointer"
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
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
    >
      {/* Logo Card Container */}
      <a
        href={partner.websiteUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="relative w-full p-6 md:p-8 rounded-xl bg-white backdrop-blur-sm border border-border hover:border-primary/50 transition-all duration-300 min-h-[120px] flex items-center justify-center"
        style={{
          transform: isPressed ? 'scale(0.97)' : undefined,
          transition: 'transform 0.12s ease',
        }}
        aria-label={`Visit ${partner.name} - ${partner.role}`}
      >
        {/* Logo Container */}
        <div className="relative w-full h-16 overflow-hidden">
          {!imageError ? (
            <img
              src={partner.logoUrl}
              alt={partner.name}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-h-[60px] max-w-full object-contain transition-all duration-300 group-hover:scale-105"
              onError={() => setImageError(true)}
              loading="lazy"
            />
          ) : (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center w-full px-2">
              <p className="text-sm font-semibold text-gray-900">{partner.name}</p>
            </div>
          )}
        </div>

        {/* External Link Icon - Visible on Hover */}
        <motion.div
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
        >
          <ExternalLink className="h-4 w-4 text-primary" />
        </motion.div>
      </a>

      {/* Partner Info - Below the card */}
      <div className="text-center w-full mt-4 px-2">
        <p className="text-sm font-semibold text-foreground mb-1 line-clamp-2">{partner.name}</p>
        <p className="text-xs text-muted-foreground line-clamp-1">{partner.role}</p>
      </div>
    </motion.div>
  );
};

export default PartnersAdvisors;
