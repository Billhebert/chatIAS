import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar?: string;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  settings?: Record<string, unknown>;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  tenant: Tenant | null;
  token: string | null;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string, tenantId?: string) => Promise<void>;
  logout: () => Promise<void>;
  setup: (data: SetupData) => Promise<void>;
  checkAuth: () => Promise<void>;
}

interface SetupData {
  tenantName: string;
  tenantSlug?: string;
  adminEmail: string;
  adminName?: string;
  adminPassword: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_URL = import.meta.env.VITE_API_URL || '';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    tenant: null,
    token: null
  });

  const getToken = useCallback(() => localStorage.getItem('chatias_token'), []);
  const setToken = useCallback((token: string) => localStorage.setItem('chatias_token', token), []);
  const removeToken = useCallback(() => localStorage.removeItem('chatias_token'), []);

  const checkAuth = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setState({
          isAuthenticated: true,
          isLoading: false,
          user: data.user,
          tenant: data.tenant,
          token
        });
      } else {
        removeToken();
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } catch {
      removeToken();
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [getToken, setToken, removeToken]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email: string, password: string, tenantId?: string) => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, tenantId })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();
    setToken(data.token);
    setState({
      isAuthenticated: true,
      isLoading: false,
      user: data.user,
      tenant: data.tenant,
      token: data.token
    });
  };

  const logout = async () => {
    const token = getToken();
    if (token) {
      try {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch {
        // Ignore logout errors
      }
    }
    removeToken();
    setState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      tenant: null,
      token: null
    });
  };

  const setup = async (data: SetupData) => {
    const response = await fetch(`${API_URL}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Setup failed');
    }

    const result = await response.json();
    setToken(result.token);
    setState({
      isAuthenticated: true,
      isLoading: false,
      user: result.user,
      tenant: result.tenant,
      token: result.token
    });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, setup, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
