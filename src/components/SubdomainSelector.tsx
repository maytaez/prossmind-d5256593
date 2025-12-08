import { Button } from "@/components/ui/button";
import { Workflow, Network } from "lucide-react";
import { navigateToBpmn, navigateToPid } from "@/utils/subdomain";

interface SubdomainSelectorProps {
  showNewTab?: boolean;
  className?: string;
}

const SubdomainSelector = ({ showNewTab = false, className = "" }: SubdomainSelectorProps) => {
  return (
    <div className={`flex flex-col sm:flex-row gap-4 ${className}`}>
      <Button
        onClick={() => navigateToBpmn(showNewTab)}
        className="group flex-1 px-6 py-6 text-base shadow-md hover:shadow-lg hover:scale-[1.02] transition-all focus-visible:outline-2 focus-visible:outline-offset-2"
        aria-label="Open BPMN Diagram Generator in a new tab"
      >
        <Workflow className="mr-2 h-5 w-5" />
        BPMN Diagrams
        {showNewTab && <span className="ml-2 text-xs opacity-75">(New Tab)</span>}
      </Button>
      
      <Button
        onClick={() => navigateToPid(showNewTab)}
        className="group flex-1 px-6 py-6 text-base shadow-md hover:shadow-lg hover:scale-[1.02] transition-all focus-visible:outline-2 focus-visible:outline-offset-2"
        aria-label="Open P&ID Diagram Generator in a new tab"
      >
        <Network className="mr-2 h-5 w-5" />
        P&ID Diagrams
        {showNewTab && <span className="ml-2 text-xs opacity-75">(New Tab)</span>}
      </Button>
    </div>
  );
};

export default SubdomainSelector;
