import { Component, ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  resetKeys?: unknown[];
  onError?: (error: Error, info: ErrorInfo) => void;
  onReset?: () => void;
  fallback?: ReactNode;
  renderFallback?: (args: { error: Error | null; reset: () => void }) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

const resetKeysChanged = (prev: unknown[] = [], next: unknown[] = []) => {
  if (prev.length !== next.length) return true;
  for (let i = 0; i < prev.length; i += 1) {
    if (!Object.is(prev[i], next[i])) {
      return true;
    }
  }
  return false;
};

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, info);
    this.props.onError?.(error, info);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (
      this.state.hasError &&
      this.props.resetKeys &&
      prevProps.resetKeys &&
      resetKeysChanged(prevProps.resetKeys, this.props.resetKeys)
    ) {
      this.reset();
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.renderFallback) {
        return this.props.renderFallback({
          error: this.state.error,
          reset: this.reset,
        });
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          role="alert"
          className="p-4 border border-destructive/40 rounded-md bg-destructive/5 space-y-2 text-sm"
        >
          <p className="font-semibold text-destructive">Something went wrong.</p>
          <p className="text-muted-foreground">
            {this.state.error?.message || "Unknown error"}
          </p>
          <button
            type="button"
            onClick={this.reset}
            className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium border border-destructive/50 text-destructive hover:bg-destructive/10"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

