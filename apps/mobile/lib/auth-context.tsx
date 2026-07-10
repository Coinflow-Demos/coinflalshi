import {createContext, useContext, useEffect, useMemo, useState, type ReactNode} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {apiFetch} from './api';

const TOKEN_KEY = 'coinflalshi.token';

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  login: (params: {email: string; password: string}) => Promise<void>;
  register: (params: {name: string; email: string; password: string}) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({children}: {children: ReactNode}) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(TOKEN_KEY).then((stored) => {
      setToken(stored);
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      loading,
      login: async ({email, password}) => {
        const data = await apiFetch<{token: string; user: AuthUser}>('/api/mobile/login', {
          method: 'POST',
          body: {email, password},
        });
        await AsyncStorage.setItem(TOKEN_KEY, data.token);
        setToken(data.token);
        setUser(data.user);
      },
      register: async ({name, email, password}) => {
        await apiFetch('/api/auth/register', {method: 'POST', body: {name, email, password}});
        const data = await apiFetch<{token: string; user: AuthUser}>('/api/mobile/login', {
          method: 'POST',
          body: {email, password},
        });
        await AsyncStorage.setItem(TOKEN_KEY, data.token);
        setToken(data.token);
        setUser(data.user);
      },
      logout: async () => {
        await AsyncStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      },
    }),
    [token, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
