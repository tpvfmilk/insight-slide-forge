
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Layout } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

type FormType = "login" | "register" | "reset";

interface AuthFormProps {
  type: FormType;
}

export const AuthForm = ({ type }: AuthFormProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Here we would integrate with Supabase Auth
    // This is a placeholder until Supabase is connected
    
    setIsLoading(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (type === "login") {
        toast.success("Login successful! Redirecting...");
        // Redirect would happen here
      } else if (type === "register") {
        toast.success("Registration successful! Please check your email to verify your account.");
      } else if (type === "reset") {
        toast.success("Password reset link has been sent to your email.");
      }
      
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const formTitle = type === "login" 
    ? "Sign in to your account" 
    : type === "register" 
      ? "Create an account" 
      : "Reset your password";
  
  const formDescription = type === "login" 
    ? "Enter your email and password to access your account" 
    : type === "register" 
      ? "Enter your details to create a new account" 
      : "Enter your email to receive a password reset link";
  
  const buttonText = type === "login" 
    ? "Sign In" 
    : type === "register" 
      ? "Create Account" 
      : "Send Reset Link";
  
  return (
    <div className="mx-auto max-w-md space-y-6 p-6 bg-card rounded-lg border shadow-sm w-full">
      <div className="flex flex-col space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
          <Layout className="h-6 w-6 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold">{formTitle}</h1>
        <p className="text-sm text-muted-foreground">{formDescription}</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="insight-label">Email</label>
          <Input 
            id="email" 
            type="email" 
            placeholder="name@example.com" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        
        {type !== "reset" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="insight-label">Password</label>
              {type === "login" && (
                <Link to="/reset-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              )}
            </div>
            <Input 
              id="password" 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
        )}
        
        {type === "register" && (
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="insight-label">Confirm Password</label>
            <Input 
              id="confirmPassword" 
              type="password" 
              placeholder="••••••••" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
        )}
        
        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? "Please wait..." : buttonText}
        </Button>
      </form>
      
      {type === "login" ? (
        <div className="text-center text-sm">
          Don't have an account?{" "}
          <Link to="/register" className="text-primary hover:underline">
            Sign up
          </Link>
        </div>
      ) : type === "register" ? (
        <div className="text-center text-sm">
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </div>
      ) : (
        <div className="text-center text-sm">
          Remember your password?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </div>
      )}
    </div>
  );
};
