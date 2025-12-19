import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext.jsx";

export default function ProtectedRoute({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    // Redirect cashier to POS, admin to dashboard
    return <Navigate to={user.role === "ADMIN" ? "/dashboard" : "/pos"} replace />;
  }
  return children;
}


