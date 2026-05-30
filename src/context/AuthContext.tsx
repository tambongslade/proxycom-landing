import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react'; // Type-only import for ReactNode
import { apiClient } from '../utils/apiClient'; // Assuming apiClient is in src/utils
import { useQueryClient } from '@tanstack/react-query';

interface Client {
  id: number;
  name: string;
  company_name: string;
  email: string;
  logo?: string;
}

// Updated Login Response shape to expect 'token' and optional 'client' details
interface LoginResponse {
  token: string; // Changed from accessToken to token
  client?: Client; // Making client details optional as per client.md login response (it only shows token)
                   // If your backend *does* send client details on login, keep it non-optional.
}

// Define the shape of the login credentials
interface LoginCredentials {
  email: string; // Assuming email is used for login
  password: string;
}

interface AuthContextType {
  isLoggedIn: boolean;
  token: string | null;
  client: Client | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  isLoginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  isLoading: boolean; // To indicate login process
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false); // For login loading state
  const [client, setClient] = useState<Client | null>(null);
  const queryClient = useQueryClient(); // Get query client for cache invalidation on logout

  const logout = useCallback(() => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authClient');
    setToken(null);
    setClient(null);
    setIsLoggedIn(false);
    setIsLoginModalOpen(false); // Ensure modal is closed on logout
    queryClient.clear(); // Clear all TanStack Query cache on logout
    // Redirect to home or login page if necessary
    // window.location.href = '/'; // Or use react-router navigate
  }, [queryClient]);

  // Check for token and client in localStorage on initial load
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedClient = localStorage.getItem('authClient');
    if (storedToken) {
      setToken(storedToken);
      if (storedClient) {
        try {
          setClient(JSON.parse(storedClient));
        } catch {
          setClient(null);
        }
      }
      setIsLoggedIn(true); // Optimistically set to true, will be validated below
      apiClient('/auth/validate-token', { method: 'GET' })
        .then(() => {
          setIsLoggedIn(true);
        })
        .catch(() => {
          logout();
        });
    } else {
      setIsLoggedIn(false);
      setClient(null);
    }
  }, [logout]);

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setClient(null);
    try {
      const response = await apiClient<LoginResponse>('/auth/client/login', {
        method: 'POST',
        data: credentials,
      });

      // Now expects response.token
      if (response && response.token) {
        localStorage.setItem('authToken', response.token); // Store the token
        setToken(response.token);
        setIsLoggedIn(true);
        setIsLoginModalOpen(false);

        // If your /auth/client/login ALSO returns client details, handle them here:
        if (response.client) {
          localStorage.setItem('authClient', JSON.stringify(response.client));
          setClient(response.client);
        } else {
          // If client details are not sent on login, you might need a separate call 
          // to fetch them, or they might not be needed immediately in the context.
          // For now, if not provided, client state remains null initially.
          // The CampagneList will rely on the token being set for its own data fetching.
          localStorage.removeItem('authClient'); // Ensure no stale client data if not returned
          setClient(null);
        }
      } else {
        throw new Error('Login response missing token.');
      }
    } catch (error) {
      console.error('Login failed:', error);
      localStorage.removeItem('authToken');
      localStorage.removeItem('authClient');
      setToken(null);
      setClient(null);
      setIsLoggedIn(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const openLoginModal = () => setIsLoginModalOpen(true);
  const closeLoginModal = () => setIsLoginModalOpen(false);

  return (
    <AuthContext.Provider value={{ 
        isLoggedIn, 
        token, 
        client, 
        login, 
        logout, 
        isLoginModalOpen, 
        openLoginModal, 
        closeLoginModal,
        isLoading
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 