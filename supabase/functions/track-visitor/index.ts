import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VisitorData {
  session_id: string;
  user_id?: string | null;
  landing_page: string;
  referrer?: string | null;
  user_agent?: string;
  language?: string | null;
  screen_resolution?: string;
  timezone?: string;
  cookie_consent: boolean;
  consent_timestamp: string;
}

// Parse user agent to extract browser and OS info
function parseUserAgent(userAgent: string): { browser: string; os: string; device_type: string } {
  let browser = "Unknown";
  let os = "Unknown";
  let deviceType = "Desktop";

  // Detect OS
  if (userAgent.includes("Windows")) os = "Windows";
  else if (userAgent.includes("Mac OS X") || userAgent.includes("macOS")) os = "macOS";
  else if (userAgent.includes("Linux")) os = "Linux";
  else if (userAgent.includes("Android")) {
    os = "Android";
    deviceType = "Mobile";
  } else if (userAgent.includes("iPhone") || userAgent.includes("iPad")) {
    os = "iOS";
    deviceType = userAgent.includes("iPad") ? "Tablet" : "Mobile";
  }

  // Detect Browser
  if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) browser = "Chrome";
  else if (userAgent.includes("Firefox")) browser = "Firefox";
  else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) browser = "Safari";
  else if (userAgent.includes("Edg")) browser = "Edge";
  else if (userAgent.includes("Opera") || userAgent.includes("OPR")) browser = "Opera";

  return { browser, os, device_type: deviceType };
}

// Get IP address from request headers
function getIpAddress(req: Request): string | null {
  // Check various headers for IP address
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  
  return null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const visitorData: VisitorData = await req.json();

    // Get Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get IP address from request
    const ipAddress = getIpAddress(req);

    // Parse user agent
    const userAgent = visitorData.user_agent || req.headers.get("user-agent") || "";
    const { browser, os, device_type } = parseUserAgent(userAgent);

    // Prepare data for insertion
    const trackingData = {
      session_id: visitorData.session_id,
      user_id: visitorData.user_id || null,
      ip_address: ipAddress,
      user_agent: userAgent,
      referrer: visitorData.referrer || null,
      landing_page: visitorData.landing_page,
      browser,
      os,
      device_type,
      screen_resolution: visitorData.screen_resolution || null,
      language: visitorData.language || null,
      timezone: visitorData.timezone || null,
      cookie_consent: visitorData.cookie_consent,
      consent_timestamp: visitorData.consent_timestamp ? new Date(visitorData.consent_timestamp).toISOString() : null,
    };

    // Insert or update visitor tracking data
    // Use upsert to handle cases where the same session visits multiple times
    const { data, error } = await supabase
      .from("visitor_tracking")
      .upsert(
        trackingData,
        {
          onConflict: "session_id",
        }
      )
      .select();

    if (error) {
      console.error("Error inserting visitor tracking:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in track-visitor function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

