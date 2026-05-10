import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginUser, registerUser, LoginResponse, RegisterData } from '@/services/api';

// ---------- Tipos ----------

interface User {
  id: string;
  email: string;
  nombre: string;
  edad: number;
  peso: number;
  altura: number;
  genero: string;
  objetivos: string[];
  restricciones: string[];
  ingredientes_favoritos: string[];
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ---------- Keys de AsyncStorage ----------

const TOKEN_KEY = 'rechipe_access_token';
const REFRESH_KEY = 'rechipe_refresh_token';
const USER_KEY = 'rechipe_user';

// ---------- Provider ----------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Al montar, intentamos cargar la sesion guardada
  useEffect(() => {
    loadStoredSession();
  }, []);

  const loadStoredSession = async () => {
    try {
      const [storedToken, storedUser] = await Promise.all([
        AsyncStorage.getItem(TOKEN_KEY),
        AsyncStorage.getItem(USER_KEY),
      ]);

      if (storedToken && storedUser) {
        setAccessToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.error('Error cargando sesion almacenada:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSession = async (token: string, refreshToken: string, userData: User) => {
    await Promise.all([
      AsyncStorage.setItem(TOKEN_KEY, token),
      AsyncStorage.setItem(REFRESH_KEY, refreshToken),
      AsyncStorage.setItem(USER_KEY, JSON.stringify(userData)),
    ]);
  };

  const clearSession = async () => {
    await Promise.all([
      AsyncStorage.removeItem(TOKEN_KEY),
      AsyncStorage.removeItem(REFRESH_KEY),
      AsyncStorage.removeItem(USER_KEY),
    ]);
  };

  // ---------- Login ----------
  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response: LoginResponse = await loginUser(email, password);

      if (response.error) {
        return { success: false, error: response.error };
      }

      if (response.access_token && response.user) {
        setAccessToken(response.access_token);
        setUser(response.user);
        await saveSession(response.access_token, response.refresh_token || '', response.user);
        return { success: true };
      }

      return { success: false, error: 'Respuesta inesperada del servidor' };
    } catch (e: any) {
      console.error('Error en login:', e);
      return { success: false, error: `Error de conexion: ${e.message}` };
    }
  };

  // ---------- Register ----------
  const register = async (data: RegisterData): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await registerUser(data);

      if (response.error) {
        return { success: false, error: response.error };
      }

      if (response.id) {
        return { success: true };
      }

      return { success: false, error: 'Respuesta inesperada del servidor' };
    } catch (e: any) {
      console.error('Error en registro:', e);
      return { success: false, error: `Error de conexion: ${e.message}` };
    }
  };

  // ---------- Logout ----------
  const logout = async () => {
    setUser(null);
    setAccessToken(null);
    await clearSession();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!accessToken,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ---------- Hook ----------

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
}
