import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../config/supabase";
import { Button } from "@prossmind/ui/button";
import { Input } from "@prossmind/ui/input";
import { Label } from "@prossmind/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@prossmind/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@prossmind/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@prossmind/ui/dialog";
import { z } from "zod";
import { ArrowLeft, Eye, EyeOff, AlertCircle, Loader2, Brain, Network, Sparkles, Shield, CheckCircle, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";

const authSchema = z.object({
  email: z.string().email("Invalid email address").max(255, "Email too long"),
  password: z.string().min(6, "Password must be at least 6 characters").max(100, "Password too long"),
});

type PasswordStrength = "weak" | "medium" | "strong";

const calculatePasswordStrength = (password: string): PasswordStrength => {
  if (password.length === 0) return "weak";
  if (password.length < 6) return "weak";
  
  let strength = 0;
  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[a-z]/.test(password)) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^a-zA-Z0-9]/.test(password)) strength++;
  
  if (strength <= 2) return "weak";
  if (strength <= 4) return "medium";
  return "strong";
};

export interface AuthProps {
  logoUrl?: string;
  redirectUrl?: string;
  homeUrl?: string;
  ParticleBackgroundComponent?: React.ComponentType<{ useReducedMotion?: () => boolean }>;
  useReducedMotion?: () => boolean;
  onSuccess?: () => void;
}

const Auth = ({ 
  logoUrl, 
  redirectUrl,
  homeUrl = "/",
  ParticleBackgroundComponent,
  useReducedMotion,
  onSuccess
}: AuthProps) => {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion ? useReducedMotion() : false;
  const [isLoading, setIsLoading] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [otp, setOtp] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [resetEmailError, setResetEmailError] = useState("");
  const [otpError, setOtpError] = useState("");
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");

  const passwordStrength = calculatePasswordStrength(password);
  const appUrl = redirectUrl || import.meta.env.VITE_APP_URL || "http://localhost:8080";

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        if (onSuccess) {
          onSuccess();
        } else {
          navigate(homeUrl);
        }
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && event === "SIGNED_IN") {
        setIsSigningIn(true);
        if (onSuccess) {
          setTimeout(() => onSuccess(), 500);
        } else {
          setTimeout(() => {
            if (redirectUrl) {
              window.location.href = redirectUrl;
            } else {
              navigate(homeUrl);
            }
          }, 1500);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, homeUrl, redirectUrl, onSuccess]);

  const clearErrors = () => {
    setEmailError("");
    setPasswordError("");
    setResetEmailError("");
    setOtpError("");
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    
    // Validate input
    const validation = authSchema.safeParse({ email, password });
    if (!validation.success) {
      const error = validation.error.errors[0];
      if (error.path[0] === "email") {
        setEmailError(error.message);
      } else {
        setPasswordError(error.message);
      }
      return;
    }

    setIsLoading(true);
    
    const { error } = await supabase.auth.signUp({
      email: validation.data.email,
      password: validation.data.password,
    });

    setIsLoading(false);

    if (error) {
      if (error.message.includes("already registered") || error.message.includes("already exists")) {
        setEmailError("This email is already registered. Please sign in instead.");
      } else {
        setEmailError(error.message);
      }
    } else {
      setPendingEmail(validation.data.email);
      setShowOtpVerification(true);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    
    if (otp.length !== 6) {
      setOtpError("Please enter a 6-digit code");
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.verifyOtp({
      email: pendingEmail,
      token: otp,
      type: 'email'
    });

    setIsLoading(false);

    if (error) {
      setOtpError(error.message);
    } else {
      setShowOtpVerification(false);
      setOtp("");
      setPendingEmail("");
      setEmail("");
      setPassword("");
      setActiveTab("signin");
    }
  };

  const handleResendOtp = async () => {
    setIsLoading(true);
    
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: pendingEmail,
    });

    setIsLoading(false);

    if (error) {
      setOtpError(error.message);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    
    // Validate input
    const validation = authSchema.safeParse({ email, password });
    if (!validation.success) {
      const error = validation.error.errors[0];
      if (error.path[0] === "email") {
        setEmailError(error.message);
      } else {
        setPasswordError(error.message);
      }
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: validation.data.email,
      password: validation.data.password,
    });

    setIsLoading(false);

    if (error) {
      if (error.message.includes("Invalid login credentials") || error.message.includes("Invalid")) {
        setPasswordError("Invalid email or password");
      } else {
        setPasswordError(error.message);
      }
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    
    if (!resetEmail.trim()) {
      setResetEmailError("Please enter your email address");
      return;
    }

    const emailValidation = z.string().email().safeParse(resetEmail);
    if (!emailValidation.success) {
      setResetEmailError("Invalid email address");
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}${homeUrl}`,
    });

    setIsLoading(false);

    if (error) {
      setResetEmailError(error.message);
    } else {
      setShowForgotPassword(false);
      setResetEmail("");
    }
  };

  return (
    <>
      {/* Loading Overlay */}
      <AnimatePresence>
        {isSigningIn && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="text-center"
            >
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-lg font-medium">Signing you in...</p>
              <p className="text-sm text-muted-foreground mt-2">Redirecting to ProssMind</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-screen flex items-center justify-center brand-gradient-bg p-6 md:p-6 lg:p-8 relative overflow-hidden">
        {/* Background gradient overlay with blue-purple glow */}
        <div className="absolute inset-0 brand-gradient-bg opacity-95" />
        <div className="absolute inset-0 brand-gradient-bg-radial dark:bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.12),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(100,180,255,0.1),transparent_60%)]" />

        {/* 2-Panel Layout */}
        <div className="container max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 relative z-10">
          {/* Left Panel - Desktop only */}
          <div className="hidden lg:flex flex-col justify-center relative">
            {/* Logo and Tagline */}
            {logoUrl && (
              <motion.div 
                className="mb-8"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0 }}
              >
                <Link to={homeUrl} className="flex items-center space-x-3 mb-4 group">
                  <img 
                    src={logoUrl} 
                    alt="ProssMind Logo" 
                    className="h-10 w-auto group-hover:scale-105 transition-transform" 
                  />
                  <div className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    ProssMind
                  </div>
                </Link>
                <p className="text-xs text-muted-foreground">
                  Swiss AI Process Intelligence · GDPR Compliant
                </p>
              </motion.div>
            )}

            {/* Particle Background */}
            {!prefersReducedMotion && ParticleBackgroundComponent && (
              <div className="absolute inset-0 opacity-30">
                <ParticleBackgroundComponent useReducedMotion={useReducedMotion} />
              </div>
            )}

            {/* AI Illustration */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative mb-8 flex items-center justify-center"
            >
              <div className="relative w-32 h-32 flex items-center justify-center">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse" />
                
                {/* Brain icon with gradient */}
                <Brain className="w-24 h-24 text-primary relative z-10" strokeWidth={1.5} />
                
                {/* Sparkles around brain */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0"
                >
                  <Sparkles className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-6 text-primary/60" />
                  <Sparkles className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-6 text-primary/60" />
                  <Sparkles className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-6 text-primary/60" />
                  <Sparkles className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-6 text-primary/60" />
                </motion.div>
              </div>

              {/* Network connections */}
              <div className="absolute inset-0 pointer-events-none">
                <svg className="w-full h-full opacity-20">
                  <motion.line
                    x1="20%"
                    y1="30%"
                    x2="50%"
                    y2="50%"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-primary"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1, delay: 0.5 }}
                  />
                  <motion.line
                    x1="80%"
                    y1="30%"
                    x2="50%"
                    y2="50%"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-primary"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1, delay: 0.7 }}
                  />
                  <motion.line
                    x1="20%"
                    y1="70%"
                    x2="50%"
                    y2="50%"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-primary"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1, delay: 0.9 }}
                  />
                  <motion.line
                    x1="80%"
                    y1="70%"
                    x2="50%"
                    y2="50%"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-primary"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1, delay: 1.1 }}
                  />
                </svg>
              </div>

              {/* Floating nodes */}
              {[0, 1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  className="absolute w-3 h-3 bg-primary/40 rounded-full"
                  style={{
                    left: `${20 + i * 20}%`,
                    top: `${30 + (i % 2) * 40}%`,
                  }}
                  animate={{
                    y: [0, -10, 0],
                    opacity: [0.4, 0.8, 0.4],
                  }}
                  transition={{
                    duration: 2 + i * 0.5,
                    repeat: Infinity,
                    delay: i * 0.3,
                  }}
                />
              ))}
            </motion.div>

            {/* Welcome Message */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="relative z-10"
            >
              <h1 className="text-4xl font-semibold mb-3 text-foreground">
                Welcome to ProssMind Portal
              </h1>
              <p className="text-lg font-medium text-muted-foreground mb-2">
                AI-Driven Process Mining & Vision Intelligence
              </p>
              <p className="text-base text-muted-foreground/80">
                Transform your business processes with AI-powered intelligence
              </p>
            </motion.div>
          </div>

          {/* Right Panel - Auth Form */}
          <div className="flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="w-full max-w-md"
            >
              {/* Logo - Mobile only */}
              {logoUrl && (
                <div className="lg:hidden mb-6">
                  <Link to={homeUrl} className="flex items-center space-x-3 mb-2 group">
                    <img 
                      src={logoUrl} 
                      alt="ProssMind Logo" 
                      className="h-8 w-auto group-hover:scale-105 transition-transform" 
                    />
                    <div className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                      ProssMind
                    </div>
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    Swiss AI Process Intelligence · GDPR Compliant
                  </p>
                </div>
              )}

              <Card className="relative bg-card/80 dark:bg-card/70 backdrop-blur-xl shadow-2xl border border-primary/30 dark:border-primary/40 rounded-2xl shadow-[0_0_30px_rgba(100,180,255,0.3)] overflow-hidden">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent pointer-events-none opacity-50" />
                <div className="relative z-10">
                <CardHeader>
                  <CardTitle className="text-2xl font-semibold text-center text-foreground">Welcome to ProssMind</CardTitle>
                  <CardDescription className="text-center text-muted-foreground">
                    {activeTab === "signin" 
                      ? "Sign in to your account to continue"
                      : "Create an account to get started"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeTab} onValueChange={(v) => {
                    setActiveTab(v as "signin" | "signup");
                    clearErrors();
                  }} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="signin">Sign In</TabsTrigger>
                      <TabsTrigger value="signup">Sign Up</TabsTrigger>
                    </TabsList>
                  
                    <AnimatePresence mode="wait">
                      <TabsContent value="signin" className="mt-6" key="signin">
                        <motion.form 
                          onSubmit={handleSignIn} 
                          className="space-y-4"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ duration: 0.3 }}
                        >
                        <motion.div 
                          className="space-y-2"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: 0.1 }}
                        >
                          <Label htmlFor="signin-email" className="text-foreground">Email</Label>
                          <Input
                            id="signin-email"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => {
                              setEmail(e.target.value);
                              setEmailError("");
                            }}
                            required
                            disabled={isLoading}
                            className={`min-h-[44px] h-12 md:h-10 px-4 py-3 bg-background dark:bg-[#2A2A2A] border-input dark:border-[#3A3A3A] text-foreground ${emailError ? "border-destructive" : ""}`}
                            aria-invalid={!!emailError}
                            aria-describedby={emailError ? "signin-email-error" : undefined}
                          />
                          {emailError && (
                            <motion.p
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              id="signin-email-error"
                              className="text-destructive text-sm flex items-center gap-1"
                              role="alert"
                              aria-live="polite"
                            >
                              <AlertCircle className="h-4 w-4" />
                              {emailError}
                            </motion.p>
                          )}
                        </motion.div>
                        <motion.div 
                          className="space-y-2"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: 0.2 }}
                        >
                          <div className="flex items-center gap-2">
                            <Label htmlFor="signin-password" className="text-foreground">Password</Label>
                            <Lock className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                          </div>
                          <div className="relative">
                            <Input
                              id="signin-password"
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••"
                              value={password}
                              onChange={(e) => {
                                setPassword(e.target.value);
                                setPasswordError("");
                              }}
                              required
                              disabled={isLoading}
                              className={`min-h-[44px] h-12 md:h-10 px-4 py-3 pr-10 bg-background dark:bg-[#2A2A2A] border-input dark:border-[#3A3A3A] text-foreground ${passwordError ? "border-destructive" : ""}`}
                              aria-invalid={!!passwordError}
                              aria-describedby={passwordError ? "signin-password-error" : undefined}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                              aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          {passwordError && (
                            <motion.p
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              id="signin-password-error"
                              className="text-destructive text-sm flex items-center gap-1"
                              role="alert"
                              aria-live="polite"
                            >
                              <AlertCircle className="h-4 w-4" />
                              {passwordError}
                            </motion.p>
                          )}
                        </motion.div>
                        <motion.div 
                          whileTap={{ scale: 0.98 }}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: 0.3 }}
                          className="space-y-3"
                        >
                          <Button 
                            type="submit" 
                            variant="gradient"
                            className="w-full rounded-full" 
                            disabled={isLoading}
                            showArrow={!isLoading}
                            loading={isLoading}
                          >
                            {isLoading ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Signing in...
                              </>
                            ) : (
                              "Sign In"
                            )}
                          </Button>
                          <Button 
                            type="button" 
                            variant="link" 
                            className="w-full text-sm text-center"
                            onClick={() => setShowForgotPassword(true)}
                          >
                            Forgot password?
                          </Button>
                        </motion.div>
                        </motion.form>
                      </TabsContent>
                    
                      <TabsContent value="signup" className="mt-6" key="signup">
                        <motion.form 
                          onSubmit={handleSignUp} 
                          className="space-y-4"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.3 }}
                        >
                        <motion.div 
                          className="space-y-2"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: 0.1 }}
                        >
                          <Label htmlFor="signup-email" className="text-foreground">Email</Label>
                          <Input
                            id="signup-email"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => {
                              setEmail(e.target.value);
                              setEmailError("");
                            }}
                            required
                            disabled={isLoading}
                            className={`min-h-[44px] h-12 md:h-10 px-4 py-3 bg-background dark:bg-[#2A2A2A] border-input dark:border-[#3A3A3A] text-foreground ${emailError ? "border-destructive" : ""}`}
                            aria-invalid={!!emailError}
                            aria-describedby={emailError ? "signup-email-error" : undefined}
                          />
                          {emailError && (
                            <motion.p
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              id="signup-email-error"
                              className="text-destructive text-sm flex items-center gap-1"
                              role="alert"
                              aria-live="polite"
                            >
                              <AlertCircle className="h-4 w-4" />
                              {emailError}
                            </motion.p>
                          )}
                        </motion.div>
                        <motion.div 
                          className="space-y-2"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: 0.2 }}
                        >
                          <div className="flex items-center gap-2">
                            <Label htmlFor="signup-password" className="text-foreground">Password</Label>
                            <Lock className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                          </div>
                          <div className="relative">
                            <Input
                              id="signup-password"
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••"
                              value={password}
                              onChange={(e) => {
                                setPassword(e.target.value);
                                setPasswordError("");
                              }}
                              required
                              disabled={isLoading}
                              className={`min-h-[44px] h-12 md:h-10 px-4 py-3 pr-10 bg-background dark:bg-[#2A2A2A] border-input dark:border-[#3A3A3A] text-foreground ${passwordError ? "border-destructive" : ""}`}
                              aria-invalid={!!passwordError}
                              aria-describedby={passwordError ? "signup-password-error" : undefined}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                              aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          {/* Password Strength Indicator */}
                          {password.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              className="space-y-1"
                            >
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: passwordStrength === "weak" ? "33%" : passwordStrength === "medium" ? "66%" : "100%" }}
                                    transition={{ duration: 0.3 }}
                                    className={`h-full rounded-full ${
                                      passwordStrength === "weak" 
                                        ? "bg-destructive" 
                                        : passwordStrength === "medium" 
                                        ? "bg-yellow-500" 
                                        : "bg-green-500"
                                    }`}
                                  />
                                </div>
                                <span className={`text-xs font-medium ${
                                  passwordStrength === "weak" 
                                    ? "text-destructive" 
                                    : passwordStrength === "medium" 
                                    ? "text-yellow-500" 
                                    : "text-green-500"
                                }`}>
                                  {passwordStrength === "weak" ? "Weak" : passwordStrength === "medium" ? "Medium" : "Strong"}
                                </span>
                              </div>
                            </motion.div>
                          )}
                          {passwordError && (
                            <motion.p
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              id="signup-password-error"
                              className="text-destructive text-sm flex items-center gap-1"
                              role="alert"
                              aria-live="polite"
                            >
                              <AlertCircle className="h-4 w-4" />
                              {passwordError}
                            </motion.p>
                          )}
                          {password.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                              Password must be at least 6 characters
                            </p>
                          )}
                        </motion.div>
                        <motion.div 
                          whileTap={{ scale: 0.98 }}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: 0.3 }}
                        >
                          <Button 
                            type="submit" 
                            variant="gradient"
                            className="w-full rounded-full" 
                            disabled={isLoading}
                            showArrow={!isLoading}
                            loading={isLoading}
                          >
                            {isLoading ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Creating account...
                              </>
                            ) : (
                              "Sign Up"
                            )}
                          </Button>
                        </motion.div>
                        </motion.form>
                      </TabsContent>
                    </AnimatePresence>
                  </Tabs>
                </CardContent>
                </div>
              </Card>

              {/* Trust Signals */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.6 }}
                className="mt-6 space-y-4"
              >
                {/* Security Badges */}
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-foreground">
                    <Shield className="h-3 w-3 text-primary" />
                    <span>Trusted by Enterprises</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-xs font-medium text-foreground">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span>GDPR Compliant</span>
                  </div>
                </div>

                {/* Trust Footer */}
                <div className="text-center space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Securely hosted in Switzerland · GDPR Compliant · SOC 2 Pending
                  </p>
                  <div className="flex items-center justify-center gap-4 text-xs">
                    <Link 
                      to="/privacy" 
                      className="text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
                    >
                      Privacy Policy
                    </Link>
                    <span className="text-muted-foreground">·</span>
                    <Link 
                      to="/terms" 
                      className="text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
                    >
                      Terms of Use
                    </Link>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Forgot Password Dialog */}
        <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>
                Enter your email address and we'll send you a link to reset your password.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="you@example.com"
                  value={resetEmail}
                  onChange={(e) => {
                    setResetEmail(e.target.value);
                    setResetEmailError("");
                  }}
                  required
                  disabled={isLoading}
                  className={resetEmailError ? "border-destructive" : ""}
                  aria-invalid={!!resetEmailError}
                  aria-describedby={resetEmailError ? "reset-email-error" : undefined}
                />
                {resetEmailError && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    id="reset-email-error"
                    className="text-destructive text-sm flex items-center gap-1"
                    role="alert"
                    aria-live="polite"
                  >
                    <AlertCircle className="h-4 w-4" />
                    {resetEmailError}
                  </motion.p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetEmail("");
                    setResetEmailError("");
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <motion.div whileTap={{ scale: 0.98 }} className="flex-1">
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send Reset Link"
                    )}
                  </Button>
                </motion.div>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* OTP Verification Dialog */}
        <Dialog open={showOtpVerification} onOpenChange={setShowOtpVerification}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Verify Your Email</DialogTitle>
              <DialogDescription>
                We've sent a 6-digit verification code to {pendingEmail}. Please enter it below.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">Verification Code</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setOtpError("");
                  }}
                  maxLength={6}
                  required
                  disabled={isLoading}
                  className={`text-center text-2xl tracking-widest ${otpError ? "border-destructive" : ""}`}
                  aria-invalid={!!otpError}
                  aria-describedby={otpError ? "otp-error" : undefined}
                />
                {otpError && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    id="otp-error"
                    className="text-destructive text-sm flex items-center gap-1"
                    role="alert"
                    aria-live="polite"
                  >
                    <AlertCircle className="h-4 w-4" />
                    {otpError}
                  </motion.p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowOtpVerification(false);
                    setOtp("");
                    setOtpError("");
                  }}
                  className="flex-1"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <motion.div whileTap={{ scale: 0.98 }} className="flex-1">
                  <Button type="submit" className="w-full" disabled={isLoading || otp.length !== 6}>
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Verify Email"
                    )}
                  </Button>
                </motion.div>
              </div>
              <Button
                type="button"
                variant="link"
                className="w-full text-sm"
                onClick={handleResendOtp}
                disabled={isLoading}
              >
                Didn't receive the code? Resend
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default Auth;

