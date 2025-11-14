import { useEffect, useState } from "react";

/**
 * TrustStrip - Displays trust signals below the navigation
 * Shows compliance and hosting information to build user confidence
 */
const TrustStrip = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Swiss Flag SVG
  const SwissFlagIcon = () => (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="24" height="24" fill="#FF0000" />
      <rect x="9" y="6" width="6" height="12" fill="#FFFFFF" />
      <rect x="6" y="9" width="12" height="6" fill="#FFFFFF" />
    </svg>
  );

  // GDPR Badge SVG
  const GDPRBadgeIcon = () => (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
      <path
        d="M8 12l2 2 4-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  // SOC 2 Badge SVG
  const SOC2BadgeIcon = () => (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
      <path
        d="M8 12h8M12 8v8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );

  return (
    <div className={`bg-muted/50 dark:bg-muted/30 py-2.5 text-sm text-muted-foreground text-center border-b border-border/50 transition-opacity duration-slow ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-center gap-6 flex-wrap">
          <div
            className="flex items-center gap-2 hover:text-foreground transition-colors duration-normal cursor-default"
            aria-label="Swiss Hosted - Data stored in Switzerland"
          >
            <SwissFlagIcon />
            <span className="font-medium">Swiss Hosted</span>
          </div>
          <span className="hidden sm:inline text-muted-foreground/50">•</span>
          <div
            className="flex items-center gap-2 hover:text-foreground transition-colors duration-normal cursor-default"
            aria-label="GDPR Compliant - European data protection standards"
          >
            <GDPRBadgeIcon />
            <span className="font-medium">GDPR Compliant</span>
          </div>
          <span className="hidden sm:inline text-muted-foreground/50">•</span>
          <div
            className="flex items-center gap-2 hover:text-foreground transition-colors duration-normal cursor-default"
            aria-label="SOC 2 Pending - Security compliance certification in progress"
          >
            <SOC2BadgeIcon />
            <span className="font-medium">SOC 2 Pending</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrustStrip;

