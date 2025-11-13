import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ThemeProvider } from "./context/ThemeContext";
import { getSubdomain } from "./utils/subdomain.ts";
import SubdomainApp from "./SubdomainApp.tsx";

const subdomain = getSubdomain();

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    {subdomain ? <SubdomainApp /> : <App />}
  </ThemeProvider>
);
