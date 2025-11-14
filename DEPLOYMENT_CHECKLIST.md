# Subdomain Implementation - Verification Checklist

## ✅ Code Changes Completed

### Modified Files
- [x] `src/utils/subdomain.ts` - Added navigation functions
  - `navigateToBpmn(newTab?: boolean)`
  - `navigateToPid(newTab?: boolean)`  
  - `navigateToMain(newTab?: boolean)`

- [x] `src/components/Hero.tsx` - Added SubdomainSelector
  - Imported SubdomainSelector component
  - Added "Or start with a specific diagram type:" section
  - Positioned below main CTA buttons

- [x] `src/components/TryProssMe.tsx` - Added subdomain awareness
  - Imported `getSubdomain` from utils
  - Auto-initializes diagram type based on subdomain
  - Still maintains backward compatibility

### New Components Created
- [x] `src/components/SubdomainSelector.tsx`
  - BPMN Diagrams button
  - P&ID Diagrams button
  - Optional new tab support
  - Proper TypeScript types
  - Accessible (ARIA labels)

### Documentation Created
- [x] `SUBDOMAIN_SETUP.md` - Complete setup guide (600+ lines)
- [x] `SUBDOMAIN_IMPLEMENTATION.md` - What was implemented
- [x] `SUBDOMAIN_QUICK_REFERENCE.md` - Quick lookup guide
- [x] `SUBDOMAIN_ARCHITECTURE.md` - Visual diagrams
- [x] `README_SUBDOMAINS.md` - Overview & next steps
- [x] `DEPLOYMENT_CHECKLIST.md` - This file

## 🧪 Testing Before Deployment

### Local Testing
- [ ] Clone/pull latest code
- [ ] Run `npm install` (if needed)
- [ ] Run `npm run dev`
- [ ] Test main domain: `http://localhost:8080/`
- [ ] Test BPMN with query param: `http://localhost:8080/?subdomain=bpmn`
- [ ] Test P&ID with query param: `http://localhost:8080/?subdomain=pid`

### Feature Testing
- [ ] Main page shows "Or start with a specific diagram type:"
- [ ] See BPMN Diagrams button
- [ ] See P&ID Diagrams button
- [ ] Click BPMN Diagrams → Navigates with `?subdomain=bpmn`
- [ ] Click P&ID Diagrams → Navigates with `?subdomain=pid`
- [ ] Diagram type is auto-selected correctly
- [ ] Navigation shows subdomain-specific items
- [ ] Mobile menu includes subdomain options
- [ ] Can switch back via navigation

### Browser Compatibility
- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari
- [ ] Mobile browsers

## 🌐 DNS Setup (Required for Production)

### Registrar Information Needed
- [ ] Domain registrar name (GoDaddy, Namecheap, etc.)
- [ ] Domain name (e.g., prossmind.com)
- [ ] Access to DNS management panel

### DNS Records to Add
```
CNAME Record 1:
  Name: bpmn
  Type: CNAME
  Value: prossmind.com

CNAME Record 2:
  Name: pid
  Type: CNAME
  Value: prossmind.com
```

- [ ] CNAME for `bpmn` subdomain created
- [ ] CNAME for `pid` subdomain created
- [ ] DNS changes verified with DNS checker
- [ ] Wait 24-48 hours for propagation

### Alternative: Vercel Setup
If using Vercel:
- [ ] Add domain in Vercel project settings
- [ ] Add `bpmn.yourdomain.com` as domain
- [ ] Add `pid.yourdomain.com` as domain
- [ ] Configure CNAME records per Vercel instructions

## 🔐 SSL/TLS Certificate

- [ ] Wildcard certificate `*.yourdomain.com` OR
- [ ] Multi-domain certificate covering:
  - [ ] yourdomain.com
  - [ ] bpmn.yourdomain.com
  - [ ] pid.yourdomain.com

Note: Most modern hosting providers (Vercel, Netlify) handle this automatically

## 🚀 Deployment Steps

1. [ ] Commit code changes
   ```bash
   git add .
   git commit -m "feat: Add subdomain support for BPMN and P&ID"
   ```

2. [ ] Push to your deployment branch
   ```bash
   git push origin main  # or your deployment branch
   ```

3. [ ] Verify build succeeds
   - [ ] Check deployment logs
   - [ ] No build errors
   - [ ] No runtime errors

4. [ ] Configure DNS (if not already done)
   - [ ] Add CNAME records for bpmn and pid
   - [ ] Verify propagation

5. [ ] Wait for DNS propagation
   - [ ] Use https://dnschecker.org/
   - [ ] Check CNAME records are pointing correctly
   - [ ] Usually 24-48 hours

## ✅ Post-Deployment Verification

### DNS Resolution
- [ ] `nslookup bpmn.yourdomain.com` returns correct IP
- [ ] `nslookup pid.yourdomain.com` returns correct IP
- [ ] `nslookup yourdomain.com` returns correct IP

### HTTPS/SSL
- [ ] `https://yourdomain.com` loads securely (no warnings)
- [ ] `https://bpmn.yourdomain.com` loads securely
- [ ] `https://pid.yourdomain.com` loads securely
- [ ] SSL certificate shows all subdomains

### Application Loading
- [ ] `https://yourdomain.com/` loads main page
- [ ] `https://bpmn.yourdomain.com/` loads BPMN generator
- [ ] `https://pid.yourdomain.com/` loads P&ID generator

### Feature Verification
- [ ] Main page has BPMN/P&ID options
- [ ] BPMN page has BPMN pre-selected
- [ ] P&ID page has P&ID pre-selected
- [ ] Navigation shows correct items per subdomain
- [ ] Can switch between subdomains

### User Flow Testing
1. [ ] Start on main domain
2. [ ] Click "BPMN Diagrams" button
3. [ ] Confirm navigate to bpmn subdomain
4. [ ] Confirm BPMN is pre-selected
5. [ ] Click to switch to P&ID via navigation
6. [ ] Confirm navigate to pid subdomain
7. [ ] Confirm P&ID is pre-selected
8. [ ] Repeat flow in reverse

### Performance Check
- [ ] Page loads quickly (< 3 seconds)
- [ ] No console errors
- [ ] No 404s for resources
- [ ] Network requests complete successfully

## 📱 Mobile Testing

- [ ] Mobile menu opens/closes on all subdomains
- [ ] Subdomain switcher visible in mobile menu
- [ ] Touch targets are at least 48px
- [ ] No horizontal scrolling needed
- [ ] Buttons are easily clickable

## 🐛 Troubleshooting Notes

### If subdomains don't work:

1. Check DNS propagation:
   ```bash
   # macOS/Linux
   nslookup bpmn.yourdomain.com
   
   # Windows
   nslookup bpmn.yourdomain.com
   ```

2. Check SSL certificate:
   - Use https://www.sslchecker.com/
   - Verify it covers all subdomains

3. Check hosting configuration:
   - Ensure all subdomains point to same server/app
   - Check hosting provider's subdomain documentation

4. Check application:
   - Browser console for errors
   - Application logs for issues

## 📚 Documentation Locations

If you need to refer back:
- **Quick start**: `SUBDOMAIN_QUICK_REFERENCE.md`
- **DNS setup**: `SUBDOMAIN_SETUP.md`
- **What was built**: `SUBDOMAIN_IMPLEMENTATION.md`
- **Diagrams**: `SUBDOMAIN_ARCHITECTURE.md`
- **Overview**: `README_SUBDOMAINS.md` (this folder)

## 🎉 Rollback Plan

If something goes wrong:

1. Remove DNS CNAME records for bpmn and pid
2. Reset domain to point only to main domain
3. Revert code changes if needed
4. Users will go back to main domain only

The code is backward compatible, so reverting is safe.

## 📋 Success Criteria

Your subdomain implementation is successful when:

✅ Users can access three separate entry points:
  - `yourdomain.com` - Main landing page
  - `bpmn.yourdomain.com` - BPMN generator
  - `pid.yourdomain.com` - P&ID generator

✅ Each platform shows appropriate UI:
  - Main domain shows both BPMN and P&ID options
  - BPMN domain has BPMN pre-selected
  - P&ID domain has P&ID pre-selected

✅ Navigation works across subdomains:
  - Easy switching between platforms
  - Proper navigation items per subdomain
  - Mobile menu includes switcher

✅ Technical requirements met:
  - All HTTPS connections secure
  - DNS properly configured
  - No errors in console
  - Fast load times

---

**When all checkboxes are marked ✅, your subdomain implementation is complete!**

For questions, refer to the documentation files in the project root.
