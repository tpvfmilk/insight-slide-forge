
import { ApiKeyCard } from "@/components/dashboard/ApiKeyCard";
import { RecentProjects } from "@/components/dashboard/RecentProjects";
import { UsageStats } from "@/components/dashboard/UsageStats";
import { InsightLayout } from "@/components/layout/InsightLayout";
import { Button } from "@/components/ui/button";
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-2">
            <ApiKeyCard />
          </div>
          <RecentProjects />
          <UsageStats />
        </div>
      </div>
    </InsightLayout>
  );
};

export default DashboardPage;
