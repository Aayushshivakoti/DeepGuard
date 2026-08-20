import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginUser, registerUser, getMe } from '../api/scanApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [role, setRole] = useState(localStorage.getItem('role'));
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    async function loadUser() {
      if (token) {
        try {
          const profile = await getMe();
          setUser(profile);
          setRole(profile.role);
          localStorage.setItem('role', profile.role);
        } catch (err) {
          console.error('Failed to load user profile:', err.message);
          logout();
        }
      }
      setIsLoading(false);
    }
    loadUser();
  }, [token]);

  const login = async (email, password) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const data = await loginUser(email, password);
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('role', data.role);
      setToken(data.access_token);
      setRole(data.role);
      
      // Fetch profile details
      const profile = await getMe();
      setUser(profile);
      setIsLoading(false);
      return profile;
    } catch (err) {
      setIsLoading(false);
      const errMsg = err.response?.data?.detail || 'Invalid email or password.';
      setAuthError(errMsg);
      throw new Error(errMsg);
    }
  };

  const signup = async (email, password, desiredRole = 'USER') => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const userProfile = await registerUser(email, password, desiredRole);
      setIsLoading(false);
      return userProfile;
    } catch (err) {
      setIsLoading(false);
      const errMsg = err.response?.data?.detail || 'Registration failed.';
      setAuthError(errMsg);
      throw new Error(errMsg);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    setToken(null);
    setRole(null);
    setUser(null);
    setAuthError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role,
        isAuthenticated: !!token,
        isLoading,
        authError,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
