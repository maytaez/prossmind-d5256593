import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

/**
 * PageContainer - Responsive wrapper component for consistent page layouts
 * Provides max-width constraint and responsive padding across all pages
 */
const PageContainer = ({ children, className }: PageContainerProps) => {
  return (
    <div className={cn("max-w-[1200px] mx-auto p-4 md:p-8", className)}>
      {children}
    </div>
  );
};

export default PageContainer;

