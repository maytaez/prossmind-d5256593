import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [otp, setOtp] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");

  useEffect(() => {
    // Check if user is already logged in
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


  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Welcome to ProssMind</CardTitle>
          <CardDescription className="text-center">
            {showOtpVerification
              ? "Verify your email"
              : "Sign in to start generating BPMN diagrams"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showOtpVerification ? (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowOtpVerification(false);
                  setOtp("");
                  setPendingEmail("");
                }}
                className="mb-4 p-0 h-auto"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to sign up
              </Button>
              <div className="space-y-2">
                <Label htmlFor="otp">Verification Code</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  required
                  disabled={isLoading}
                  className="text-center text-2xl tracking-widest"
                />
                <p className="text-xs text-muted-foreground text-center">
                  Enter the 6-digit code sent to {pendingEmail}
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading || otp.length !== 6}>
                {isLoading ? "Verifying..." : "Verify Email"}
              </Button>
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
          ) : (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  id="signin-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">Password</Label>
                <Input
                  id="signin-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
