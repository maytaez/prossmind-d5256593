# Subdomain Configuration Guide

This guide explains how to set up and configure subdomains for ProssMind to enable separate platforms for BPMN and P&ID diagram generation.

## Overview

ProssMind supports three main domain configurations:

1. **Main Domain** (e.g., `prossmind.com`) - Landing page with options to choose BPMN or P&ID
2. **BPMN Subdomain** (e.g., `bpmn.prossmind.com`) - Dedicated BPMN diagram generator
3. **P&ID Subdomain** (e.g., `pid.prossmind.com`) - Dedicated P&ID diagram generator

## How It Works

The application automatically detects the current subdomain and:
- Shows appropriate UI for the selected diagram type
- Pre-selects the diagram type in the generator
- Displays subdomain-specific navigation items
- Provides easy switching between BPMN and P&ID platforms (from main domain)

## DNS Configuration

### For Domain Registrars (GoDaddy, Namecheap, etc.)

1. **Log in** to your domain registrar's DNS management panel
2. **Create CNAME records** for each subdomain:

#### Record 1: BPMN Subdomain
```
Type:   CNAME
Name:   bpmn
Value:  yourdomain.com (or your hosting provider's domain)
TTL:    3600 (or default)
```

#### Record 2: P&ID Subdomain
```
Type:   CNAME
Name:   pid
Value:  yourdomain.com (or your hosting provider's domain)
TTL:    3600 (or default)
```

#### Example DNS Records Table
| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | 123.45.67.89 | 3600 |
| CNAME | bpmn | prossmind.com | 3600 |
| CNAME | pid | prossmind.com | 3600 |

### For Vercel Hosting

If you're using Vercel:

1. **In Vercel Dashboard**, go to your project settings
2. **Navigate** to "Domains"
3. **Add each subdomain**:
   - `bpmn.yourdomain.com`
   - `pid.yourdomain.com`
4. **Follow Vercel's instructions** to add the CNAME records to your DNS provider

### For Other Hosting Providers

Consult your hosting provider's documentation. Generally, you'll need to:

1. Create CNAME records pointing subdomains to your main domain or hosting provider's domain
2. Configure the hosting provider to serve the same application for all subdomains
3. Ensure HTTPS certificates cover all subdomains (typically handled automatically with a wildcard certificate)

## SSL/TLS Certificate Setup

### With Let's Encrypt (Automatic)

Most modern hosting providers (Vercel, Netlify, etc.) automatically handle SSL certificates. To ensure your subdomains are covered:

1. Use a **wildcard certificate** pattern: `*.yourdomain.com`
2. This covers all current and future subdomains

### Manual Certificate Setup

If managing certificates manually:

1. Request a **wildcard SSL certificate** for `*.yourdomain.com`
2. Or request a certificate covering:
   - `yourdomain.com`
   - `bpmn.yourdomain.com`
   - `pid.yourdomain.com`

## Local Development Testing

### Using Query Parameters

For local development on `localhost`, use query parameters to simulate subdomains:

```
http://localhost:8080/?subdomain=bpmn   # Test BPMN platform
http://localhost:8080/?subdomain=pid    # Test P&ID platform
http://localhost:8080/                  # Test main platform (no subdomain)
```

### Using Hosts File (Advanced)

To test actual subdomains locally:

1. **Edit your hosts file**:
   - **macOS/Linux**: `/etc/hosts`
   - **Windows**: `C:\Windows\System32\drivers\etc\hosts`

2. **Add entries**:
   ```
   127.0.0.1   localhost
   127.0.0.1   prossmind.local
   127.0.0.1   bpmn.prossmind.local
   127.0.0.1   pid.prossmind.local
   ```

3. **Update Vite config** to serve on `::` (all interfaces):
   ```typescript
   // vite.config.ts already configured
   server: {
     host: "::",
     port: 8080,
   }
   ```

4. **Access via**:
   ```
   http://bpmn.prossmind.local:8080/
   http://pid.prossmind.local:8080/
   http://prossmind.local:8080/
   ```

## Application Code Structure

### Key Files

- **`src/utils/subdomain.ts`** - Subdomain detection and URL generation utility
  - `getSubdomain()` - Detects current subdomain
  - `getSubdomainUrl()` - Generates URLs for specific subdomains
  - `navigateToBpmn()` - Navigates to BPMN subdomain
  - `navigateToPid()` - Navigates to P&ID subdomain

- **`src/components/SubdomainSelector.tsx`** - BPMN/P&ID selector component
  - Used in Hero section for quick access
  - Supports opening in new tab

- **`src/components/Navigation.tsx`** - Main navigation with subdomain switching
  - Shows subdomain switcher on main domain
  - Displays subdomain-specific nav items
  - Desktop and mobile responsive

- **`src/components/TryProssMe.tsx`** - Generator component
  - Auto-selects diagram type based on subdomain
  - Shows appropriate UI for BPMN or P&ID

- **`src/App.tsx`** - Main router configuration
  - Routes based on subdomain

### Environment Variables (if needed)

No additional environment variables are required. The subdomain detection is automatic and works across all environments.

## Troubleshooting

### Subdomains Not Working

**Check 1: DNS Propagation**
- DNS changes can take up to 24-48 hours to propagate
- Use [DNS Checker](https://dnschecker.org/) to verify CNAME records are set correctly

**Check 2: Verify CNAME Records**
```bash
# On macOS/Linux
nslookup bpmn.yourdomain.com

# Should return your hosting provider's IP or domain
```

**Check 3: Hosting Provider Configuration**
- Ensure your hosting provider is configured to serve the application for all subdomains
- Check SSL certificate coverage includes subdomains

### Subdomains Work Locally but Not in Production

**Likely Cause**: DNS not propagated or hosting not configured
- Wait 24-48 hours for DNS propagation
- Contact your hosting provider to ensure wildcard/subdomain support

### User Still on Main Domain When Accessing Subdomain

**Check**:
1. Verify `getSubdomain()` is correctly detecting the subdomain
2. Check browser console for errors
3. Ensure page is fully loaded before checking subdomain

To debug, add this to your browser console:
```javascript
console.log(window.location.hostname);
// Should show: bpmn.yourdomain.com or pid.yourdomain.com
```

## User Experience

### Navigation Flow

1. **User lands on main domain** (`prossmind.com`)
   - Sees Hero section with "Try It Free" button
   - Below that, sees BPMN and P&ID diagram type options
   - Navigation menu shows "BPMN Platform" and "P&ID Platform" links

2. **User clicks BPMN option** → Navigates to `bpmn.prossmind.com`
   - BPMN diagram generator loads with BPMN pre-selected
   - Navigation changes to show BPMN-specific items
   - Can easily switch to P&ID via navigation

3. **User clicks P&ID option** → Navigates to `pid.prossmind.com`
   - P&ID diagram generator loads with P&ID pre-selected
   - Navigation changes to show P&ID-specific items
   - Can easily switch to BPMN via navigation

### Subdomain Switcher

- **Main Domain**: Shows "BPMN Platform" and "P&ID Platform" links in navigation
- **BPMN Domain**: Shows option to switch to P&ID in navigation
- **P&ID Domain**: Shows option to switch to BPMN in navigation

## Advanced Configuration

### Multi-Language Subdomains (Future Enhancement)

If you want to extend this pattern:

```typescript
// Possible future expansion
export type SubdomainType = 'main' | 'bpmn' | 'pid' | 'bpmn-de' | 'bpmn-fr';
```

### Custom Branding per Subdomain

Each subdomain can have custom branding:

```typescript
const getBranding = (subdomain: SubdomainType) => {
  switch (subdomain) {
    case 'bpmn':
      return { color: '#blue', title: 'BPMN Diagram Generator' };
    case 'pid':
      return { color: '#green', title: 'P&ID Diagram Generator' };
    default:
      return { color: '#primary', title: 'ProssMind' };
  }
};
```

## Testing Checklist

- [ ] Main domain loads with both BPMN and P&ID options visible
- [ ] Clicking BPMN option navigates to `bpmn.yourdomain.com`
- [ ] Clicking P&ID option navigates to `pid.yourdomain.com`
- [ ] On BPMN subdomain, diagram type is pre-selected as BPMN
- [ ] On P&ID subdomain, diagram type is pre-selected as P&ID
- [ ] Navigation shows subdomain-specific items
- [ ] Can switch between subdomains via navigation
- [ ] SSL certificate is valid for all subdomains
- [ ] Mobile navigation works on all subdomains
- [ ] Local development works with query parameters

## Support

For issues with subdomain configuration, contact your hosting provider's support team. For application-specific questions, refer to the main README.md.
