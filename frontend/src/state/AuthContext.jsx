import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../utils/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const cached = localStorage.getItem("cv_user");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const inferredSuperAdmin =
          String(parsed?.username || "").trim().toUpperCase() === "VOXO";
        const normalized = {
          id: parsed?.id || null,
          username: parsed?.username || null,
          role: parsed?.role || null,
          isSuperAdmin:
            parsed?.isSuperAdmin === true ||
            parsed?.is_super_admin === true ||
            inferredSuperAdmin,
          token: parsed?.token || null,
          permissions: Array.isArray(parsed?.permissions) ? parsed.permissions : [],
          customRole: parsed?.customRole || null,
        };
        // Set token in axios defaults immediately
        if (normalized.token) {
          api.defaults.headers.common.Authorization = `Bearer ${normalized.token}`;
        }
        return normalized;
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem("cv_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("cv_user");
    }
  }, [user]);

  const login = async (username, password) => {
    const { data } = await api.post("/auth/login", { username, password });
    const next = {
      id: data.id || null,
      username: data.username || username,
      role: data.role,
      isSuperAdmin:
        data?.isSuperAdmin === true ||
        data?.is_super_admin === true ||
        String(data?.username || username || "")
          .trim()
          .toUpperCase() === "VOXO",
      token: data.token,
      permissions: Array.isArray(data.permissions) ? data.permissions : [],
      customRole: data.customRole || null,
    };
    setUser(next);
    api.defaults.headers.common.Authorization = `Bearer ${data.token}`;
    return next;
  };

  const logout = () => {
    setUser(null);
    delete api.defaults.headers.common.Authorization;
  };

  // Load token whenever user changes
  useEffect(() => {
    if (user?.token) {
      api.defaults.headers.common.Authorization = `Bearer ${user.token}`;
    } else {
      delete api.defaults.headers.common.Authorization;
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
