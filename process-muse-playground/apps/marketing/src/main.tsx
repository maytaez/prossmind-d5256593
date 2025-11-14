import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ThemeProvider } from "./context/ThemeContext";
import { FeatureFlagsProvider } from "./context/FeatureFlagsContext";

createRoot(document.getElementById("root")!).render(
  <FeatureFlagsProvider>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </FeatureFlagsProvider>
);
