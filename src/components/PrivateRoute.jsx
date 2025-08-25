import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';

const PrivateRoute = () => {
  const { isAuthenticated, loading } = useAuth();
  const [initialized, setInitialized] = useState(false);

  // Wait for the auth check to complete
  useEffect(() => {
    if (!loading) {
      setInitialized(true);
    }
  }, [loading]);

  // Show nothing until we've completed the initial auth check
  if (loading && !initialized) {
    return null;
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

export default PrivateRoute;
