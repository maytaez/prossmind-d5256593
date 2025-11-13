# Quick Reference: Subdomain Implementation

## What You Get

✅ **Automatic Subdomain Detection**
- `bpmn.yourdomain.com` → BPMN platform
- `pid.yourdomain.com` → P&ID platform  
- `yourdomain.com` → Main landing page

✅ **Auto-Selecting Diagram Type**
- Users on BPMN subdomain see BPMN pre-selected
- Users on P&ID subdomain see P&ID pre-selected

✅ **Easy Navigation Between Platforms**
- Quick switcher buttons in header/mobile menu
- Subdomain-specific navigation items

✅ **Local Testing Support**
- Use query parameters: `?subdomain=bpmn` or `?subdomain=pid`
- No DNS needed for local development

## Files to Know

| File | Purpose |
|------|---------|
| `src/utils/subdomain.ts` | Core subdomain detection logic |
| `src/components/SubdomainSelector.tsx` | BPMN/P&ID selector component |
| `src/components/Hero.tsx` | Hero section with selector |
| `src/components/Navigation.tsx` | Navigation with subdomain switcher |
| `src/components/TryProssMe.tsx` | Generator with auto-detection |
| `SUBDOMAIN_SETUP.md` | Complete DNS setup guide |
| `SUBDOMAIN_IMPLEMENTATION.md` | What was implemented |

## Key Functions

```typescript
// Detect current subdomain
getSubdomain() → 'main' | 'bpmn' | 'pid'

// Get URL for a subdomain
getSubdomainUrl('bpmn', '/path') → 'bpmn.domain.com/path'

// Navigate to subdomain
navigateToBpmn(true) → opens in new tab
navigateToPid(false) → navigates in current tab
```

## DNS Setup (Quick)

Add these records to your domain registrar:

```
Type: CNAME
Name: bpmn
Value: yourdomain.com (or your hosting provider's domain)

Type: CNAME
Name: pid
Value: yourdomain.com (or your hosting provider's domain)
```

## Local Testing

```bash
# Start dev server
npm run dev

# Test in browser:
http://localhost:8080/?subdomain=bpmn    # BPMN mode
http://localhost:8080/?subdomain=pid     # P&ID mode
http://localhost:8080/                   # Main mode
```

## Common Use Cases

### User visits your main site
1. Sees "Try It Free" button
2. Sees "BPMN Diagrams" and "P&ID Diagrams" options below
3. Clicks one → Goes to respective subdomain

### User is on BPMN subdomain
1. Diagram generator loads with BPMN selected
2. Navigation shows BPMN-specific items
3. Can switch to P&ID via header link

### User is on P&ID subdomain
1. Diagram generator loads with P&ID selected
2. Navigation shows P&ID-specific items
3. Can switch to BPMN via header link

## Troubleshooting Quick Links

| Issue | Solution |
|-------|----------|
| Subdomain not working | See SUBDOMAIN_SETUP.md § "DNS Configuration" |
| Local testing issues | Use `?subdomain=bpmn` query parameter |
| Certificate error | Ensure wildcard SSL certificate `*.domain.com` |
| Slow subdomain loading | Wait 24-48 hours for DNS propagation |

## What's NOT Changed

- No new dependencies needed
- No environment variables required
- Compatible with your existing components
- Uses your existing UI components (shadcn)
- Backward compatible with main domain

## Integration Points

If you want to extend this:

```typescript
// In your app or component
import { getSubdomain, navigateToBpmn } from '@/utils/subdomain';

// Detect subdomain
const current = getSubdomain();

// Navigate
navigateToBpmn(openInNewTab);
```

## Support

- 📖 Full guide: `SUBDOMAIN_SETUP.md`
- 📝 Implementation details: `SUBDOMAIN_IMPLEMENTATION.md`
- 💻 Code: All in `src/` with TypeScript types
- 🚀 Ready to deploy: Just add DNS records!

---

**Ready to deploy?** Add DNS CNAME records and you're all set! 🎉
