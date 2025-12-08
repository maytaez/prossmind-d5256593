/**
 * Browser Fingerprinting Utility
 * Creates a unique identifier based on browser/device characteristics
 */

interface FingerprintComponents {
  userAgent: string;
  language: string;
  colorDepth: number;
  screenResolution: string;
  timezone: string;
  sessionStorage: boolean;
  localStorage: boolean;
  indexedDb: boolean;
  platform: string;
  cpuClass: string;
  plugins: string;
  canvas: string;
  webgl: string;
  fonts: string;
}

// Simple hash function
function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// Get canvas fingerprint
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';
    
    canvas.width = 200;
    canvas.height = 50;
    
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(0, 0, 100, 50);
    ctx.fillStyle = '#069';
    ctx.fillText('Fingerprint', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Canvas', 4, 17);
    
    return hashCode(canvas.toDataURL());
  } catch {
    return 'canvas-error';
  }
}

// Get WebGL fingerprint
function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return 'no-webgl';
    
    const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return 'no-debug-info';
    
    const vendor = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
    const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    
    return hashCode(`${vendor}~${renderer}`);
  } catch {
    return 'webgl-error';
  }
}

// Get installed fonts (subset check)
function getFontsFingerprint(): string {
  const testFonts = [
    'Arial', 'Courier New', 'Georgia', 'Times New Roman', 'Verdana',
    'Helvetica', 'Comic Sans MS', 'Impact', 'Lucida Console', 'Tahoma'
  ];
  
  const baseFonts = ['monospace', 'sans-serif', 'serif'];
  const testString = 'mmmmmmmmmmlli';
  const testSize = '72px';
  
  const span = document.createElement('span');
  span.style.fontSize = testSize;
  span.style.position = 'absolute';
  span.style.left = '-9999px';
  span.innerHTML = testString;
  document.body.appendChild(span);
  
  const detected: string[] = [];
  
  for (const font of testFonts) {
    for (const baseFont of baseFonts) {
      span.style.fontFamily = `'${font}', ${baseFont}`;
      const width = span.offsetWidth;
      
      span.style.fontFamily = baseFont;
      const baseWidth = span.offsetWidth;
      
      if (width !== baseWidth) {
        detected.push(font);
        break;
      }
    }
  }
  
  document.body.removeChild(span);
  return hashCode(detected.join(','));
}

// Get plugins fingerprint
function getPluginsFingerprint(): string {
  const plugins: string[] = [];
  for (let i = 0; i < navigator.plugins.length; i++) {
    plugins.push(navigator.plugins[i].name);
  }
  return hashCode(plugins.sort().join(','));
}

/**
 * Generate a unique browser fingerprint
 */
export async function generateFingerprint(): Promise<string> {
  const components: FingerprintComponents = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    colorDepth: screen.colorDepth,
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    sessionStorage: !!window.sessionStorage,
    localStorage: !!window.localStorage,
    indexedDb: !!window.indexedDB,
    platform: navigator.platform || 'unknown',
    cpuClass: (navigator as any).cpuClass || 'unknown',
    plugins: getPluginsFingerprint(),
    canvas: getCanvasFingerprint(),
    webgl: getWebGLFingerprint(),
    fonts: getFontsFingerprint(),
  };
  
  const fingerprintString = Object.values(components).join('|');
  const fingerprint = hashCode(fingerprintString);
  
  // Create a more unique ID by combining with a timestamp-based component
  // stored in localStorage to persist across sessions
  let persistentId = localStorage.getItem('_vid');
  if (!persistentId) {
    persistentId = `${Date.now().toString(36)}${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('_vid', persistentId);
  }
  
  return `${fingerprint}_${hashCode(persistentId)}`;
}

/**
 * Check if this fingerprint has been seen before for a given country
 */
export function isNewVisitorForCountry(fingerprint: string, country: string): boolean {
  const key = `_visited_${country}`;
  const visited = localStorage.getItem(key);
  
  if (visited === fingerprint) {
    return false; // Same visitor from this country
  }
  
  localStorage.setItem(key, fingerprint);
  return true;
}
