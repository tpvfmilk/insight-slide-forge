
import { Calendar, File, Layout, LayoutDashboard, Settings, Upload, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Sidebar, 
  SidebarContent, 
  SidebarFooter, 
  SidebarHeader, 
  SidebarTrigger,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '../shared/ThemeToggle';

export const InsightSidebar = () => {
  const location = useLocation();
  
  const navItems = [
    { title: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { title: 'Upload', path: '/upload', icon: Upload },
    { title: 'Projects', path: '/projects', icon: File },
    { title: 'Calendar', path: '/calendar', icon: Calendar },
    { title: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <Sidebar>
      <SidebarHeader className="flex items-center h-14 px-4 border-b">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary text-primary-foreground">
            <Layout className="h-5 w-5" />
          </div>
          <span className="font-semibold text-lg">InsightSlide</span>
        </Link>
        <div className="flex-1" />
        <SidebarTrigger />
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton asChild>
                    <Link 
                      to={item.path} 
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors",
                        location.pathname === item.path && "bg-accent text-accent-foreground font-medium"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="p-4 border-t">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="rounded-full">
            <User className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="font-medium text-sm">User Account</div>
            <div className="text-xs text-muted-foreground">Free Plan</div>
          </div>
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};
