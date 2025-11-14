import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ThemeProvider } from "./context/ThemeContext";
import { FeatureFlagsProvider } from "./context/FeatureFlagsContext";
import { getSubdomain } from "./utils/subdomain.ts";
import SubdomainApp from "./SubdomainApp.tsx";

const subdomain = getSubdomain();

createRoot(document.getElementById("root")!).render(
  <FeatureFlagsProvider>
    <ThemeProvider>
      {subdomain ? <SubdomainApp /> : <App />}
    </ThemeProvider>
  </FeatureFlagsProvider>
);
