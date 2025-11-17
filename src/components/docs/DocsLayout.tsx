import { ReactNode } from "react";
import DocsSidebar from "./DocsSidebar";

interface DocsLayoutProps {
  children: ReactNode;
}

const DocsLayout = ({ children }: DocsLayoutProps) => {
  return (
    <div className="flex min-h-screen pt-16">
      <DocsSidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-6 py-12">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DocsLayout;




