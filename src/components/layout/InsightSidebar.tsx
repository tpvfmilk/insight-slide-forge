import { Button } from "@/components/ui/button";
import { Droplet, Home, UsersRound, FilePlus, Folder as FolderIcon, ChevronRight } from "lucide-react";
import { useLocation, Link } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEffect } from "react";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { cn } from "@/lib/utils";
import { StorageUsageBar } from "@/components/dashboard/StorageUsageBar";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InsightSidebar({
  isOpen,
  onClose
}: SidebarProps) {
  const location = useLocation();
  const isMobile = useIsMobile();
  useEffect(() => {
    if (isMobile && isOpen) {
      // Close sidebar on mobile after navigation
      onClose();
    }
  }, [location.pathname, isMobile, isOpen, onClose]);
  const navItems = [{
    title: "Dashboard",
    href: "/dashboard",
    icon: <Home className="h-4 w-4" />
  }, {
    title: "Upload",
    href: "/upload",
    icon: <FilePlus className="h-4 w-4" />
  }, {
    title: "Projects",
    href: "/projects",
    icon: <FolderIcon className="h-4 w-4" />
  }];
  return <div className={cn(
    "fixed top-0 left-0 flex flex-col w-64 h-full bg-background border-r z-40 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static overflow-hidden",
    isOpen ? "translate-x-0" : "-translate-x-full",
    isMobile ? "bg-background/95 backdrop-blur-sm" : ""
  )}>
      <div className="flex items-center justify-between h-14 border-b px-[10px]">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary text-primary-foreground">
            <Droplet className="h-5 w-5" />
          </div>
          <span className="font-semibold">Distill</span>
        </Link>
        {isMobile && <Button variant="ghost" size="sm" onClick={onClose}>
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Close Sidebar</span>
          </Button>}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="flex flex-col gap-1">
          {navItems.map(item => <Button key={item.href} variant={location.pathname === item.href ? "secondary" : "ghost"} className="justify-start" size="sm" asChild>
              <Link to={item.href}>
                {item.icon}
                <span className="ml-2">{item.title}</span>
              </Link>
            </Button>)}
        </div>

        <Separator className="my-4" />
      </div>

      <div className="my-0 py-0">
        <StorageUsageBar />
      </div>

      <div className="p-4 border-t flex justify-between items-center">
        <Button variant="outline" size="sm" asChild>
          <Link to="/settings">
            <UsersRound className="h-4 w-4 mr-2" />
            Account
          </Link>
        </Button>
        <ThemeToggle />
      </div>
    </div>;
}
