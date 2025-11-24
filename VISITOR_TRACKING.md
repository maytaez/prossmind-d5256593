# Visitor Tracking System

This system tracks website visitors with their consent, storing information about who visits the site and where they come from.

## Features

- Cookie consent banner on homepage
- Tracks visitor information including:
  - Session ID
  - User ID (if logged in)
  - IP Address
  - User Agent (browser, OS, device type)
  - Referrer (where they came from)
  - Landing page
  - Screen resolution
  - Language and timezone
  - Cookie consent status and timestamp

## Database Schema

The `visitor_tracking` table stores all visitor data. Key fields:
- `session_id`: Unique identifier for each visitor session
- `user_id`: Links to authenticated users (nullable)
- `ip_address`: Visitor's IP address
- `referrer`: The URL they came from
- `landing_page`: The first page they visited
- `cookie_consent`: Whether they accepted cookies
- `created_at`: First visit timestamp
- `updated_at`: Last visit timestamp

## Querying Visitor Data

### View all visitors (Admin only)
```sql
SELECT * FROM visitor_tracking 
ORDER BY created_at DESC;
```

### View visitors by date
```sql
SELECT 
  DATE(created_at) as visit_date,
  COUNT(*) as visitor_count,
  COUNT(DISTINCT session_id) as unique_sessions
FROM visitor_tracking
GROUP BY DATE(created_at)
ORDER BY visit_date DESC;
```

### View top referrers
```sql
SELECT 
  referrer,
  COUNT(*) as visit_count
FROM visitor_tracking
WHERE referrer IS NOT NULL
GROUP BY referrer
ORDER BY visit_count DESC
LIMIT 10;
```

### View device/browser statistics
```sql
SELECT 
  device_type,
  browser,
  os,
  COUNT(*) as count
FROM visitor_tracking
GROUP BY device_type, browser, os
ORDER BY count DESC;
```

### View consent statistics
```sql
SELECT 
  cookie_consent,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM visitor_tracking
GROUP BY cookie_consent;
```

### View visitors by country (if geolocation is added)
```sql
SELECT 
  country,
  COUNT(*) as visitor_count
FROM visitor_tracking
WHERE country IS NOT NULL
GROUP BY country
ORDER BY visitor_count DESC;
```

## Access Control

- **Anonymous users**: Can insert their own tracking data
- **Authenticated users**: Can view their own tracking data
- **Admins**: Can view all tracking data

## Edge Function

The `track-visitor` edge function handles:
- Parsing user agent to extract browser/OS/device info
- Extracting IP address from request headers
- Storing visitor data in the database
- Updating existing records for the same session

## Usage

The cookie consent banner appears automatically on the homepage. Once a user accepts or declines, their preference is stored in localStorage and they won't see the banner again (unless they clear their browser data).

Visitor tracking happens automatically when:
1. User accepts cookies
2. User visits the homepage (if they previously accepted)

## Privacy

- IP addresses are stored but can be anonymized if needed
- Users can decline cookies (though basic visit tracking may still occur)
- All data is stored securely in Supabase with RLS policies

