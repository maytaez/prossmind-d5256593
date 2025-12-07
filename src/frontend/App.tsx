import { Routes, Route } from "react-router-dom";
import PageTransition from "@/components/PageTransition";
import VisitorTracker from "@/components/VisitorTracker";
import Index from "./pages/Index";
import Features from "./pages/Features";
import VisionAI from "./pages/VisionAI";
import Pricing from "./pages/Pricing";
import Contact from "./pages/Contact";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import LoadDiagram from "./pages/LoadDiagram";
import NotFound from "./pages/NotFound";
import Analytics from "./pages/Analytics";

const App = () => (
  <>
    <VisitorTracker />
    <Routes>
      <Route path="/" element={<PageTransition><Index /></PageTransition>} />
    <Route path="/features" element={<PageTransition><Features /></PageTransition>} />
    <Route path="/vision-ai" element={<PageTransition><VisionAI /></PageTransition>} />
    <Route path="/pricing" element={<PageTransition><Pricing /></PageTransition>} />
    <Route path="/contact" element={<PageTransition><Contact /></PageTransition>} />
    <Route path="/auth" element={<PageTransition><Auth /></PageTransition>} />
    <Route path="/admin" element={<PageTransition><Admin /></PageTransition>} />
    <Route path="/analytics" element={<PageTransition><Analytics /></PageTransition>} />
    <Route path="/load-diagram" element={<PageTransition><LoadDiagram /></PageTransition>} />
    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
    </Routes>
  </>
);

export default App;
