import React, { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { useAuth } from "./state/AuthContext.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import POS from "./pages/POS.jsx";
import Products from "./pages/Products.jsx";
import Reports from "./pages/Reports.jsx";
import Settings from "./pages/Settings.jsx";
import Inventory from "./pages/Inventory.jsx";
import MainLayout from "./layout/MainLayout.jsx";

export default function App() {
  const { user } = useAuth();
  // Read system preferences once (for openPOSOnStart)
  let systemPrefs = {
    defaultOrderType: "DINE-IN",
    openPOSOnStart: true,
    theme: "Light",
  };
  try {
    const saved = localStorage.getItem("cv_system_prefs");
    if (saved) {
      systemPrefs = { ...systemPrefs, ...JSON.parse(saved) };
    }
  } catch {
    // ignore
  }

  // Apply theme (light / dark) globally
  useEffect(() => {
    const applyTheme = () => {
      let theme = "Light";
      try {
        const saved = localStorage.getItem("cv_system_prefs");
        if (saved) {
          const parsed = JSON.parse(saved);
          theme = parsed.theme || "Light";
        }
      } catch {
        // ignore
      }
      if (theme === "Dark") {
        document.body.classList.add("dark-theme");
      } else {
        document.body.classList.remove("dark-theme");
      }
    };

    applyTheme();

    const onStorage = (e) => {
      if (e.key === "cv_system_prefs_updated_at") {
        applyTheme();
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <ProtectedRoute roles={["ADMIN", "CASHIER"]}>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route
          index
            element={
              <Navigate
                to={
                  systemPrefs.openPOSOnStart
                    ? "/pos"
                    : user?.role === "ADMIN"
                    ? "/dashboard"
                    : "/pos"
                }
                replace
              />
            }
        />
        <Route
          path="dashboard"
          element={
            <ProtectedRoute roles={["ADMIN"]}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="pos"
          element={
            <ProtectedRoute roles={["ADMIN", "CASHIER"]}>
              <POS />
            </ProtectedRoute>
          }
        />
        <Route
          path="products"
          element={
            <ProtectedRoute roles={["ADMIN"]}>
              <Products />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory"
          element={
            <ProtectedRoute roles={["ADMIN"]}>
              <Inventory />
            </ProtectedRoute>
          }
        />
        <Route
          path="reports"
          element={
            <ProtectedRoute roles={["ADMIN"]}>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings"
          element={
            <ProtectedRoute roles={["ADMIN"]}>
              <Settings />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
    </Routes>
  );
}


