/**
 * ProssMind Design Tokens
 * Centralized design system values for consistent styling across the application
 */

export const theme = {
  light: {
    background: '#FFFFFF',
    surface: '#F9FAFB',
    text: '#1A1A1A',
    primary: '#004B8D',
    accent: '#009999',
  },
  dark: {
    background: '#121212',
    surface: '#1E1E1E',
    text: '#E0E0E0',
    primary: '#3B82F6', // Lighter blue for dark mode readability
    accent: '#00B3B3', // Brighter accent for dark mode
  },
  colors: {
    primary: '#004B8D', // Primary brand color
    secondary: '#E5E7EB', // Secondary brand color
    accent: '#009999', // Accent color
  },
  
  radius: {
    sm: '0.375rem', // 6px
    md: '0.5rem', // 8px
    lg: '0.75rem', // 12px
    xl: '1rem', // 16px
    '2xl': '1.5rem', // 24px
    full: '9999px',
  },
  
  spacing: {
    0: '0',
    1: '0.25rem', // 4px - Design System 4-point scale
    2: '0.5rem', // 8px - Design System 4-point scale
    3: '0.75rem', // 12px
    4: '1rem', // 16px - Design System 4-point scale
    5: '1.25rem', // 20px
    6: '1.5rem', // 24px - Design System 4-point scale
    8: '2rem', // 32px - Design System 4-point scale
    10: '2.5rem', // 40px
    12: '3rem', // 48px - Design System 4-point scale
    16: '4rem', // 64px
    20: '5rem', // 80px
    24: '6rem', // 96px
  },
  
  font: {
    family: {
      sans: ['Inter', 'Helvetica Neue', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'sans-serif'].join(', '),
    },
    size: {
      xs: '0.75rem', // 12px
      sm: '0.875rem', // 14px
      base: '1rem', // 16px - Design System modular scale base
      lg: '1.25rem', // 20px - Design System modular scale
      xl: '1.5rem', // 24px - Design System modular scale
      '2xl': '2rem', // 32px - Design System modular scale
      '3xl': '3rem', // 48px - Design System modular scale
      '4xl': '2.25rem', // 36px
      '5xl': '3.75rem', // 60px
      '6xl': '4.5rem', // 72px
      '7xl': '4.5rem', // 72px
    },
    weight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
  
  container: {
    maxWidth: '1200px',
    padding: {
      mobile: '1rem', // 16px
      desktop: '2rem', // 32px
    },
  },
} as const;

export type Theme = typeof theme;

