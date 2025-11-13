import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronRight, LogOut, Shield, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { User } from "@supabase/supabase-js";
import { useAdminStatus } from "@/hooks/useAdminStatus";
import prossmindLogo from "@/assets/prossmind-logo-transparent.png";
import { useState, useEffect, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import ThemeToggle from "@/components/ThemeToggle";

const Navigation = ({ user: userProp }: { user?: User | null }) => {
  const location = useLocation();
  const { toast } = useToast();
  // Use ref to track if we've initialized from session - persists across re-renders
  const hasInitializedRef = useRef(false);
  // Use ref to store the last known user from session - persists across re-renders
  const sessionUserRef = useRef<User | null>(null);
  // Use ref to track current user state to avoid stale closures
  const userStateRef = useRef<User | null>(null);
  
  const [user, setUser] = useState<User | null>(() => {
    // Initialize from prop if provided and valid, otherwise null (will be set from session)
    const initialUser = userProp ?? null;
    userStateRef.current = initialUser;
    return initialUser;
  });
  const { isAdmin } = useAdminStatus(user);
  const [isMobile, setIsMobile] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Fetch user session on mount and listen for auth changes - run only once
  useEffect(() => {
    // Get initial session - this is the source of truth
    supabase.auth.getSession().then(({ data: { session } }) => {
      hasInitializedRef.current = true;
      const sessionUser = session?.user ?? null;
      sessionUserRef.current = sessionUser;
      userStateRef.current = sessionUser;
      setUser(sessionUser);
    });

    // Listen for auth state changes - this is the authoritative source
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Only update user state based on actual auth events (sign in/out)
        hasInitializedRef.current = true;
        const sessionUser = session?.user ?? null;
        sessionUserRef.current = sessionUser;
        userStateRef.current = sessionUser;
        setUser(sessionUser);
      }
    );

    return () => subscription.unsubscribe();
  }, []); // Empty deps - only run once on mount, never re-run

  // Handle prop updates - but preserve session user during navigation
  useEffect(() => {
    // Only process prop updates after we've initialized from session
    if (!hasInitializedRef.current) {
      return; // Wait for session initialization
    }

    if (userProp !== undefined) {
      // Prop explicitly provided - update state
      userStateRef.current = userProp;
      setUser(userProp);
      if (userProp) {
        sessionUserRef.current = userProp;
      }
    } else if (userProp === undefined && userStateRef.current === null && sessionUserRef.current !== null) {
      // Prop is undefined during navigation, current state is null, but we have a session user
      // Restore from session ref to prevent flash of "Sign In" button
      userStateRef.current = sessionUserRef.current;
      setUser(sessionUserRef.current);
    }
    // If userProp is undefined and user is already set, do nothing - maintain current state
  }, [userProp]); // Only depend on userProp, not user (to avoid loops)
  
  // Keep ref in sync with state
  useEffect(() => {
    userStateRef.current = user;
  }, [user]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1080);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        variant: "destructive",
        title: "Error signing out",
        description: error.message,
      });
    }
  };
  
  const navItems = [
    { name: "App", path: "/" },
    { name: "Features", path: "/features" },
    { name: "Vision AI", path: "/vision-ai" },
    { name: "Pricing", path: "/pricing" },
    { name: "Contact", path: "/contact" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border/50 shadow-sm h-16">
      <div className="container mx-auto px-6 h-full">
        <div className="flex items-center justify-between h-full">
                    <Link to="/" className="flex items-center space-x-3 group flex-shrink-0" aria-label="ProssMind Home">
            <img src={prossmindLogo} alt="ProssMind Logo" className="h-10 w-auto group-hover:scale-105 transition-transform" />
            <div className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent whitespace-nowrap">
              ProssMind
            </div>
          </Link>

          {/* Desktop Navigation */}
          {!isMobile && (
            <>
              <div className="flex items-center space-x-1 bg-secondary/50 rounded-full px-2 py-1.5 shadow-sm flex-shrink-0">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                      location.pathname === item.path
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "text-foreground/70 hover:text-foreground hover:bg-muted/80 hover:scale-[1.02]"
                    }`}
                    aria-label={`Navigate to ${item.name} page`}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>

              {user ? (
                <div className="flex items-center gap-3 flex-shrink-0">
                  <ThemeToggle />
                  {isAdmin && (
                    <Link to="/admin">
                      <Button variant="outline" size="sm" className="gap-2 hover:bg-primary/10 hover:border-primary/50 transition-all whitespace-nowrap" aria-label="Admin Dashboard">
                        <Shield className="h-4 w-4" aria-hidden="true" />
                        Admin
                      </Button>
                    </Link>
                  )}
                  <span className="text-sm text-muted-foreground font-medium whitespace-nowrap truncate max-w-[200px]" aria-label={`Logged in as ${user.email}`}>{user.email}</span>
                  <Button onClick={handleSignOut} variant="outline" className="items-center gap-2 hover:bg-destructive/10 hover:border-destructive/50 hover:text-destructive transition-all whitespace-nowrap" aria-label="Sign out">
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Sign Out
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3 flex-shrink-0">
                  <ThemeToggle />
                  <Link to="/auth" className="flex-shrink-0">
                    <Button className="flex items-center gap-2 bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-all whitespace-nowrap" aria-label="Sign up or log in">
                      Sign Up
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </Link>
                </div>
              )}
            </>
          )}

          {/* Mobile Navigation - Hamburger Menu */}
          {isMobile && (
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation menu">
                  <Menu className="h-6 w-6" aria-hidden="true" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-4 mt-6">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-border mb-2">
                    <span className="text-sm font-medium">Theme</span>
                    <ThemeToggle />
                  </div>
                  {navItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsSheetOpen(false)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        location.pathname === item.path
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground/70 hover:text-foreground hover:bg-muted/80"
                      }`}
                      aria-label={`Navigate to ${item.name} page`}
                    >
                      {item.name}
                    </Link>
                  ))}
                  {user ? (
                    <>
                      {isAdmin && (
                        <Link to="/admin" onClick={() => setIsSheetOpen(false)}>
                          <Button variant="outline" className="w-full justify-start gap-2" aria-label="Admin Dashboard">
                            <Shield className="h-4 w-4" aria-hidden="true" />
                            Admin
                          </Button>
                        </Link>
                      )}
                      <div className="px-4 py-2 text-sm text-muted-foreground" aria-label={`Logged in as ${user.email}`}>
                        {user.email}
                      </div>
                      <Button 
                        onClick={() => {
                          handleSignOut();
                          setIsSheetOpen(false);
                        }} 
                        variant="outline" 
                        className="w-full justify-start gap-2 hover:bg-destructive/10 hover:border-destructive/50 hover:text-destructive"
                        aria-label="Sign out"
                      >
                        <LogOut className="h-4 w-4" aria-hidden="true" />
                        Sign Out
                      </Button>
                    </>
                  ) : (
                    <Link to="/auth" onClick={() => setIsSheetOpen(false)}>
                      <Button className="w-full gap-2" aria-label="Sign up or log in">
                        Sign Up
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </Link>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
