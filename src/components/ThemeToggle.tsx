import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/ThemeContext";
import { useEffect, useState } from "react";

/**
 * ThemeToggle - Component for switching between light and dark themes
 * Displays sun icon in light mode and moon icon in dark mode
 */
const ThemeToggle = () => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by only showing after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return a placeholder with the same size to prevent layout shift
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        aria-label="Theme toggle"
        disabled
      >
        <Sun className="h-5 w-5" aria-hidden="true" />
      </Button>
    );
  }

  const toggleTheme = () => {
    // Cycle through: light -> dark -> system -> light
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="h-9 w-9 relative transition-all"
      aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
      title={`Current: ${resolvedTheme === "dark" ? "Dark" : "Light"} mode (${theme === "system" ? "Auto" : "Manual"})`}
    >
      {resolvedTheme === "dark" ? (
        <Sun className="h-5 w-5 transition-all rotate-0 scale-100" aria-hidden="true" />
      ) : (
        <Moon className="h-5 w-5 transition-all rotate-0 scale-100" aria-hidden="true" />
      )}
      <span className="sr-only">
        {resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      </span>
    </Button>
  );
};

export default ThemeToggle;

