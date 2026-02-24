import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api.js";
import { useAuth } from "../state/AuthContext.jsx";

const SEEN_KEY = "cv_seen_alert_keys";
const DISMISSED_KEY = "cv_dismissed_alert_keys";

const severityRank = {
  critical: 0,
  medium: 1,
  low: 2,
};

const severityMeta = {
  critical: {
    label: "Critical",
    icon: "fi-rr-triangle-warning",
    chipClass: "cv-notification-chip is-critical",
  },
  medium: {
    label: "Medium",
    icon: "fi-rr-exclamation",
    chipClass: "cv-notification-chip is-medium",
  },
  low: {
    label: "Low",
    icon: "fi-rr-info",
    chipClass: "cv-notification-chip is-low",
  },
};

function readStorageArray(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((item) => String(item || "")).filter(Boolean);
  } catch {
    return [];
  }
}

function writeStorageArray(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage failures
  }
}

function unique(values) {
  return [...new Set((values || []).map((item) => String(item || "")).filter(Boolean))];
}

function buildAlerts(payload) {
  const lowStock = Array.isArray(payload?.lowStock) ? payload.lowStock : [];
  const nearExpiry = Array.isArray(payload?.nearExpiry) ? payload.nearExpiry : [];
  const expired = Array.isArray(payload?.expired) ? payload.expired : [];

  const normalized = [
    ...expired.map((item) => ({
      id: `EXPIRED-${item.id || item.name || Math.random()}`,
      name: item.name || "Inventory Item",
      message: item.message || "Item has expired",
      alertType: "EXPIRED",
      severity: "critical",
      expiryDate: item.expiry_date || null,
    })),
    ...nearExpiry.map((item) => ({
      id: `EXPIRY-${item.id || item.name || Math.random()}`,
      name: item.name || "Inventory Item",
      message: item.message || "Item nearing expiry",
      alertType: "EXPIRY",
      severity: "medium",
      expiryDate: item.expiry_date || null,
    })),
    ...lowStock.map((item) => ({
      id: `LOW_STOCK-${item.id || item.name || Math.random()}`,
      name: item.name || "Inventory Item",
      message: item.message || "Stock level is low",
      alertType: "LOW_STOCK",
      severity: "low",
      expiryDate: null,
    })),
  ];

  return normalized.sort((a, b) => {
    const severityDelta =
      (severityRank[a.severity] ?? 99) - (severityRank[b.severity] ?? 99);
    if (severityDelta !== 0) {
      return severityDelta;
    }
    return a.name.localeCompare(b.name);
  });
}

export default function HeaderNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const hasLoadedRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [seenKeys, setSeenKeys] = useState(() => readStorageArray(SEEN_KEY));
  const [dismissedKeys, setDismissedKeys] = useState(() =>
    readStorageArray(DISMISSED_KEY)
  );
  const [fetchError, setFetchError] = useState("");

  const isAdmin = String(user?.role || "").toUpperCase() === "ADMIN";

  useEffect(() => {
    writeStorageArray(SEEN_KEY, seenKeys);
  }, [seenKeys]);

  useEffect(() => {
    writeStorageArray(DISMISSED_KEY, dismissedKeys);
  }, [dismissedKeys]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const onEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!isAdmin || !user?.token) {
      setAlerts([]);
      setOpen(false);
      setLoading(false);
      hasLoadedRef.current = false;
      return undefined;
    }

    let cancelled = false;

    const fetchAlerts = async () => {
      try {
        if (!hasLoadedRef.current) {
          setLoading(true);
        }
        const { data } = await api.get("/inventory/alerts");
        if (cancelled) {
          return;
        }

        const nextAlerts = buildAlerts(data);
        setAlerts(nextAlerts);
        setFetchError("");

        const activeKeys = new Set(nextAlerts.map((alert) => alert.id));
        setSeenKeys((prev) => prev.filter((key) => activeKeys.has(key)));
        setDismissedKeys((prev) => prev.filter((key) => activeKeys.has(key)));
      } catch (err) {
        if (!cancelled) {
          setFetchError(err?.response?.data?.message || "Failed to load alerts");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          hasLoadedRef.current = true;
        }
      }
    };

    fetchAlerts();
    const interval = window.setInterval(fetchAlerts, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isAdmin, user?.token]);

  const visibleAlerts = useMemo(() => {
    const dismissed = new Set(dismissedKeys);
    return alerts.filter((alert) => !dismissed.has(alert.id));
  }, [alerts, dismissedKeys]);

  const unreadCount = useMemo(() => {
    const seen = new Set(seenKeys);
    return visibleAlerts.filter((alert) => !seen.has(alert.id)).length;
  }, [visibleAlerts, seenKeys]);

  const markVisibleAsSeen = () => {
    const keys = visibleAlerts.map((alert) => alert.id);
    if (keys.length === 0) {
      return;
    }
    setSeenKeys((prev) => unique([...prev, ...keys]));
  };

  const togglePanel = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        markVisibleAsSeen();
      }
      return next;
    });
  };

  const dismissAlert = (alertId) => {
    setDismissedKeys((prev) => unique([...prev, alertId]));
  };

  const dismissAll = () => {
    if (visibleAlerts.length === 0) {
      return;
    }
    setDismissedKeys((prev) =>
      unique([...prev, ...visibleAlerts.map((alert) => alert.id)])
    );
  };

  const headerSubtitle = !isAdmin
    ? "Alerts are available for admin users"
    : visibleAlerts.length === 0
    ? "No active alerts"
    : `${visibleAlerts.length} active alert${visibleAlerts.length > 1 ? "s" : ""}`;

  return (
    <div className="cv-notification-wrap" ref={rootRef}>
      <button
        type="button"
        className={`cv-top-icon-btn cv-notification-btn ${open ? "is-open" : ""}`}
        aria-label="Alerts and notifications"
        aria-expanded={open}
        onClick={togglePanel}
      >
        <i className="fi-rr-bell" aria-hidden="true" />
        {unreadCount > 0 && <span className="cv-notification-dot" />}
      </button>

      {open && (
        <div className="cv-notification-popover">
          <div className="cv-notification-header">
            <div>
              <div className="cv-notification-title">Alerts & Notifications</div>
              <div className="cv-notification-subtitle">{headerSubtitle}</div>
            </div>
            {unreadCount > 0 && (
              <span className="cv-notification-unread">{unreadCount} new</span>
            )}
          </div>

          <div className="cv-notification-list">
            {loading ? (
              <div className="cv-notification-empty">Loading alerts...</div>
            ) : fetchError ? (
              <div className="cv-notification-empty">{fetchError}</div>
            ) : visibleAlerts.length === 0 ? (
              <div className="cv-notification-empty">No active alerts right now.</div>
            ) : (
              visibleAlerts.map((alert) => {
                const meta = severityMeta[alert.severity] || severityMeta.low;
                return (
                  <div key={alert.id} className="cv-notification-item">
                    <span className={meta.chipClass}>
                      <i className={meta.icon} aria-hidden="true" />
                      {meta.label}
                    </span>
                    <div className="cv-notification-item-content">
                      <div className="cv-notification-item-title">{alert.name}</div>
                      <div className="cv-notification-item-message">{alert.message}</div>
                    </div>
                    <button
                      type="button"
                      className="cv-notification-dismiss"
                      onClick={() => dismissAlert(alert.id)}
                      aria-label={`Dismiss ${alert.name} alert`}
                    >
                      <i className="fi-rr-cross-small" aria-hidden="true" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="cv-notification-actions">
            <button
              type="button"
              className="cv-notification-action-btn"
              onClick={dismissAll}
              disabled={visibleAlerts.length === 0}
            >
              Dismiss All
            </button>
            <button
              type="button"
              className="cv-notification-action-btn is-primary"
              onClick={() => {
                setOpen(false);
                navigate("/inventory");
              }}
            >
              Open Inventory
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
