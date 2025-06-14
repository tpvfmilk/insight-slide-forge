
import { ReactNode, useState } from 'react';
import { Toaster } from "@/components/ui/sonner";
import { InsightSidebar } from './InsightSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';

interface InsightLayoutProps {
  children: ReactNode;
}

export const InsightLayout = ({ children }: InsightLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const handleCloseSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full overflow-x-hidden">
        <InsightSidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} />
        <div className="flex-1 flex flex-col overflow-x-hidden">
          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            {children}
          </main>
        </div>
      </div>
      <Toaster />
    </SidebarProvider>
  );
};
