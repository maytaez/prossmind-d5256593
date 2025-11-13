import { Shield, Server, Globe } from "lucide-react";

/**
 * TrustStrip - Displays trust signals below the navigation
 * Shows compliance and hosting information to build user confidence
 */
const TrustStrip = () => {
  return (
    <div className="bg-muted/50 dark:bg-muted/30 py-2 text-sm text-muted-foreground text-center border-b border-border/50">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4" aria-hidden="true" />
            <span>Swiss Hosted</span>
          </div>
          <span className="hidden sm:inline">•</span>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" aria-hidden="true" />
            <span>GDPR Compliant</span>
          </div>
          <span className="hidden sm:inline">•</span>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4" aria-hidden="true" />
            <span>SOC 2 Pending</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrustStrip;

