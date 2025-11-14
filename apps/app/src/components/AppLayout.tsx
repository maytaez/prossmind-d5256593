import { ReactNode, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { supabase } from "@prossmind/shared/config";
import { Button } from "@prossmind/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@prossmind/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@prossmind/ui/avatar";
import { 
  LayoutDashboard, 
  FileText, 
  Factory, 
  FolderOpen, 
  LayoutTemplate, 
  Settings, 
  User as UserIcon,
  LogOut,
  Menu,
  X
} from "lucide-react";
import { useEffect } from "react";
import ThemeToggle from "./ThemeToggle";

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const navItems = [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/bpmn-generator", label: "BPMN Generator", icon: FileText },
    { path: "/pid-generator", label: "P&ID Generator", icon: Factory },
    { path: "/projects", label: "Projects", icon: FolderOpen },
    { path: "/templates", label: "Templates", icon: LayoutTemplate },
    { path: "/account", label: "Account", icon: UserIcon },
    { path: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Mobile header */}
      <header className="lg:hidden border-b bg-card flex-shrink-0">
        <div className="flex items-center justify-between p-4">
          <Link to="/dashboard" className="text-xl font-bold">
            ProssMind
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r transition-transform duration-200 ease-in-out h-full lg:h-full flex flex-col`}
        >
          <div className="flex flex-col h-full">
            <div className="p-6 border-b hidden lg:block">
              <Link to="/dashboard" className="text-xl font-bold">
                ProssMind
              </Link>
            </div>

            <nav className="flex-1 p-4 space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
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

            <div className="p-4 border-t space-y-2">
              <div className="flex items-center justify-between px-2">
                <span className="text-sm text-muted-foreground">Theme</span>
                <ThemeToggle />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start">
                    <Avatar className="h-8 w-8 mr-2">
                      <AvatarFallback>
                        {user?.email?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{user?.email || "User"}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/account">
                      <UserIcon className="h-4 w-4 mr-2" />
                      Account
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings">
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 lg:ml-0 overflow-y-auto brand-gradient-bg min-h-screen">
          <div className="relative">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;

