import { serve } from '../shared/aws-shim';
import { serve } from 'https://deno.land/std@0.168.0/http/server';
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

// Simple in-memory rate limiter (resets on function cold start)
const rateLimitStore = new Map<string, { count: number; start: number }>();
const RATE_LIMIT = 10; // requests per minute per IP
const RATE_WINDOW = 60000; // 1 minute in ms

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

// SECURITY: Anonymize IP address (remove last octet for IPv4, last 80 bits for IPv6)
function anonymizeIp(ip: string | null): string | null {
  if (!ip) return null;
  
  // IPv4: Replace last octet with 0
  if (ip.includes('.') && !ip.includes(':')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
    }
  }
  
  // IPv6: Replace last 5 groups with zeros (keeps first 3 groups = /48)
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length >= 3) {
      return `${parts.slice(0, 3).join(':')}::`;
    }
  }
  
  return null; // Return null for malformed IPs
}

// SECURITY: Rate limiting check
function checkRateLimit(ip: string | null): { allowed: boolean; remaining: number } {
  if (!ip) return { allowed: true, remaining: RATE_LIMIT }; // Allow if no IP detected
  
  const now = Date.now();
  const record = rateLimitStore.get(ip);
  
  if (!record || now - record.start > RATE_WINDOW) {
    // New window
    rateLimitStore.set(ip, { count: 1, start: now });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }
  
  if (record.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }
  
  record.count++;
  return { allowed: true, remaining: RATE_LIMIT - record.count };
}

// SECURITY: Validate and sanitize input
function validateVisitorData(data: unknown): { valid: boolean; error?: string; data?: VisitorData } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const d = data as Record<string, unknown>;
  
  // session_id is required and must be a non-empty string
  if (!d.session_id || typeof d.session_id !== 'string' || d.session_id.length < 1) {
    return { valid: false, error: 'Invalid or missing session_id' };
  }
  
  // session_id should be a reasonable length (UUID-like)
  if (d.session_id.length > 100) {
    return { valid: false, error: 'session_id too long' };
  }

  // landing_page is required
  if (!d.landing_page || typeof d.landing_page !== 'string') {
    return { valid: false, error: 'Invalid or missing landing_page' };
  }
  
  // Limit string lengths to prevent abuse
  const maxLengths: Record<string, number> = {
    session_id: 100,
    user_id: 100,
    landing_page: 500,
    referrer: 1000,
    user_agent: 500,
    language: 20,
    screen_resolution: 20,
    timezone: 50,
  };

  for (const [key, maxLen] of Object.entries(maxLengths)) {
    if (d[key] && typeof d[key] === 'string' && (d[key] as string).length > maxLen) {
      return { valid: false, error: `${key} exceeds maximum length of ${maxLen}` };
    }
  }

  return {
    valid: true,
    data: {
      session_id: d.session_id as string,
      user_id: typeof d.user_id === 'string' ? d.user_id : null,
      landing_page: d.landing_page as string,
      referrer: typeof d.referrer === 'string' ? d.referrer : null,
      user_agent: typeof d.user_agent === 'string' ? d.user_agent : undefined,
      language: typeof d.language === 'string' ? d.language : null,
      screen_resolution: typeof d.screen_resolution === 'string' ? d.screen_resolution : undefined,
      timezone: typeof d.timezone === 'string' ? d.timezone : undefined,
      cookie_consent: d.cookie_consent === true,
      consent_timestamp: typeof d.consent_timestamp === 'string' ? d.consent_timestamp : new Date().toISOString(),
    }
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Get and check rate limit
    const rawIp = getIpAddress(req);
    const rateLimitResult = checkRateLimit(rawIp);
    
    if (!rateLimitResult.allowed) {
      console.warn(`Rate limit exceeded for IP: ${anonymizeIp(rawIp)}`);
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
        {
          status: 429,
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Retry-After": "60"
          },
        }
      );
    }

    // Parse and validate input
    let rawData: unknown;
    try {
      rawData = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validation = validateVisitorData(rawData);
    if (!validation.valid || !validation.data) {
      console.warn(`Invalid visitor data: ${validation.error}`);
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const visitorData = validation.data;

    // Get Supabase client
    const supabaseUrl = process.env["SUPABASE_URL"] ?? "";
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // SECURITY: Anonymize IP address before storing
    const anonymizedIp = anonymizeIp(rawIp);

    // Parse user agent
    const userAgent = visitorData.user_agent || req.headers.get("user-agent") || "";
    const { browser, os, device_type } = parseUserAgent(userAgent);

    // Prepare data for insertion
    const trackingData = {
      session_id: visitorData.session_id,
      user_id: visitorData.user_id || null,
      ip_address: anonymizedIp, // SECURITY: Store anonymized IP
      user_agent: userAgent.substring(0, 500), // Limit user agent length
      referrer: visitorData.referrer?.substring(0, 1000) || null,
      landing_page: visitorData.landing_page.substring(0, 500),
      browser,
      os,
      device_type,
      screen_resolution: visitorData.screen_resolution?.substring(0, 20) || null,
      language: visitorData.language?.substring(0, 20) || null,
      timezone: visitorData.timezone?.substring(0, 50) || null,
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
