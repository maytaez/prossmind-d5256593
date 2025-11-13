import { getSubdomain } from "./utils/subdomain";
import BpmnPage from "./pages/BpmnSubdomain";
import { PidSubdomainPage } from "./pages/PidSubdomain";
import App from "./App";

const SubdomainApp = () => {
  const subdomain = getSubdomain();

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
