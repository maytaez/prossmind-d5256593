import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ThemeProvider } from "@prossmind/shared/context";
import { FeatureFlagsProvider } from "@prossmind/shared/context";

createRoot(document.getElementById("root")!).render(
  <FeatureFlagsProvider>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </FeatureFlagsProvider>
);




