import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronRight, LogOut, Shield, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { User } from "@supabase/supabase-js";
import { useAdminStatus } from "@/hooks/useAdminStatus";
// Using public asset path for the logo
import { useState, useEffect, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import ThemeToggle from "@/components/ThemeToggle";
import { useReducedMotion, getReducedMotionTransition } from "@/hooks/useReducedMotion";

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
  const prefersReducedMotion = useReducedMotion();
  const [isMobile, setIsMobile] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { scrollY } = useScroll();

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

  useEffect(() => {
    const unsubscribe = scrollY.on("change", (latest) => {
      setIsScrolled(latest > 50);
    });
    return () => unsubscribe();
  }, [scrollY]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    
    // Even if there's a server error (like session_not_found), 
    // we should still clear the local session state
    if (error) {
      // Only show error toast for non-session errors
      if (!error.message?.includes('session') && !error.message?.includes('Session')) {
        toast({
          variant: "destructive",
          title: "Error signing out",
          description: error.message,
        });
      }
    }
    
    // Clear local state and force a page reload to ensure clean state
    setUser(null);
    sessionUserRef.current = null;
    userStateRef.current = null;
    window.location.href = '/';
  };
  
  const navItems = [
    { name: "App", path: "/" },
    { name: "Features", path: "/features" },
    { name: "Vision AI", path: "/vision-ai" },
    { name: "Pricing", path: "/pricing" },
    { name: "Contact", path: "/contact" },
  ];

  return (
    <motion.nav 
      className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 h-16 bg-background/95 backdrop-blur-lg"
      style={{
        backgroundColor: useTransform(scrollY, [0, 100], ["hsl(var(--background) / 0.95)", "hsl(var(--background) / 1)"]),
        backdropFilter: useTransform(scrollY, [0, 100], ["blur(16px)", "blur(24px)"]),
        boxShadow: useTransform(
          scrollY,
          [0, 100],
          [
            "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
            "0 4px 30px rgba(37, 99, 235, 0.1)"
          ]
        ),
      }}
      initial={prefersReducedMotion ? { y: 0 } : { y: -100 }}
      animate={{ y: 0 }}
      transition={getReducedMotionTransition(prefersReducedMotion) || { duration: 0.3 }}
    >
      <div className="container mx-auto px-6 h-full">
        <div className="flex items-center justify-between h-full">
          <motion.div
            animate={prefersReducedMotion ? { scale: 1 } : { scale: isScrolled ? 0.95 : 1 }}
            transition={getReducedMotionTransition(prefersReducedMotion) || { duration: 0.3 }}
          >
            <Link to="/" className="flex items-center space-x-3 group flex-shrink-0" aria-label="ProssMind Home">
              <motion.img 
                src="/prossmind-logo.jpeg" 
                alt="ProssMind Logo" 
                className="h-10 w-auto"
                whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
                transition={getReducedMotionTransition(prefersReducedMotion) || { duration: 0.2 }}
              />
              <div className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent whitespace-nowrap">
                ProssMind
              </div>
            </Link>
          </motion.div>

          {/* Desktop Navigation */}
          {!isMobile && (
            <>
              <motion.div 
                className="flex items-center space-x-1 bg-secondary/50 rounded-full px-2 py-1.5 shadow-sm flex-shrink-0 relative border border-border/30"
                style={{ borderRadius: "40px" }}
                animate={prefersReducedMotion ? {} : {
                  paddingTop: isScrolled ? "0.25rem" : "0.375rem",
                  paddingBottom: isScrolled ? "0.25rem" : "0.375rem",
                }}
                transition={getReducedMotionTransition(prefersReducedMotion) || { duration: 0.3 }}
              >
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 whitespace-nowrap relative ${
                      location.pathname === item.path
                        ? "text-primary-foreground"
                        : "text-foreground/70 hover:text-foreground hover:bg-muted/80 hover:scale-[1.02]"
                    }`}
                    aria-label={`Navigate to ${item.name} page`}
                  >
                    {location.pathname === item.path && (
                      <motion.div
                        layoutId={prefersReducedMotion ? undefined : "activeNavIndicator"}
                        className="absolute inset-0 bg-primary rounded-full shadow-md"
                        transition={getReducedMotionTransition(prefersReducedMotion) || { type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10">{item.name}</span>
                  </Link>
                ))}
              </motion.div>

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
                <motion.div
                  whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
                >
                  <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation menu">
                    <motion.div
                      animate={prefersReducedMotion ? { rotate: isSheetOpen ? 90 : 0 } : { rotate: isSheetOpen ? 90 : 0 }}
                      transition={getReducedMotionTransition(prefersReducedMotion) || { duration: 0.3 }}
                    >
                      <Menu className="h-6 w-6" aria-hidden="true" />
                    </motion.div>
                    <span className="sr-only">Open menu</span>
                  </Button>
                </motion.div>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-4 mt-6">
                  <motion.div 
                    className="flex items-center justify-between px-4 py-2 border-b border-border mb-2"
                    initial={prefersReducedMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={getReducedMotionTransition(prefersReducedMotion) || { delay: 0.1 }}
                  >
                    <span className="text-sm font-medium">Theme</span>
                    <ThemeToggle />
                  </motion.div>
                  {navItems.map((item, index) => (
                    <motion.div
                      key={item.path}
                      initial={prefersReducedMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={getReducedMotionTransition(prefersReducedMotion) || { delay: 0.1 + index * 0.05 }}
                    >
                      <Link
                        to={item.path}
                        onClick={() => setIsSheetOpen(false)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 block ${
                          location.pathname === item.path
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground/70 hover:text-foreground hover:bg-muted/80"
                        }`}
                        aria-label={`Navigate to ${item.name} page`}
                      >
                        {item.name}
                      </Link>
                    </motion.div>
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
    </motion.nav>
  );
};

export default Navigation;
