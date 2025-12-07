import { getSubdomain } from "./utils/subdomain";
import BpmnPage from "./pages/BpmnSubdomain";
import { PidSubdomainPage } from "./pages/PidSubdomain";
import AppSubdomain from "./pages/AppSubdomain";
import DocsSubdomain from "./pages/DocsSubdomain";
import StatusSubdomain from "./pages/StatusSubdomain";
import AdminSubdomain from "./pages/AdminSubdomain";
import ApiSubdomain from "./pages/ApiSubdomain";
import PartnersSubdomain from "./pages/PartnersSubdomain";
import LocalizedSubdomain from "./pages/LocalizedSubdomain";
import App from "./App";

const SubdomainApp = () => {
  const subdomain = getSubdomain();

  if (subdomain === "app") {
    return <AppSubdomain />;
  }

  if (subdomain === "docs") {
    return <DocsSubdomain />;
  }

  if (subdomain === "status") {
    return <StatusSubdomain />;
  }

  if (subdomain === "admin") {
    return <AdminSubdomain />;
  }

  if (subdomain === "api") {
    return <ApiSubdomain />;
  }

  if (subdomain === "partners") {
    return <PartnersSubdomain />;
  }

  if (subdomain === "de" || subdomain === "fr") {
    return <LocalizedSubdomain language={subdomain} />;
  }

  if (subdomain === "bpmn") {
    return <BpmnPage />;
  }

  if (subdomain === "pid") {
    return <PidSubdomainPage />;
  }

  // Fallback to main app for non-subdomain or unrecognized subdomains
  return <App />;
};

export default SubdomainApp;
