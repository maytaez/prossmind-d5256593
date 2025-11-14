import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronRight, LogOut, Shield, Menu, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { User } from "@supabase/supabase-js";
import { useAdminStatus } from "@/hooks/useAdminStatus";
import prossmindLogo from "@/assets/prossmind-logo-transparent.png";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import ThemeToggle from "@/components/ThemeToggle";
import EnterpriseContactModal from "@/components/EnterpriseContactModal";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LogIn } from "lucide-react";

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
  const [isEnterpriseModalOpen, setIsEnterpriseModalOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

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

  // Handle scroll animations
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setIsScrolled(scrollY > 20);
    };

    // Throttle scroll listener
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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

  // Handle smooth scroll for anchor links
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a[href^="#"]');
      if (link) {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#')) {
          e.preventDefault();
          const id = href.slice(1);
          const element = document.getElementById(id);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return (
    <TooltipProvider>
      <motion.nav 
        className="fixed top-0 left-0 right-0 z-sticky border-b border-border/50 h-16"
        initial={false}
        animate={{
          backgroundColor: isScrolled ? "hsl(var(--background) / 0.98)" : "hsl(var(--background) / 0.80)",
          backdropFilter: isScrolled ? "blur(12px)" : "blur(8px)",
          boxShadow: isScrolled ? "0 4px 30px rgba(0, 0, 0, 0.1)" : "0 1px 3px rgba(0, 0, 0, 0.05)",
        }}
        transition={{ duration: 0.3 }}
      >
      <div className="container mx-auto px-6 h-full">
        <div className="flex items-center justify-between h-full">
          <motion.div
            animate={{
              scale: isScrolled ? 0.9 : 1,
            }}
            transition={{ duration: 0.3 }}
          >
            <Link to="/" className="flex items-center space-x-3 group flex-shrink-0" aria-label="ProssMind Home">
              <img src={prossmindLogo} alt="ProssMind Logo" className="h-10 w-auto group-hover:scale-105 transition-transform" />
              <div className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent whitespace-nowrap">
                ProssMind
              </div>
            </Link>
          </motion.div>

          {/* Desktop Navigation */}
          {!isMobile && (
            <>
              <div className="relative flex items-center justify-center flex-1">
                <div className="relative flex items-center space-x-1 bg-[rgba(20,30,60,0.2)] backdrop-blur-[8px] rounded-full px-10 py-3 shadow-sm border border-[rgba(100,180,255,0.4)]">
                  {navItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`relative px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 whitespace-nowrap group ${
                        location.pathname === item.path
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "text-foreground/70 hover:text-foreground hover:bg-muted/80 hover:scale-[1.02] active:scale-[0.98]"
                      }`}
                      aria-label={`Navigate to ${item.name} page`}
                    >
                      {item.name}
                      {location.pathname === item.path && (
                        <motion.div
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-foreground rounded-full"
                          layoutId="activeNavIndicator"
                          transition={{
                            type: "spring",
                            stiffness: 380,
                            damping: 30,
                          }}
                        />
                      )}
                      {location.pathname !== item.path && (
                        <motion.div
                          className="absolute bottom-0 left-1/2 right-1/2 h-0.5 bg-primary/50 rounded-full opacity-0 group-hover:opacity-100 group-hover:left-0 group-hover:right-0 transition-all duration-300"
                        />
                      )}
                    </Link>
                  ))}
                </div>
              </div>

              {user ? (
                <div className="flex items-center gap-4 flex-shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEnterpriseModalOpen(true)}
                        className="gap-2 hover:bg-primary/10 hover:text-primary transition-all whitespace-nowrap hidden lg:flex rounded-full"
                        aria-label="Enterprise inquiry"
                      >
                        <Building2 className="h-4 w-4" aria-hidden="true" />
                        Enterprise?
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Contact Enterprise Sales</p>
                    </TooltipContent>
                  </Tooltip>
                  <ThemeToggle />
                  {isAdmin && (
                    <Link to="/admin">
                      <Button variant="outline" size="sm" className="gap-2 hover:bg-primary/10 hover:border-primary/50 transition-all whitespace-nowrap rounded-full" aria-label="Admin Dashboard">
                        <Shield className="h-4 w-4" aria-hidden="true" />
                        Admin
                      </Button>
                    </Link>
                  )}
                  <span className="text-sm text-muted-foreground font-medium whitespace-nowrap truncate max-w-[200px]" aria-label={`Logged in as ${user.email}`}>{user.email}</span>
                  <Button onClick={handleSignOut} variant="outline" className="items-center gap-2 hover:bg-destructive/10 hover:border-destructive/50 hover:text-destructive transition-all whitespace-nowrap rounded-full" aria-label="Sign out">
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Sign Out
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-4 flex-shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEnterpriseModalOpen(true)}
                        className="gap-2 hover:bg-primary/10 hover:text-primary transition-all whitespace-nowrap hidden lg:flex rounded-full"
                        aria-label="Enterprise inquiry"
                      >
                        <Building2 className="h-4 w-4" aria-hidden="true" />
                        Enterprise?
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Contact Enterprise Sales</p>
                    </TooltipContent>
                  </Tooltip>
                  <ThemeToggle />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link to="/auth" className="flex-shrink-0">
                        <Button className="flex items-center gap-2 bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all whitespace-nowrap rounded-full" aria-label="Sign up or log in" role="link">
                          <LogIn className="h-4 w-4" aria-hidden="true" />
                          Sign Up
                          <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Sign in to your account</p>
                    </TooltipContent>
                  </Tooltip>
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
                <nav className="flex flex-col gap-4 mt-6" role="navigation" aria-label="Main navigation">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-border mb-2">
                    <span className="text-sm font-medium">Theme</span>
                    <ThemeToggle />
                  </div>
                  {navItems.map((item, index) => (
                    <motion.div
                      key={item.path}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.3 }}
                    >
                      <Link
                        to={item.path}
                        onClick={() => setIsSheetOpen(false)}
                        className={`px-4 py-2 rounded-lg text-base font-medium transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
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
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIsEnterpriseModalOpen(true);
                      setIsSheetOpen(false);
                    }}
                    className="w-full justify-start gap-2 mt-2 focus-visible:outline-2 focus-visible:outline-offset-2"
                    aria-label="Enterprise inquiry"
                  >
                    <Building2 className="h-4 w-4" aria-hidden="true" />
                    Enterprise?
                  </Button>
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
      <EnterpriseContactModal open={isEnterpriseModalOpen} onOpenChange={setIsEnterpriseModalOpen} />
    </motion.nav>
    </TooltipProvider>
  );
};

export default Navigation;
