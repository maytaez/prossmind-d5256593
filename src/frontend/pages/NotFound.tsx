import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="text-center px-6 slide-up">
        <div className="mb-8">
          <h1 className="mb-4 text-8xl md:text-9xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            404
          </h1>
          <div className="h-1 w-24 bg-gradient-to-r from-primary to-accent mx-auto rounded-full"></div>
        </div>
        
        <h2 className="mb-4 text-2xl md:text-3xl font-semibold">Page Not Found</h2>
        <p className="mb-8 text-lg text-muted-foreground max-w-md mx-auto">
          The page you're looking for doesn't exist or has been moved.
        </p>
        
        <a 
          href="/" 
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
