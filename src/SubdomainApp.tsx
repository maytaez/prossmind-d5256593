import { getSubdomain } from "./utils/subdomain";
import BpmnPage from "./pages/BpmnSubdomain";
import { PidSubdomainPage } from "./pages/PidSubdomain";

const SubdomainApp = () => {
  const subdomain = getSubdomain();

  if (subdomain === "bpmn") {
    return <BpmnPage />;
  }

  if (subdomain === "pid") {
    return <PidSubdomainPage />;
  }

  return null;
};

export default SubdomainApp;
