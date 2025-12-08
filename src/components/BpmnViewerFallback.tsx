import { Button } from "@/components/ui/button";

interface Props {
  diagramLabel?: string;
  error?: Error | null;
  onRetry?: () => void;
}

const BpmnViewerFallback = ({ diagramLabel = "diagram", error, onRetry }: Props) => {
  return (
    <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-6 space-y-3">
      <div>
        <p className="font-semibold text-destructive">
          Unable to render the {diagramLabel}.
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          An unexpected error occurred while loading the BPMN canvas. You can
          retry the viewer or reload the page.
        </p>
        {error && (
          <p className="text-xs text-muted-foreground mt-2 break-all">
            {error.message}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onRetry}>
          Try viewer again
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.location.reload()}
        >
          Reload page
        </Button>
      </div>
    </div>
  );
};

export default BpmnViewerFallback;

