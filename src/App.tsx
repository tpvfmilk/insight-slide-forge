
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ThemeProvider } from "@/components/shared/ThemeProvider";
import { ProgressProvider } from '@/context/ProgressContext';
import { DistillProvider } from '@/context/DistillContext';
import { UIResetProvider } from '@/context/UIResetContext';
import { AudioChunkingProvider } from '@/context/AudioChunkingContext';
import { AuthProvider } from '@/context/AuthContext';
import { EmergencyResetButton } from '@/components/ui/EmergencyResetButton';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Import pages
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import RegisterPage from '@/pages/RegisterPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import SettingsPage from '@/pages/SettingsPage';
import UploadPage from '@/pages/UploadPage';
import ProjectsPage from '@/pages/ProjectsPage';
import ProjectPage from '@/pages/ProjectPage';
import PresentationPage from '@/pages/PresentationPage';
import NotFound from '@/pages/NotFound';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

// Initialize the query client
const queryClient = new QueryClient();

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="distill-theme">
      <QueryClientProvider client={queryClient}>
        <ProgressProvider>
          <DistillProvider>
            <UIResetProvider>
              <AudioChunkingProvider>
                <Router>
                  <AuthProvider>
                    <Routes>
                      <Route path="/" element={<LandingPage />} />
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/register" element={<RegisterPage />} />
                      <Route path="/reset-password" element={<ResetPasswordPage />} />
                      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                      <Route path="/upload" element={<ProtectedRoute><UploadPage /></ProtectedRoute>} />
                      <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
                      <Route path="/projects/:id" element={<ProtectedRoute><ProjectPage /></ProtectedRoute>} />
                      <Route path="/projects/:id/present" element={<ProtectedRoute><PresentationPage /></ProtectedRoute>} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                    <Toaster position="bottom-right" />
                    <EmergencyResetButton />
                  </AuthProvider>
                </Router>
              </AudioChunkingProvider>
            </UIResetProvider>
          </DistillProvider>
        </ProgressProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
