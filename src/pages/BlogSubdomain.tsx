import { Routes, Route } from "react-router-dom";
import Navigation from "@/components/Navigation";
import BlogIndex from "./blog/Index";
import CaseStudies from "./blog/CaseStudies";
import Whitepapers from "./blog/Whitepapers";
import Webinars from "./blog/Webinars";

const BlogSubdomain = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <Routes>
        <Route path="/" element={<BlogIndex />} />
        <Route path="/case-studies" element={<CaseStudies />} />
        <Route path="/whitepapers" element={<Whitepapers />} />
        <Route path="/webinars" element={<Webinars />} />
        <Route path="*" element={<BlogIndex />} />
      </Routes>
    </div>
  );
};

export default BlogSubdomain;



