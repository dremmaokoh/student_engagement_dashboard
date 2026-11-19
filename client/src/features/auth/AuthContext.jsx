import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest, getStoredToken, storeToken } from "../../services/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getStoredToken());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getStoredToken()));
  const [registrationEnabled, setRegistrationEnabled] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const registration = await apiRequest("/api/v1/auth/registration");
        if (!cancelled) {
          setRegistrationEnabled(Boolean(registration.data?.enabled));
        }
      } catch {
        if (!cancelled) {
          setRegistrationEnabled(true);
        }
      }

      const stored = getStoredToken();
      if (!stored) {
        if (!cancelled) {
          setLoading(false);
        }
        return;
      }

      try {
        const me = await apiRequest("/api/v1/auth/me", { token: stored });
        if (!cancelled) {
          setUser(me.data.user);
          setToken(stored);
        }
      } catch {
        storeToken(null);
        if (!cancelled) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => {
    async function login(email, password) {
      const result = await apiRequest("/api/v1/auth/login", {
        method: "POST",
        body: { email, password },
      });
      storeToken(result.data.token);
      setToken(result.data.token);
      setUser(result.data.user);
      return result.data.user;
    }

    async function register(fullName, email, password) {
      const result = await apiRequest("/api/v1/auth/register", {
        method: "POST",
        body: { fullName, email, password },
      });
      storeToken(result.data.token);
      setToken(result.data.token);
      setUser(result.data.user);
      return result.data.user;
    }

    function logout() {
      storeToken(null);
      setToken(null);
      setUser(null);
    }

    return {
      token,
      user,
      loading,
      isAuthenticated: Boolean(token && user),
      registrationEnabled,
      login,
      register,
      logout,
    };
  }, [token, user, loading, registrationEnabled]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
