import { Routes, Route } from "react-router-dom";
import Navigation from "@/components/Navigation";
import PartnersOverview from "./partners/Overview";
import Marketplace from "./partners/Marketplace";
import Resources from "./partners/Resources";
import Training from "./partners/Training";

const PartnersSubdomain = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <Routes>
        <Route path="/" element={<PartnersOverview />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/training" element={<Training />} />
        <Route path="*" element={<PartnersOverview />} />
      </Routes>
    </div>
  );
};

export default PartnersSubdomain;




