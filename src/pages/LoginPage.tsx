
import { AuthForm } from "@/components/auth/AuthForm";
import { Button } from "@/components/ui/button";
import { Droplet } from "lucide-react";
import { Link } from "react-router-dom";

const LoginPage = () => {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Simple header */}
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary text-primary-foreground">
              <Droplet className="h-5 w-5" />
            </div>
            <span className="font-semibold text-lg">Distill</span>
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link to="/">Back to Home</Link>
          </Button>
        </div>
      </header>
      
      <main className="flex-1 flex items-center justify-center p-4">
        <AuthForm type="login" />
      </main>
      
      <footer className="py-4 border-t">
        <div className="container">
          <div className="text-center text-sm text-muted-foreground">
            &copy; 2025 Distill. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LoginPage;
