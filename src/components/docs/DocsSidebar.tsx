import { Link, useLocation } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, BookOpen, GraduationCap, Code, HelpCircle, FileText, Rocket } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const docsSections = [
  { name: "Getting Started", path: "/getting-started", icon: Rocket },
  { name: "Guides", path: "/guides", icon: BookOpen },
  { name: "Tutorials", path: "/tutorials", icon: GraduationCap },
  { name: "API Reference", path: "/api-reference", icon: Code },
  { name: "FAQ", path: "/faq", icon: HelpCircle },
  { name: "Changelog", path: "/changelog", icon: FileText },
];

const DocsSidebar = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-16 left-0 right-0 z-40 border-b bg-background px-6 py-3">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              <Menu className="h-4 w-4 mr-2" />
              Documentation Menu
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] sm:w-[400px]">
            <SheetHeader>
              <SheetTitle>Documentation</SheetTitle>
            </SheetHeader>
            <nav className="mt-6 space-y-2">
              {docsSections.map((section) => {
                const Icon = section.icon;
                const isActive = location.pathname === section.path || 
                  (section.path === "/getting-started" && location.pathname === "/");
                return (
                  <Link
                    key={section.path}
                    to={section.path}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground/70 hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {section.name}
                  </Link>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 border-r bg-muted/30 pt-16 fixed left-0 top-0 h-full overflow-y-auto">
        <nav className="p-6 space-y-2">
          {docsSections.map((section) => {
            const Icon = section.icon;
            const isActive = location.pathname === section.path || 
              (section.path === "/getting-started" && location.pathname === "/");
            return (
              <Link
                key={section.path}
                to={section.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/70 hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4" />
                {section.name}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
};

export default DocsSidebar;





