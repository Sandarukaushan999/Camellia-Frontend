import React, { useEffect, useState } from "react";
import api from "../utils/api.js";
import { useAuth } from "../state/AuthContext.jsx";

export default function AlertNotifications() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [showNotifications, setShowNotifications] = useState(true);

  useEffect(() => {
    if (!user || user.role !== "ADMIN") return;

    const fetchAlerts = async () => {
      try {
        const { data } = await api.get("/inventory/alerts");
        const allAlerts = [
          ...(data.lowStock || []),
          ...(data.nearExpiry || []),
          ...(data.expired || [])
        ];
        setAlerts(allAlerts);
      } catch (err) {
        console.error("Failed to fetch alerts", err);
      }
    };

    // Initial fetch
    fetchAlerts();

    // Poll every 10 seconds
    const interval = setInterval(fetchAlerts, 10000);

    return () => clearInterval(interval);
  }, [user]);

  const dismissAlert = (alertId) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  };

  const getAlertIcon = (alertType) => {
    switch (alertType) {
      case "LOW_STOCK":
        return "⚠️";
      case "EXPIRY":
        return "⏰";
      case "EXPIRED":
        return "🚨";
      default:
        return "ℹ️";
    }
  };

  const getAlertColor = (alertType) => {
    switch (alertType) {
      case "LOW_STOCK":
        return "bg-yellow-50 border-yellow-500 text-yellow-800";
      case "EXPIRY":
        return "bg-orange-50 border-orange-500 text-orange-800";
      case "EXPIRED":
        return "bg-red-50 border-red-500 text-red-800";
      default:
        return "bg-blue-50 border-blue-500 text-blue-800";
    }
  };

  if (!user || user.role !== "ADMIN" || alerts.length === 0 || !showNotifications) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {alerts.slice(0, 5).map((alert, index) => (
        <div
          key={alert.id || `alert-${index}-${alert.name}`}
          className={`${getAlertColor(alert.alertType)} border-l-4 rounded-lg shadow-lg p-4 flex items-start gap-3 animate-slide-in`}
        >
          <div className="text-2xl flex-shrink-0">{getAlertIcon(alert.alertType)}</div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm mb-1">{alert.name}</div>
            <div className="text-xs">{alert.message}</div>
          </div>
          <button
            onClick={() => dismissAlert(alert.id || `alert-${index}-${alert.name}`)}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
      {alerts.length > 5 && (
        <div className="text-xs text-center text-gray-600 bg-white px-3 py-2 rounded-lg shadow">
          +{alerts.length - 5} more alerts
        </div>
      )}
      <button
        onClick={() => setShowNotifications(false)}
        className="w-full text-xs text-center text-gray-600 bg-white px-3 py-2 rounded-lg shadow hover:bg-gray-50 transition-colors"
      >
        Dismiss All
      </button>
    </div>
  );
}

