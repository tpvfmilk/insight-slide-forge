import { InsightLayout } from "@/components/layout/InsightLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { toast } from "sonner";
import { ProfileForm } from "@/components/auth/ProfileForm";
import { useAuth } from "@/context/AuthContext";

const SettingsPage = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const { signOut } = useAuth();
  
  const handlePasswordSave = () => {
    toast.success("Password updated successfully!");
  };
  
  const handlePreferencesSave = () => {
    toast.success("Preferences updated successfully!");
  };

  const handleDeleteAccount = () => {
    if (window.confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      // In a real app, you'd call an API to delete the account
      toast.success("Account deleted successfully");
      signOut();
    }
  };
  
  return (
    <InsightLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </div>
        
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile" className="space-y-6">
            <div className="border rounded-lg p-6 space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">Personal Information</h2>
                <ProfileForm />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="account" className="space-y-6">
            <div className="border rounded-lg p-6 space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">Change Password</h2>
                <div className="space-y-4 max-w-md">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current Password</Label>
                    <Input id="current-password" type="password" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input id="new-password" type="password" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input id="confirm-password" type="password" />
                  </div>
                  
                  <div>
                    <Button onClick={handlePasswordSave}>Update Password</Button>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h2 className="text-xl font-semibold mb-4">API Key Management</h2>
                <div className="space-y-4 max-w-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">OpenAI API Key</h3>
                      <p className="text-sm text-muted-foreground">Stored securely for slide generation</p>
                    </div>
                    <Button variant="outline">Manage</Button>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h2 className="text-xl font-semibold text-destructive mb-4">Danger Zone</h2>
                <div className="space-y-4 max-w-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">Delete Account</h3>
                      <p className="text-sm text-muted-foreground">
                        This action is permanent and cannot be undone
                      </p>
                    </div>
                    <Button 
                      variant="destructive"
                      onClick={handleDeleteAccount}
                    >
                      Delete Account
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="preferences" className="space-y-6">
            <div className="border rounded-lg p-6 space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">User Interface</h2>
                <div className="space-y-4 max-w-md">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="dark-mode">Dark Mode</Label>
                      <div className="text-sm text-muted-foreground">
                        Switch between light and dark theme
                      </div>
                    </div>
                    <Switch 
                      id="dark-mode" 
                      checked={darkMode}
                      onCheckedChange={setDarkMode}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Select defaultValue="en">
                      <SelectTrigger id="language">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h2 className="text-xl font-semibold mb-4">AI Model Settings</h2>
                <div className="space-y-4 max-w-md">
                  <div className="space-y-2">
                    <Label htmlFor="default-model">Default Model</Label>
                    <Select defaultValue="gpt-3.5-turbo">
                      <SelectTrigger id="default-model">
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                        <SelectItem value="gpt-4">GPT-4</SelectItem>
                        <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h2 className="text-xl font-semibold mb-4">Notifications</h2>
                <div className="space-y-4 max-w-md">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="email-notifications">Email Notifications</Label>
                      <div className="text-sm text-muted-foreground">
                        Receive emails when slide generation is complete
                      </div>
                    </div>
                    <Switch 
                      id="email-notifications" 
                      checked={emailNotifications}
                      onCheckedChange={setEmailNotifications}
                    />
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-start space-x-2">
                      <Checkbox id="notify-processing" />
                      <div>
                        <Label 
                          htmlFor="notify-processing" 
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Processing Updates
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Notify when your video is being processed
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-2">
                      <Checkbox id="notify-completion" defaultChecked />
                      <div>
                        <Label 
                          htmlFor="notify-completion" 
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Completion Alerts
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Notify when your slide deck is ready
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-2">
                      <Checkbox id="notify-expiry" defaultChecked />
                      <div>
                        <Label 
                          htmlFor="notify-expiry" 
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Expiration Warning
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Notify 24 hours before a project is set to expire
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <Button onClick={handlePreferencesSave}>Save Preferences</Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </InsightLayout>
  );
};

export default SettingsPage;
