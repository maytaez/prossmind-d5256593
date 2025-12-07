import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "prossmind-theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    return stored || "system";
  });

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    if (theme === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return theme;
  });

  // Update resolved theme when theme changes
  useEffect(() => {
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const updateResolved = (e: MediaQueryListEvent | MediaQueryList) => {
        setResolvedTheme(e.matches ? "dark" : "light");
      };
      
      updateResolved(mediaQuery);
      mediaQuery.addEventListener("change", updateResolved);
      
      return () => mediaQuery.removeEventListener("change", updateResolved);
    } else {
      setResolvedTheme(theme);
    }
  }, [theme]);

  // Apply theme to HTML element
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    
    if (resolvedTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.add("light");
    }
  }, [resolvedTheme]);

  // Persist theme preference
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    }
  };

  // Initialize theme on mount to prevent flash
  useEffect(() => {
    const root = window.document.documentElement;
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    const initialTheme = stored || "system";
    
    let initialResolved: "light" | "dark" = "light";
    if (initialTheme === "system") {
      initialResolved = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    } else {
      initialResolved = initialTheme;
    }
    
    root.classList.remove("light", "dark");
    root.classList.add(initialResolved);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

