import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../utils/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const cached = localStorage.getItem("cv_user");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Set token in axios defaults immediately
        if (parsed?.token) {
          api.defaults.headers.common.Authorization = `Bearer ${parsed.token}`;
        }
        return parsed;
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
    const next = { username, role: data.role, token: data.token };
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

