import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext.jsx";
import { getDefaultRoute, hasAllPermissions } from "../utils/accessControl.js";

export default function ProtectedRoute({ roles, permissions, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={getDefaultRoute(user)} replace />;
  }
  if (permissions && !hasAllPermissions(user, permissions)) {
    return <Navigate to={getDefaultRoute(user)} replace />;
  }
  return children;
}





