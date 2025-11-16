export type SubdomainType = 'main' | 'app' | 'docs' | 'admin' | 'blog' | 'status' | 'api' | 'de' | 'fr' | 'bpmn' | 'pid' | 'partners';

export const getSubdomain = () => {
  // Check for query parameter first (for local development)
  const urlParams = new URLSearchParams(window.location.search);
  const querySubdomain = urlParams.get('subdomain');
  if (querySubdomain) {
    return querySubdomain;
  }

  const host = window.location.host;
  const parts = host.split('.');
  if (parts.length > 2) {
    return parts[0];
  }
  return null;
};

export const getSubdomainType = (): SubdomainType => {
  const subdomain = getSubdomain();
  if (!subdomain) return 'main';
  
  const validSubdomains: SubdomainType[] = ['app', 'docs', 'admin', 'blog', 'status', 'api', 'de', 'fr', 'bpmn', 'pid', 'partners'];
  if (validSubdomains.includes(subdomain as SubdomainType)) {
    return subdomain as SubdomainType;
  }
  return 'main';
};

export const isAppSubdomain = (): boolean => {
  return getSubdomainType() === 'app';
};

export const isLocalhost = (): boolean => {
  const host = window.location.host;
  const hostname = window.location.hostname;
  // Check for localhost, 127.0.0.1, 0.0.0.0, or any .localhost subdomain
  return host.includes('localhost') || 
         host.includes('127.0.0.1') || 
         host.includes('0.0.0.0') ||
         hostname.endsWith('.localhost');
};

const getBaseDomain = (): string => {
  const host = window.location.host;
  const parts = host.split('.');
  if (parts.length > 2) {
    return parts.slice(-2).join('.');
  }
  return host;
};

const buildSubdomainUrl = (subdomain: string, path: string = ''): string => {
  // For localhost, ALWAYS use query parameters (never create subdomain URLs)
  if (isLocalhost()) {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    // Always use the current origin (localhost), never try to create subdomain URLs
    const baseUrl = `${window.location.origin}${cleanPath}`;
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}subdomain=${subdomain}`;
  }
  
  // For production, use actual subdomain
  const protocol = window.location.protocol;
  const baseDomain = getBaseDomain();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${protocol}//${subdomain}.${baseDomain}${cleanPath}`;
};

export const navigateToApp = (path: string = '', newTab: boolean = false) => {
  const url = buildSubdomainUrl('app', path);
  if (newTab) {
    window.open(url, '_blank');
  } else {
    window.location.href = url;
  }
};

export const navigateToBpmn = (newTab: boolean = false) => {
  const url = buildSubdomainUrl('bpmn');
  if (newTab) {
    window.open(url, '_blank');
  } else {
    window.location.href = url;
  }
};

export const navigateToPid = (newTab: boolean = false) => {
  const url = buildSubdomainUrl('pid');
  if (newTab) {
    window.open(url, '_blank');
  } else {
    window.location.href = url;
  }
};

export const getSubdomainUrl = (subdomain: string, path: string = ''): string => {
  return buildSubdomainUrl(subdomain, path);
};

/**
 * Get the current subdomain query parameter to preserve it during navigation
 */
export const getSubdomainQuery = (): string => {
  const subdomain = getSubdomain();
  return subdomain ? `?subdomain=${subdomain}` : '';
};

/**
 * Navigate using React Router while preserving subdomain query parameter
 * Use this instead of navigate() when on a subdomain
 */
export const navigateWithSubdomain = (navigate: (path: string) => void, path: string) => {
  const subdomain = getSubdomain();
  if (subdomain && isLocalhost()) {
    // Preserve subdomain query parameter in localhost
    const separator = path.includes('?') ? '&' : '?';
    navigate(`${path}${separator}subdomain=${subdomain}`);
  } else {
    navigate(path);
  }
};

/**
 * Get the URL to navigate to the main homepage (removes subdomain context)
 */
export const getMainHomeUrl = (): string => {
  if (isLocalhost()) {
    // On localhost, navigate to root without subdomain query parameter
    // Use full origin URL to ensure clean navigation
    return `${window.location.origin}/`;
  }
  // In production, navigate to main domain
  const protocol = window.location.protocol;
  const baseDomain = getBaseDomain();
  return `${protocol}//${baseDomain}/`;
};