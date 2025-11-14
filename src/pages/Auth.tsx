<<<<<<< Updated upstream
import { Auth, ParticleBackground } from "@prossmind/shared/components";
import prossmindLogo from "@/assets/prossmind-logo-transparent.png";
import { useReducedMotion } from "@prossmind/shared/context";

const AuthPage = () => {
  const prefersReducedMotion = useReducedMotion();
  const appUrl = import.meta.env.VITE_APP_URL || "http://localhost:8080";
=======
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";

const authSchema = z.object({
  email: z.string().email("Invalid email address").max(255, "Email too long"),
  password: z.string().min(6, "Password must be at least 6 characters").max(100, "Password too long"),
});

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [otp, setOtp] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");

  useEffect(() => {
    // Check if user is already logged in
    if (!isSupabaseConfigured) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      toast({
        variant: "destructive",
        title: "Authentication unavailable",
        description: "Supabase environment variables are not configured. Contact the workspace owner.",
      });
      return;
    }

    // Validate input
    const validation = authSchema.safeParse({ email, password });
    if (!validation.success) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: validation.error.errors[0].message,
      });
      return;
    }

    setIsLoading(true);
    
    const { error } = await supabase.auth.signUp({
      email: validation.data.email,
      password: validation.data.password,
    });

    setIsLoading(false);

    if (error) {
      if (error.message.includes("already registered")) {
        toast({
          variant: "destructive",
          title: "Account exists",
          description: "This email is already registered. Please sign in instead.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Sign up failed",
          description: error.message,
        });
      }
    } else {
      setPendingEmail(validation.data.email);
      setShowOtpVerification(true);
      toast({
        title: "Check your email!",
        description: "We've sent you a 6-digit verification code. Please enter it below.",
      });
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (otp.length !== 6) {
      toast({
        variant: "destructive",
        title: "Invalid OTP",
        description: "Please enter a 6-digit code",
      });
      return;
    }

    setIsLoading(true);

    if (!isSupabaseConfigured) {
      toast({
        variant: "destructive",
        title: "Authentication unavailable",
        description: "Supabase environment variables are not configured. Contact the workspace owner.",
      });
      return;
    }

    const { error } = await supabase.auth.verifyOtp({
      email: pendingEmail,
      token: otp,
      type: 'email'
    });

    setIsLoading(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Verification failed",
        description: error.message,
      });
    } else {
      toast({
        title: "Success!",
        description: "Your email has been verified. You can now sign in.",
      });
      setShowOtpVerification(false);
      setOtp("");
      setPendingEmail("");
      setEmail("");
      setPassword("");
    }
  };

  const handleResendOtp = async () => {
    setIsLoading(true);
    
    if (!isSupabaseConfigured) {
      toast({
        variant: "destructive",
        title: "Authentication unavailable",
        description: "Supabase environment variables are not configured. Contact the workspace owner.",
      });
      return;
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: pendingEmail,
    });

    setIsLoading(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Resend failed",
        description: error.message,
      });
    } else {
      toast({
        title: "OTP Resent",
        description: "Check your email for a new verification code.",
      });
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate input
    const validation = authSchema.safeParse({ email, password });
    if (!validation.success) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: validation.error.errors[0].message,
      });
      return;
    }

    setIsLoading(true);

    if (!isSupabaseConfigured) {
      toast({
        variant: "destructive",
        title: "Authentication unavailable",
        description: "Supabase environment variables are not configured. Contact the workspace owner.",
      });
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: validation.data.email,
      password: validation.data.password,
    });

    setIsLoading(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Sign in failed",
        description: error.message,
      });
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetEmail.trim()) {
      toast({
        variant: "destructive",
        title: "Email required",
        description: "Please enter your email address",
      });
      return;
    }

    setIsLoading(true);

    if (!isSupabaseConfigured) {
      toast({
        variant: "destructive",
        title: "Authentication unavailable",
        description: "Supabase environment variables are not configured. Contact the workspace owner.",
      });
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/`,
    });

    setIsLoading(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Password reset failed",
        description: error.message,
      });
    } else {
      toast({
        title: "Check your email",
        description: "We've sent you a password reset link",
      });
      setShowForgotPassword(false);
      setResetEmail("");
    }
  };
>>>>>>> Stashed changes

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Authentication Unavailable</CardTitle>
            <CardDescription className="text-center">
              Supabase environment variables are missing. Configure the following in your `.env` and restart the app:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-4 text-sm">
              <p className="font-medium mb-2">Required variables</p>
              <ul className="list-disc list-inside space-y-1">
                <li><code>VITE_SUPABASE_URL</code></li>
                <li><code>VITE_SUPABASE_ANON_KEY</code> or <code>VITE_SUPABASE_PUBLISHABLE_KEY</code></li>
              </ul>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              After setting these values, restart <code>npm run dev</code> and reload this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Auth
      logoUrl={prossmindLogo}
      redirectUrl={appUrl}
      homeUrl="/"
      ParticleBackgroundComponent={ParticleBackground}
      useReducedMotion={useReducedMotion}
    />
  );
};

export default AuthPage;
