import { BrowserRouter, Routes, Route } from "react-router-dom";
import DocsLayout from "./components/DocsLayout";
import GettingStarted from "./pages/GettingStarted";
import Guides from "./pages/Guides";
import Tutorials from "./pages/Tutorials";
import ApiReference from "./pages/ApiReference";
import Faq from "./pages/Faq";
import Changelog from "./pages/Changelog";

const App = () => {
  return (
    <BrowserRouter>
      <DocsLayout>
        <Routes>
          <Route path="/" element={<GettingStarted />} />
          <Route path="/getting-started" element={<GettingStarted />} />
          <Route path="/guides" element={<Guides />} />
          <Route path="/tutorials" element={<Tutorials />} />
          <Route path="/api-reference" element={<ApiReference />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/changelog" element={<Changelog />} />
        </Routes>
      </DocsLayout>
    </BrowserRouter>
  );
};

export default App;




