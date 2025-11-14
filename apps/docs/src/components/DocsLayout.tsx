import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@prossmind/ui";
import { Book, Home, FileText, GraduationCap, Code, HelpCircle, History } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

interface DocsLayoutProps {
  children: ReactNode;
}

const DocsLayout = ({ children }: DocsLayoutProps) => {
  const location = useLocation();
  const marketingUrl = import.meta.env.VITE_MARKETING_URL || 'http://localhost:8080';
  const appUrl = import.meta.env.VITE_APP_URL || 'http://localhost:8081';

  const navItems = [
    { path: "/getting-started", label: "Getting Started", icon: Book },
    { path: "/guides", label: "Guides", icon: FileText },
    { path: "/tutorials", label: "Tutorials", icon: GraduationCap },
    { path: "/api-reference", label: "API Reference", icon: Code },
    { path: "/faq", label: "FAQ", icon: HelpCircle },
    { path: "/changelog", label: "Changelog", icon: History },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-2xl font-bold">
              ProssMind Docs
            </Link>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <a href={marketingUrl}>
                <Button variant="ghost" size="sm">
                  <Home className="h-4 w-4 mr-2" />
                  Home
                </Button>
              </a>
              <a href={`${appUrl}/auth`}>
                <Button size="sm">Sign In</Button>
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="flex gap-8">
          <aside className="w-64 flex-shrink-0">
            <nav className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>

          <main className="flex-1 prose prose-slate dark:prose-invert max-w-none">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

export default DocsLayout;

