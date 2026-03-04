import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import axios from "axios";

const api = axios.create({ baseURL: "/api" });

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  auth_method: string;
  plan: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  sendCode: (email: string) => Promise<{ channel: string; message: string }>;
  verifyCode: (email: string, code: string) => Promise<AuthUser>;
  register: (data: RegisterData) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export interface RegisterData {
  email: string;
  name?: string;
  password?: string;
  auth_method: string;
  chatwork_room_id?: string;
}

const AuthContext = createContext<AuthContextValue>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get<AuthUser>("/auth/me");
      setUser(data);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<AuthUser>("/auth/login", { email, password });
    setUser(data);
    return data;
  }, []);

  const sendCode = useCallback(async (email: string) => {
    const { data } = await api.post<{ channel: string; message: string }>("/auth/send-code", { email });
    return data;
  }, []);

  const verifyCode = useCallback(async (email: string, code: string) => {
    const { data } = await api.post<AuthUser>("/auth/verify-code", { email, code });
    setUser(data);
    return data;
  }, []);

  const register = useCallback(async (regData: RegisterData) => {
    const { data } = await api.post<AuthUser>("/auth/register", regData);
    setUser(data);
    return data;
  }, []);

  const logout = useCallback(async () => {
    await api.post("/auth/logout");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, sendCode, verifyCode, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
