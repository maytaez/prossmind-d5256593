# Where to Find the Combined BPMN + DMN Modeler

## ✅ UPDATED ROUTES (Now using CombinedCamundaWebModeler)

### App Subdomain Routes
These routes NOW use the new combined modeler:

1. **BPMN Generator**
   - URL: `http://app.localhost:8080/bpmn-generator`
   - Initial Mode: BPMN
   - Can switch to: DMN

2. **P&ID Generator** 
   - URL: `http://app.localhost:8080/pid-generator`
   - Initial Mode: BPMN
   - Can switch to: DMN

3. **DMN Generator**
   - URL: `http://app.localhost:8080/dmn-generator`
   - Initial Mode: DMN
   - Can switch to: BPMN

### Main App Routes

4. **Combined Modeler Page**
   - URL: `http://localhost:8080/modeler`
   - Initial Mode: BPMN
   - Can switch to: DMN

### Subdomain Routes

5. **DMN Subdomain**
   - URL: `http://dmn.localhost:8080`
   - Initial Mode: DMN
   - Can switch to: BPMN

## What You Should See Now

After refreshing your browser, you should see:

```
┌─────────────────────────────────────────────────────┐
│  BPMN Modeler (or DMN Modeler)                      │
│  Switch between BPMN and DMN using the tabs below   │
│                                                     │
│  [BPMN] [DMN]                    [Download BPMN]   │
│                                                     │
│  ✨ Generate BPMN with AI                           │
│  [Suggestion 1] [Suggestion 2] [Suggestion 3]      │
│  ┌───────────────────────────┐                     │
│  │ Describe your process...  │  [Generate]         │
│  └───────────────────────────┘                     │
└─────────────────────────────────────────────────────┘
```

## Steps to Test

1. **Refresh your browser** (Cmd/Ctrl + Shift + R)
2. **Look at the top of the page** - you should see:
   - A large header: "BPMN Modeler" or "DMN Modeler"
   - Two toggle buttons: [BPMN] [DMN]
   - A Download button on the right
3. **Click the toggle buttons** to switch between BPMN and DMN
4. **Try AI generation** in both modes

## If You're Currently On

Based on your screenshots, you're likely on:
- `http://app.localhost:8080/dmn-generator`

This route has been **updated** to use the new CombinedCamundaWebModeler.

## What Changed

### Before (Old Interface)
- Three tabs at top: "BPMN Diagram", "P&ID Diagram", "DMN Decision"
- Used SubdomainTryProssMe component
- Separate pages for each type

### After (New Interface)
- Single unified modeler
- Two toggle buttons: "BPMN" and "DMN"
- Uses CombinedCamundaWebModeler component
- Can switch between types without changing pages

## Troubleshooting

### Still seeing old interface?
1. **Hard refresh**: Cmd/Ctrl + Shift + R
2. **Clear cache**: Open DevTools → Application → Clear Storage
3. **Check URL**: Make sure you're on one of the URLs listed above
4. **Check console**: Look for any JavaScript errors

### Not seeing toggle buttons?
1. **Scroll to top**: The control bar is at the very top
2. **Check for errors**: Open browser console (F12)
3. **Verify CSS loaded**: Check Network tab for bundle.css

## Quick Test Checklist

- [ ] Refresh browser (hard refresh)
- [ ] See "BPMN Modeler" or "DMN Modeler" header
- [ ] See [BPMN] [DMN] toggle buttons
- [ ] Click BPMN button → see BPMN canvas
- [ ] Click DMN button → see DMN canvas
- [ ] Try generating a diagram in each mode

## Expected URLs and Modes

| URL | Initial Mode | Can Switch To |
|-----|--------------|---------------|
| `app.localhost:8080/bpmn-generator` | BPMN | DMN |
| `app.localhost:8080/pid-generator` | BPMN | DMN |
| `app.localhost:8080/dmn-generator` | DMN | BPMN |
| `localhost:8080/modeler` | BPMN | DMN |
| `dmn.localhost:8080` | DMN | BPMN |

All of these routes now use the **same component** (CombinedCamundaWebModeler) with different initial modes.
