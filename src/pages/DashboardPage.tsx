
import { ApiKeyCard } from "@/components/dashboard/ApiKeyCard";
import { RecentProjects } from "@/components/dashboard/RecentProjects";
import { UsageStats } from "@/components/dashboard/UsageStats";
import { StorageUsageBar } from "@/components/dashboard/StorageUsageBar";
import { InsightLayout } from "@/components/layout/InsightLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Upload } from "lucide-react";
import { Link } from "react-router-dom";

const DashboardPage = () => {
  return (
    <InsightLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">
              Manage your projects and analyze usage statistics
            </p>
          </div>
          <Button asChild>
            <Link to="/upload">
              <Upload className="h-4 w-4 mr-2" />
              New Upload
            </Link>
          </Button>
        </div>
        
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="storage">Storage</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-6">
            <ApiKeyCard />
            <UsageStats />
            <RecentProjects />
          </TabsContent>
          
          <TabsContent value="storage" className="space-y-6">
            <div className="border rounded-lg shadow-sm">
              <StorageUsageBar hidden={false} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </InsightLayout>
  );
};

export default DashboardPage;
