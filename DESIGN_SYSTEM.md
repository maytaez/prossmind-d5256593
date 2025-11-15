# ProssMind Design System

This document outlines the design tokens, type scale, spacing system, and component guidelines for the ProssMind application.

## Color Tokens

### Primary Colors
- **Primary**: `hsl(219 91% 53%)` - Alpine Blue (#2563EB)
  - Used for: CTAs, links, active states, focus rings
  - Primary-foreground: `hsl(0 0% 100%)` - White
- **Primary-600**: `hsl(219 91% 45%)` - Darker blue for hover states
- **Primary-900**: `hsl(219 91% 30%)` - Darkest blue for pressed states

### Secondary Colors
- **Secondary**: `hsl(213 24% 27%)` - Slate Gray (#334155)
  - Used for: Secondary actions, muted backgrounds
  - Secondary-foreground: `hsl(0 0% 100%)` - White

### Accent Colors
- **Accent**: `hsl(219 91% 53%)` - Alpine Blue (light mode)
- **Accent**: `hsl(180 100% 35%)` - Teal (#00B3B3) (dark mode)
  - Used for: Highlights, decorative elements

### Semantic Colors
- **Success**: `hsl(142 76% 36%)` - Engineering Green (#16A34A)
- **Warning**: `hsl(38 92% 50%)` - Amber
- **Error/Destructive**: `hsl(0 84% 60%)` - Red
- **Info**: `hsl(219 91% 53%)` - Alpine Blue

### Neutral Colors
- **Background**: `hsl(0 0% 100%)` - White (light) / `hsl(0 0% 7%)` - #121212 (dark)
- **Foreground**: `hsl(222 47% 11%)` - Dark gray (light) / `hsl(0 0% 88%)` - #E0E0E0 (dark)
- **Muted**: `hsl(240 5% 96%)` - Light gray (light) / `hsl(0 0% 12%)` - #1E1E1E (dark)
- **Border**: `hsl(220 13% 91%)` - Light border (light) / `hsl(0 0% 18%)` - Dark border (dark)

## Typography Scale

### Font Family
- **Sans-serif**: Inter, Helvetica Neue, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, Fira Sans, Droid Sans, sans-serif

### Font Sizes (Modular Scale - Base: 16px)
- **Base**: `1rem` (16px) - Body text, default size
- **Large**: `1.25rem` (20px) - Subheadings, emphasized text
- **XL**: `1.5rem` (24px) - Section headings
- **2XL**: `2rem` (32px) - Page headings
- **3XL**: `3rem` (48px) - Hero headings

### Line Heights
- **Tight**: `1.25` - For large headings (32px+)
- **Normal**: `1.5` - For body text and most content
- **Relaxed**: `1.75` - For long-form content, descriptions

### Font Weights
- **Normal**: 400
- **Medium**: 500
- **Semibold**: 600
- **Bold**: 700

## Spacing Scale (4-point system)

All spacing values follow a 4-point grid system:

- **1**: `0.25rem` (4px) - Tight spacing, icon padding
- **2**: `0.5rem` (8px) - Small gaps, compact layouts
- **4**: `1rem` (16px) - Standard spacing, default gaps
- **6**: `1.5rem` (24px) - Section spacing, card padding
- **8**: `2rem` (32px) - Large gaps, section margins
- **12**: `3rem` (48px) - Extra large spacing, hero sections

### Usage in Tailwind
```tsx
// Spacing utilities
<div className="p-4">     // padding: 1rem (16px)
<div className="gap-2">   // gap: 0.5rem (8px)
<div className="mt-8">    // margin-top: 2rem (32px)
```

## Border Radius

- **sm**: `calc(var(--radius) - 4px)` - Small elements
- **md**: `calc(var(--radius) - 2px)` - Medium elements
- **lg**: `var(--radius)` (0.75rem / 12px) - Default radius
- **xl**: `1rem` (16px) - Large cards
- **2xl**: `1.5rem` (24px) - Extra large elements
- **full**: `9999px` - Pills, badges

## Component Library

### Buttons

#### Primary Button
```tsx
<Button variant="default" size="lg">
  Try It Free
</Button>
```
- Background: Primary color
- Text: Primary-foreground (white)
- Hover: Scale 1.03, translateY(-2px), shadow-lg
- Focus: Ring with glow effect

#### Secondary Button
```tsx
<Button variant="outline" size="lg">
  View Features
</Button>
```
- Border: Primary color
- Background: Transparent
- Hover: Scale 1.03, shadow-md

### Inputs

#### Text Input
```tsx
<Input placeholder="Enter text..." />
```
- Focus: Border color changes to primary, glow effect
- Transition: 200ms ease

#### Textarea
```tsx
<Textarea placeholder="Describe your process..." />
```
- Same focus behavior as Input
- Min-height: 80px

### Cards

```tsx
<Card className="p-6">
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>
    Content
  </CardContent>
</Card>
```
- Padding: 1.5rem (24px)
- Border radius: 0.75rem (12px)
- Hover: Subtle shadow increase

## Animation Guidelines

### Micro-interactions
- **Duration**: 160ms for buttons, 200ms for inputs
- **Easing**: `cubic-bezier(0.2, 0.9, 0.3, 1)` for smooth, natural motion
- **Scale**: 1.03 for hover states, 0.98 for active states

### Scroll Animations
- **Duration**: 600ms
- **Easing**: `cubic-bezier(0.2, 0.9, 0.3, 1)`
- **Stagger**: 100ms delay between items

### Reduced Motion
All animations respect `prefers-reduced-motion`:
- Use `useReducedMotion()` hook to check preference
- Disable animations when `prefersReducedMotion === true`
- Provide instant state changes instead of animated transitions

## Accessibility

### Color Contrast
- **Body text**: Minimum 4.5:1 contrast ratio
- **Large text (18px+)**: Minimum 3:1 contrast ratio
- **Interactive elements**: Minimum 3:1 contrast ratio

### Focus States
- All interactive elements have visible focus indicators
- Focus ring: 2px solid primary color with 2px offset
- Focus glow: `0 0 8px hsl(var(--ring) / 0.5)`

### ARIA Labels
- All interactive elements have descriptive `aria-label` attributes
- Decorative icons use `aria-hidden="true"`
- Form inputs have associated labels

### Keyboard Navigation
- All interactive elements are keyboard accessible
- Tab order follows visual hierarchy
- Enter/Space activate buttons
- Escape closes modals/dialogs

## Usage Examples

### Typography
```tsx
// Hero heading
<h1 className="text-3xl md:text-5xl font-bold leading-tight">
  ProssMind
</h1>

// Body text
<p className="text-base leading-normal text-foreground/80">
  Description text
</p>
```

### Spacing
```tsx
// Section with consistent spacing
<section className="py-24 px-6">
  <div className="container mx-auto space-y-8">
    {/* Content */}
  </div>
</section>
```

### Colors
```tsx
// Using CSS variables
<div className="bg-primary text-primary-foreground">
  Primary colored element
</div>

// Using design tokens
<div style={{ color: 'hsl(var(--primary))' }}>
  Custom colored element
</div>
```

## Dark Mode

All color tokens automatically adapt to dark mode:
- Backgrounds become darker
- Text becomes lighter
- Primary colors adjust for better contrast
- Borders become more subtle

Use the `dark:` prefix in Tailwind for dark-mode-specific styles:
```tsx
<div className="bg-background dark:bg-card">
  Adapts to theme
</div>
```

## Performance Considerations

- Use CSS variables for colors (no runtime calculations)
- Leverage Tailwind's utility classes (smaller bundle size)
- Lazy load animations and heavy components
- Respect `prefers-reduced-motion` for better performance

## Resources

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Framer Motion Documentation](https://www.framer.com/motion/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

