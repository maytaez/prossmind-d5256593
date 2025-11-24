import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const CookieConsent = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem("cookieConsent");
    if (!consent) {
      // Show banner after a short delay for better UX
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = async () => {
    setIsLoading(true);
    try {
      // Store consent in localStorage
      localStorage.setItem("cookieConsent", "accepted");
      localStorage.setItem("cookieConsentTimestamp", new Date().toISOString());
      
      // Track the consent in the database
      await trackVisitor(true);
      
      setShowBanner(false);
    } catch (error) {
      console.error("Error saving cookie consent:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecline = async () => {
    setIsLoading(true);
    try {
      // Store consent in localStorage
      localStorage.setItem("cookieConsent", "declined");
      localStorage.setItem("cookieConsentTimestamp", new Date().toISOString());
      
      // Track the consent in the database (even if declined, we track the visit)
      await trackVisitor(false);
      
      setShowBanner(false);
    } catch (error) {
      console.error("Error saving cookie consent:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    // Just close without saving preference (user can accept/decline later)
    setShowBanner(false);
    // Show again after 24 hours
    localStorage.setItem("cookieBannerDismissed", new Date().toISOString());
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pointer-events-none">
      <Card className="max-w-4xl mx-auto shadow-lg pointer-events-auto border-2">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">Cookie Consent</h3>
              <CardDescription className="text-sm">
                We use cookies to enhance your browsing experience, analyze site traffic, and understand where our visitors come from. 
                By clicking "Accept", you consent to our use of cookies for tracking and analytics purposes.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={handleClose}
              disabled={isLoading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
        <CardFooter className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={handleDecline}
            disabled={isLoading}
          >
            Decline
          </Button>
          <Button
            onClick={handleAccept}
            disabled={isLoading}
          >
            {isLoading ? "Saving..." : "Accept"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

// Function to track visitor data
async function trackVisitor(consent: boolean) {
  try {
    // Get or create session ID
    let sessionId = sessionStorage.getItem("visitorSessionId");
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem("visitorSessionId", sessionId);
    }

    // Get current user if logged in
    const { data: { user } } = await supabase.auth.getUser();
    
    // Collect visitor information
    const visitorData = {
      session_id: sessionId,
      user_id: user?.id || null,
      landing_page: window.location.href,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent,
      language: navigator.language || navigator.languages?.[0] || null,
      screen_resolution: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      cookie_consent: consent,
      consent_timestamp: new Date().toISOString(),
    };

    // Call edge function to log visitor data
    const { data, error } = await supabase.functions.invoke("track-visitor", {
      body: visitorData,
    });

    if (error) {
      console.error("Error tracking visitor:", error);
    }
  } catch (error) {
    console.error("Error in trackVisitor:", error);
  }
}

// Export the tracking function for use in other components
export { trackVisitor };

export default CookieConsent;

