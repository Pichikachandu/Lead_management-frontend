import React, { 
  createContext, 
  useState, 
  useEffect, 
  useContext, 
  useCallback, 
  useMemo 
} from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../config/axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Check if user is logged in on initial load
  const checkAuth = useCallback(async () => {
    // Use a flag to track if we've already handled the user check
    let hasUser = false;
    
    // Check if we already have a user
    setUser(currentUser => {
      hasUser = !!currentUser;
      return currentUser;
    });
    
    if (hasUser) return user;
    
    // Set a timeout to ensure loading state is cleared even if the request hangs
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);
    
    try {
      const response = await api.get('/api/auth/me', {
        // Add timeout to prevent hanging
        timeout: 12000,
        // Don't show loading spinners for this request
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      });
      
      clearTimeout(timeout);
      
      if (response.data.success) {
        const userData = response.data.user || response.data.data;
        setUser(userData);
        return userData;
      }
      
      throw new Error('No user data received');
    } catch (error) {
      // Only update state if we don't have a user yet
      if (user) {
        setUser(null);
      }
      
      // Don't show error if it's just a 401 (not logged in)
      if (error.response?.status !== 401 && error.response?.status !== 0) {
        const errorMessage = error.response?.data?.message || 'Session expired. Please log in again.';
        setError(errorMessage);
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, setUser, setLoading, setError]);

  // Check auth status on mount and when user changes
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Register user
  const register = useCallback(async (userData) => {
    try {
      setError('');
      const response = await api.post('/api/auth/register', {
        username: userData.username,
        email: userData.email,
        password: userData.password,
        confirmPassword: userData.confirmPassword
      });
      
      if (response.data.success) {
        // After successful registration, log the user in
        const loginResponse = await api.post('/api/auth/login', {
          email: userData.email,
          password: userData.password
        });
        
        if (loginResponse.data.success) {
          setUser(loginResponse.data.user);
          navigate('/leads');
          return { success: true };
        }
      }
      
      throw new Error(response.data.message || 'Registration failed');
    } catch (error) {
      console.error('Registration error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Registration failed';
      setError(errorMessage);
      return { 
        success: false, 
        error: errorMessage,
        message: errorMessage // Add this line to ensure compatibility with Register.jsx
      };
    }
  }, [navigate]);

  // Login user
  const login = useCallback(async (formData) => {
    try {
      setError('');
      // Don't set loading to true to prevent UI flicker
      
      const response = await api.post('/api/auth/login', {
        email: formData.email,
        password: formData.password
      }, {
        // Add timeout to prevent hanging
        timeout: 15000
      });
      
      if (response.data.success) {
        // Update user state and navigate immediately
        setUser(response.data.user);
        // Use replace: true to prevent going back to login page
        navigate('/leads', { replace: true });
        return { success: true };
      }
      
      throw new Error(response.data.message || 'Login failed');
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Login failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [navigate]);

  // Logout user
  const logout = useCallback(async () => {
    try {
      // Always clear local state first
      setUser(null);
      setError('');
      
      // Then attempt to logout on the server
      await api.get('/api/auth/logout');
      
      // Navigate to login page
      navigate('/login');
      return { success: true };
    } catch (err) {
      // Even if server logout fails, clear local state
      setUser(null);
      const errorMessage = err.response?.data?.message || 'Logout failed';
      setError(errorMessage);
      return {
        success: false,
        message: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  }, [navigate, setUser, setError, setLoading]);

  // Clear errors
  const clearErrors = useCallback(() => {
    setError('');
  }, []);

  // Check if user is authenticated
  const isAuthenticated = !!user;

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    user,
    loading,
    error,
    isAuthenticated,
    register,
    login,
    logout,
    clearErrors,
  }), [
    user, 
    loading, 
    error, 
    isAuthenticated, 
    register, 
    login, 
    logout, 
    clearErrors
  ]);

  // Always render children, don't wait for loading to complete
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
