
import { Button } from "@/components/ui/button";
import { Droplet, Home, UsersRound, FilePlus, AlignLeft, ChevronRight, HardDrive } from "lucide-react";
import { useLocation, Link } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEffect, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { UsageStatistics, fetchTotalUsageStats, formatStorageSize } from "@/services/usageService";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InsightSidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [usageStats, setUsageStats] = useState<UsageStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    if (isMobile && isOpen) {
      // Close sidebar on mobile after navigation
      onClose();
    }
  }, [location.pathname, isMobile, isOpen, onClose]);

  useEffect(() => {
    // Fetch storage usage data
    const loadUsageStats = async () => {
      try {
        setIsLoading(true);
        const stats = await fetchTotalUsageStats();
        setUsageStats(stats);
      } catch (error) {
        console.error("Failed to load storage stats:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadUsageStats();
  }, []);

  const navItems = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: <Home className="h-4 w-4" />,
    },
    {
      title: "Upload",
      href: "/upload",
      icon: <FilePlus className="h-4 w-4" />,
    },
    {
      title: "Projects",
      href: "/projects",
      icon: <AlignLeft className="h-4 w-4" />,
    },
  ];

  // Calculate storage percentage
  const storagePercentage = usageStats?.storagePercentage || 0;
  const storageUsed = usageStats?.storageUsed || 0;
  const storageLimit = usageStats?.storageLimit || 0;
  const tierName = usageStats?.tierName || 'Free';

  return (
    <div
      className={cn(
        "fixed top-0 left-0 flex flex-col w-64 h-full bg-background border-r z-40 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static",
        isOpen ? "translate-x-0" : "-translate-x-full",
        isMobile ? "bg-background/95 backdrop-blur-sm" : ""
      )}
    >
      <div className="flex items-center justify-between h-14 px-4 border-b">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary text-primary-foreground">
            <Droplet className="h-5 w-5" />
          </div>
          <span className="font-semibold">Distill</span>
        </Link>
        {isMobile && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Close Sidebar</span>
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="flex flex-col gap-1">
          {navItems.map((item) => (
            <Button
              key={item.href}
              variant={location.pathname === item.href ? "secondary" : "ghost"}
              className="justify-start"
              size="sm"
              asChild
            >
              <Link to={item.href}>
                {item.icon}
                <span className="ml-2">{item.title}</span>
              </Link>
            </Button>
          ))}
        </div>

        <Separator className="my-4" />
      </div>

      <div className="p-4 border-t">
        {/* Storage usage bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center text-sm mb-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center text-muted-foreground hover:text-foreground cursor-pointer">
                    <HardDrive className="h-4 w-4 mr-1" />
                    <span>Storage ({tierName})</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Storage usage for your account</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <span className="text-xs">
              {formatStorageSize(storageUsed)} / {formatStorageSize(storageLimit)}
            </span>
          </div>
          <Progress value={storagePercentage} 
            className={cn(
              "h-2 transition-colors",
              storagePercentage > 90 ? "bg-red-200" : 
              storagePercentage > 75 ? "bg-amber-200" : "bg-secondary"
            )}
          />
        </div>
        
        <div className="flex justify-between items-center">
          <Button variant="outline" size="sm" asChild>
            <Link to="/settings">
              <UsersRound className="h-4 w-4 mr-2" />
              Account
            </Link>
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
