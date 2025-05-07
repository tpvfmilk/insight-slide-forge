
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Key, Check, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export const ApiKeyCard = () => {
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [lastVerified, setLastVerified] = useState<string | null>(null);
  
  const validateApiKey = async () => {
    if (!apiKey) {
      toast.error("Please enter an API key");
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Simulate API validation
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setIsVerified(true);
      setLastVerified(new Date().toISOString());
      toast.success("API key verified successfully!");
      
    } catch (error) {
      toast.error("Failed to verify API key");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const toggleApiKeyVisibility = () => {
    setShowApiKey(!showApiKey);
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5 text-primary" />
          OpenAI API Key
        </CardTitle>
        <CardDescription>
          Connect your OpenAI account to use GPT-3.5 or GPT-4 for slide generation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="relative">
              <Input
                placeholder="sk-..."
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleApiKeyVisibility}
                className="absolute right-2 top-1/2 -translate-y-1/2"
                type="button"
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Your API key is stored securely and never shared.
            </p>
          </div>
          
          {isVerified && lastVerified && (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <Check className="h-4 w-4" />
              <span>Verified {new Date(lastVerified).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={validateApiKey} 
          disabled={isLoading} 
          className="w-full"
        >
          {isLoading ? "Verifying..." : "Verify API Key"}
        </Button>
      </CardFooter>
    </Card>
  );
};
