# Testing the Combined BPMN + DMN Modeler

## What to Check

### 1. Control Bar Visibility
- [ ] You should see a **sticky header** at the top with "BPMN Modeler" or "DMN Modeler"
- [ ] Below that, you should see **two toggle buttons**: "BPMN" and "DMN"
- [ ] The active button should be highlighted (filled background)
- [ ] There should be a "Download" button on the right

### 2. Mode Switching
- [ ] Click the "BPMN" button - the modeler should switch to BPMN mode
- [ ] Click the "DMN" button - the modeler should switch to DMN mode
- [ ] The header should update to show "BPMN Modeler" or "DMN Modeler"
- [ ] The AI generation section should update to show appropriate prompts

### 3. AI Generation
- [ ] In BPMN mode, you should see BPMN-related suggestion prompts
- [ ] In DMN mode, you should see DMN-related suggestion prompts
- [ ] Entering a prompt and clicking "Generate" should create the appropriate diagram

### 4. Visual Layout

The page should look like this:

```
┌─────────────────────────────────────────────────────────┐
│  BPMN Modeler  (or DMN Modeler)                         │
│  Switch between BPMN and DMN using the tabs below       │
│                                                         │
│  [BPMN] [DMN]                        [Download BPMN]   │
│                                                         │
│  ✨ Generate BPMN with AI                               │
│  [Suggestion 1] [Suggestion 2] [Suggestion 3]          │
│  ┌─────────────────────────────────────┐               │
│  │ Describe your process...            │  [Generate]   │
│  └─────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│                                                         │
│              BPMN/DMN Modeler Canvas                    │
│                                                         │
│  (Diagram editing area with palette, properties, etc)  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Current Setup

### DMN Subdomain (`dmn.localhost:8080`)
- **Initial Mode**: DMN (starts in DMN mode)
- **Can Switch**: Yes, you can click "BPMN" to switch to BPMN mode
- **Purpose**: Primarily for DMN editing but supports both

### Combined Modeler Page (`/modeler`)
- **Initial Mode**: BPMN (starts in BPMN mode)
- **Can Switch**: Yes, you can click "DMN" to switch to DMN mode
- **Purpose**: General-purpose modeler for both types

## Troubleshooting

### Issue: I don't see the toggle buttons

**Possible Causes:**
1. The control bar is scrolled out of view
2. CSS not loaded properly
3. Component not rendering

**Solutions:**
1. Scroll to the very top of the page
2. Check browser console for errors
3. Verify `@miragon/camunda-web-modeler/dist/bundle.css` is imported
4. Hard refresh the page (Cmd/Ctrl + Shift + R)

### Issue: I only see DMN

**Explanation:**
- On the DMN subdomain, the component **starts** in DMN mode
- This is intentional - you're on the DMN subdomain
- **Click the "BPMN" button** at the top to switch to BPMN mode

**To verify both work:**
1. Look for the toggle buttons at the top
2. Click "BPMN" - you should see a BPMN canvas
3. Click "DMN" - you should see a DMN canvas
4. Try generating a diagram in each mode

### Issue: Toggle buttons not working

**Solutions:**
1. Check browser console for JavaScript errors
2. Verify you're logged in (authentication required for AI generation)
3. Try clicking directly on the button text
4. Hard refresh the page

## Quick Test

1. **Go to**: `http://localhost:8080/modeler`
2. **You should see**: "BPMN Modeler" header with BPMN and DMN toggle buttons
3. **Click "DMN"**: The header should change to "DMN Modeler"
4. **Click "BPMN"**: The header should change back to "BPMN Modeler"
5. **Try AI generation**: Enter a prompt and click "Generate"

## Screenshots to Take

Please take screenshots showing:
1. The full page with the control bar visible
2. The BPMN mode active
3. The DMN mode active
4. The toggle buttons highlighted

This will help verify everything is working correctly.

## Expected Behavior

### On DMN Subdomain
- **Initial**: Shows DMN modeler with DMN diagram
- **After clicking BPMN**: Shows BPMN modeler with empty BPMN diagram
- **After clicking DMN**: Shows DMN modeler again

### On /modeler Page
- **Initial**: Shows BPMN modeler with empty BPMN diagram
- **After clicking DMN**: Shows DMN modeler with empty DMN diagram
- **After clicking BPMN**: Shows BPMN modeler again

## Key Points

1. **Both modelers are always available** - you just need to toggle between them
2. **The toggle buttons are at the top** - make sure you scroll to see them
3. **The component is working correctly** - it's designed to show one modeler at a time
4. **You can switch anytime** - no need to reload the page

If you still don't see the toggle buttons after scrolling to the top, please:
1. Share a screenshot of the entire page
2. Check the browser console for errors
3. Verify the URL you're visiting
