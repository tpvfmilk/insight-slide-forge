import React, { useState, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ReactQueryDevtools } from 'react-query/devtools';
import { useAuth } from './hooks/useAuth';
import { supabase } from './integrations/supabase/client';
import { Auth } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { Upload } from './pages/Upload';
import { Projects } from './pages/Projects';
import { ProjectDetail } from './pages/ProjectDetail';
import { Settings } from './pages/Settings';
import { SlideEditor } from './pages/SlideEditor';
import { PresentationView } from './pages/PresentationView';
import { InsightSidebar } from './components/layout/InsightSidebar';
import { EmergencyResetButton } from './components/ui/EmergencyResetButton';
import { UIResetProvider } from './context/UIResetContext';
import { ThemeProvider } from './components/shared/ThemeProvider';
import { Toaster } from '@/components/ui/toaster';

import { ProgressProvider } from '@/context/ProgressContext';

// Define a type for the Supabase session
type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
} | null;

const queryClient = new QueryClient();

function App() {
  const { authStatus, setAuthStatus } = useAuth();
  const [supabaseSession, setSupabaseSession] = useState<SupabaseSession>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    // Check the initial auth status on app load
    const checkAuthStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSupabaseSession(session);
      setAuthStatus(!!session);
    };

    checkAuthStatus();

    // Set up a real-time listener for auth changes
    supabase.auth.onAuthStateChange((event, session) => {
      setSupabaseSession(session);
      setAuthStatus(!!session);
    });
  }, [setAuthStatus]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <ProgressProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="system" storageKey="vite-react-theme">
          <UIResetProvider>
            <Router>
              <div className="flex h-screen bg-background antialiased">
                {authStatus && (
                  <InsightSidebar
                    isOpen={isSidebarOpen}
                    onClose={() => setIsSidebarOpen(false)}
                  />
                )}
                <div className="flex flex-1 flex-col overflow-hidden">
                  <main className="relative flex-1 overflow-y-auto focus:outline-none">
                    <Routes>
                      <Route
                        path="/auth"
                        element={
                          !authStatus ? (
                            <Auth />
                          ) : (
                            <Navigate to="/dashboard" replace />
                          )
                        }
                      />
                      <Route
                        path="/dashboard"
                        element={
                          authStatus ? (
                            <Dashboard toggleSidebar={toggleSidebar} />
                          ) : (
                            <Navigate to="/auth" replace />
                          )
                        }
                      />
                      <Route
                        path="/upload"
                        element={
                          authStatus ? (
                            <Upload toggleSidebar={toggleSidebar} />
                          ) : (
                            <Navigate to="/auth" replace />
                          )
                        }
                      />
                      <Route
                        path="/projects"
                        element={
                          authStatus ? (
                            <Projects toggleSidebar={toggleSidebar} />
                          ) : (
                            <Navigate to="/auth" replace />
                          )
                        }
                      />
                      <Route
                        path="/projects/:projectId"
                        element={
                          authStatus ? (
                            <ProjectDetail toggleSidebar={toggleSidebar} />
                          ) : (
                            <Navigate to="/auth" replace />
                          )
                        }
                      />
                      <Route
                        path="/projects/:projectId/edit/:slideId"
                        element={
                          authStatus ? (
                            <SlideEditor toggleSidebar={toggleSidebar} />
                          ) : (
                            <Navigate to="/auth" replace />
                          )
                        }
                      />
                      <Route
                        path="/projects/:projectId/present"
                        element={
                          authStatus ? (
                            <PresentationView />
                          ) : (
                            <Navigate to="/auth" replace />
                          )
                        }
                      />
                      <Route
                        path="/settings"
                        element={
                          authStatus ? (
                            <Settings toggleSidebar={toggleSidebar} />
                          ) : (
                            <Navigate to="/auth" replace />
                          )
                        }
                      />
                      <Route
                        path="/"
                        element={<Navigate to="/dashboard" replace />}
                      />
                      <Route
                        path="*"
                        element={<Navigate to="/dashboard" replace />}
                      />
                    </Routes>
                  </main>
                </div>
              </div>
              <EmergencyResetButton />
            </Router>
            <Toaster />
          </UIResetProvider>
        </ThemeProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ProgressProvider>
  );
}

export default App;
