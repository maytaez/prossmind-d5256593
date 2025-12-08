import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { generateFingerprint } from '@/utils/browser-fingerprint';

const VisitorTracker = () => {
  const location = useLocation();

  useEffect(() => {
    const trackPageVisit = async () => {
      try {
        // Generate unique browser fingerprint
        const fingerprint = await generateFingerprint();
        
        // Get or create session ID
        let sessionId = sessionStorage.getItem('visitor_session_id');
        if (!sessionId) {
          sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          sessionStorage.setItem('visitor_session_id', sessionId);
        }

        // Parse user agent for device and browser info
        const userAgent = navigator.userAgent;
        const deviceType = getDeviceType(userAgent);
        const browser = getBrowser(userAgent);
        const os = getOS(userAgent);

        // Get referrer
        const referrer = document.referrer || null;
        
        // Get timezone-based country estimation
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const estimatedCountry = getCountryFromTimezone(timezone);

        // Check if this fingerprint already exists for this country
        const { data: existingVisitor } = await supabase
          .from('visitor_tracking')
          .select('id, fingerprint')
          .eq('fingerprint', fingerprint)
          .eq('country', estimatedCountry)
          .limit(1)
          .maybeSingle();

        const isUniqueVisitor = !existingVisitor;

        // Track the page visit
        const { error } = await supabase.from('visitor_tracking').insert({
          page_path: location.pathname,
          user_agent: userAgent,
          referrer: referrer,
          session_id: sessionId,
          device_type: deviceType,
          browser: browser,
          os: os,
          fingerprint: fingerprint,
          is_unique_visitor: isUniqueVisitor,
          country: estimatedCountry,
          city: null,
          ip_address: null,
        });

        if (error) {
          console.error('Error tracking visitor:', error);
        }
      } catch (error) {
        console.error('Error in visitor tracking:', error);
      }
    };

    trackPageVisit();
  }, [location.pathname]);

  return null; // This component doesn't render anything
};

// Get country from timezone (rough estimation)
const getCountryFromTimezone = (timezone: string): string => {
  const tzToCountry: Record<string, string> = {
    'America/New_York': 'US', 'America/Los_Angeles': 'US', 'America/Chicago': 'US',
    'Europe/London': 'UK', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE',
    'Asia/Tokyo': 'JP', 'Asia/Shanghai': 'CN', 'Asia/Kolkata': 'IN',
    'Australia/Sydney': 'AU', 'America/Sao_Paulo': 'BR', 'America/Toronto': 'CA',
    'Asia/Singapore': 'SG', 'Asia/Dubai': 'AE', 'Europe/Moscow': 'RU',
  };
  return tzToCountry[timezone] || timezone.split('/')[0] || 'Unknown';
};

// Helper function to detect device type
const getDeviceType = (userAgent: string): string => {
  if (/mobile/i.test(userAgent)) return 'Mobile';
  if (/tablet|ipad/i.test(userAgent)) return 'Tablet';
  return 'Desktop';
};

// Helper function to detect browser
const getBrowser = (userAgent: string): string => {
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) return 'Chrome';
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Edg')) return 'Edge';
  if (userAgent.includes('Opera') || userAgent.includes('OPR')) return 'Opera';
  return 'Other';
};

// Helper function to detect operating system
const getOS = (userAgent: string): string => {
  if (userAgent.includes('Win')) return 'Windows';
  if (userAgent.includes('Mac')) return 'MacOS';
  if (userAgent.includes('Linux')) return 'Linux';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
  return 'Other';
};

export default VisitorTracker;
