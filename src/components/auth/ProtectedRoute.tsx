
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export const ProtectedRoute = () => {
  const { user, loading } = useAuth();

  // If still loading auth state, show nothing
  if (loading) return null;
  
  // If not authenticated, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  // If authenticated, show the route's children
  return <Outlet />;
};
