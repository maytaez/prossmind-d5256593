import { Routes, Route } from "react-router-dom";
import Navigation from "@/components/Navigation";
import DocsLayout from "@/components/docs/DocsLayout";
import GettingStarted from "./docs/GettingStarted";
import Guides from "./docs/Guides";
import Tutorials from "./docs/Tutorials";
import ApiReference from "./docs/ApiReference";
import FAQ from "./docs/FAQ";
import Changelog from "./docs/Changelog";

const DocsSubdomain = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <DocsLayout>
        <Routes>
          <Route path="/" element={<GettingStarted />} />
          <Route path="/getting-started" element={<GettingStarted />} />
          <Route path="/guides" element={<Guides />} />
          <Route path="/tutorials" element={<Tutorials />} />
          <Route path="/api-reference" element={<ApiReference />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/changelog" element={<Changelog />} />
          <Route path="*" element={<GettingStarted />} />
        </Routes>
      </DocsLayout>
    </div>
  );
};

export default DocsSubdomain;



