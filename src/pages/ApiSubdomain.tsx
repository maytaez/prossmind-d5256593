import { Routes, Route } from "react-router-dom";
import Navigation from "@/components/Navigation";
import ApiOverview from "./api/Overview";
import ApiReference from "./api/Reference";
import ApiSDKs from "./api/SDKs";
import ApiExamples from "./api/Examples";
import ApiPlayground from "./api/Playground";

const ApiSubdomain = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <Routes>
        <Route path="/" element={<ApiOverview />} />
        <Route path="/reference" element={<ApiReference />} />
        <Route path="/sdks" element={<ApiSDKs />} />
        <Route path="/examples" element={<ApiExamples />} />
        <Route path="/playground" element={<ApiPlayground />} />
        <Route path="*" element={<ApiOverview />} />
      </Routes>
    </div>
  );
};

export default ApiSubdomain;




