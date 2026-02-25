import React, { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { useAuth } from "./state/AuthContext.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import POS from "./pages/POS.jsx";
import Orders from "./pages/Orders.jsx";
import Sales from "./pages/Sales.jsx";
import Products from "./pages/Products.jsx";
import Reports from "./pages/Reports.jsx";
import Settings from "./pages/Settings.jsx";
import Inventory from "./pages/Inventory.jsx";
import CRM from "./pages/CRM.jsx";
import Expenses from "./pages/Expenses.jsx";
import UserManagement from "./pages/UserManagement.jsx";
import QRCategory from "./pages/QRCategory.jsx";
import PublicMenu from "./pages/PublicMenu.jsx";
import MainLayout from "./layout/MainLayout.jsx";
import { getDefaultRoute } from "./utils/accessControl.js";

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
      <Route path="/menu" element={<PublicMenu />} />
      <Route path="/menu/:branchCode" element={<PublicMenu />} />

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
              to={getDefaultRoute(user, { openPOSOnStart: systemPrefs.openPOSOnStart })}
              replace
            />
          }
        />
        <Route
          path="dashboard"
          element={
            <ProtectedRoute roles={["ADMIN"]} permissions={["dashboard.view"]}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="pos"
          element={
            <ProtectedRoute roles={["ADMIN", "CASHIER"]} permissions={["pos.view"]}>
              <POS />
            </ProtectedRoute>
          }
        />
        <Route
          path="order-queue"
          element={
            <ProtectedRoute roles={["ADMIN", "CASHIER"]} permissions={["sales.view"]}>
              <Orders />
            </ProtectedRoute>
          }
        />
        <Route
          path="orders/:id"
          element={
            <ProtectedRoute roles={["ADMIN", "CASHIER"]}>
              <POS />
            </ProtectedRoute>
          }
        />
        <Route
          path="sales"
          element={
            <ProtectedRoute roles={["ADMIN", "CASHIER"]} permissions={["sales.view"]}>
              <Sales />
            </ProtectedRoute>
          }
        />
        <Route
          path="products"
          element={
            <ProtectedRoute roles={["ADMIN"]} permissions={["products.view"]}>
              <Products />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory"
          element={
            <ProtectedRoute roles={["ADMIN"]} permissions={["inventory.view"]}>
              <Inventory />
            </ProtectedRoute>
          }
        />
        <Route
          path="reports"
          element={
            <ProtectedRoute roles={["ADMIN"]} permissions={["reports.view"]}>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="expenses"
          element={
            <ProtectedRoute roles={["ADMIN"]} permissions={["expenses.view"]}>
              <Expenses />
            </ProtectedRoute>
          }
        />
        <Route
          path="crm"
          element={
            <ProtectedRoute roles={["ADMIN"]} permissions={["crm.view"]}>
              <CRM />
            </ProtectedRoute>
          }
        />
        <Route
          path="user-management"
          element={
            <ProtectedRoute roles={["ADMIN"]} permissions={["users.view"]}>
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings"
          element={
            <ProtectedRoute roles={["ADMIN"]} permissions={["settings.view"]}>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="qr-category"
          element={
            <ProtectedRoute roles={["ADMIN"]} permissions={["products.view"]}>
              <QRCategory />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
    </Routes>
  );
}
