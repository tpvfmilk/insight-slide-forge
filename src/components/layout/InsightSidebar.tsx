
import { Calendar, Droplet, File, LayoutDashboard, Settings, Upload } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Sidebar, 
  SidebarContent, 
  SidebarFooter, 
  SidebarHeader, 
  SidebarTrigger,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '../shared/ThemeToggle';
import { UserProfileButton } from '@/components/auth/UserProfileButton';

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
            <Droplet className="h-5 w-5" />
          </div>
          <span className="font-semibold text-lg">Distill</span>
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
          <UserProfileButton />
          <div className="flex-1">
            <ThemeToggle />
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};
