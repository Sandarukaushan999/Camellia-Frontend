import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext.jsx";
import HeaderNotifications from "../components/HeaderNotifications.jsx";
import { Footer } from "../components/Footer.jsx";
import api from "../utils/api.js";
import { hasPermission } from "../utils/accessControl.js";
import {
  getActiveBranchId,
  onActiveBranchChange,
  setActiveBranchId as setStoredActiveBranchId,
} from "../utils/branchContext.js";
import { formatBusinessDate } from "../utils/timezone.js";
import logo from "../assests/Clogo.jpeg";

const menuIconClasses = {
  Dashboard: "fi-rr-apps",
  "POS Billing": "fi-rr-cash-register",
  Orders: "fi-rr-receipt",
  Sales: "fi-rr-chart-line-up",
  Products: "fi-rr-shopping-bag",
  "QR Category": "fi-rr-qrcode",
  Inventory: "fi-rr-boxes",
  Expenses: "fi-rr-wallet",
  Reports: "fi-rr-chart-pie-alt",
  CRM: "fi-rr-users",
  "User Management": "fi-rr-users-gear",
  Settings: "fi-rr-settings-sliders",
};

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("cv_sidebar_collapsed") === "1";
    } catch {
      return false;
    }
  });
  const [branches, setBranches] = useState([]);
  const [activeBranchId, setActiveBranchId] = useState(() => getActiveBranchId(null));
  const isPOSWorkspace =
    location.pathname === "/pos" ||
    location.pathname.startsWith("/pos/") ||
    location.pathname.startsWith("/orders/");

  const links = useMemo(() => {
    const adminLinks = [
      {
        to: "/dashboard",
        label: "Dashboard",
        subtitle: "Operational overview and live KPIs",
        permission: "dashboard.view",
      },
      {
        to: "/pos",
        label: "POS Billing",
        subtitle: "Fast checkout and order operations",
        permission: "pos.view",
      },
      {
        to: "/order-queue",
        label: "Orders",
        subtitle: "Incoming QR orders and order details",
        permission: "sales.view",
      },
      {
        to: "/sales",
        label: "Sales",
        subtitle: "Invoice ledger and transaction history",
        permission: "sales.view",
      },
      {
        to: "/products",
        label: "Products",
        subtitle: "Menu catalog and pricing control",
        permission: "products.view",
      },
      {
        to: "/qr-category",
        label: "QR Category",
        subtitle: "Stable QR menu and public ordering",
        permission: "products.view",
      },
      {
        to: "/inventory",
        label: "Inventory",
        subtitle: "Stock, ingredients, and alerts",
        permission: "inventory.view",
      },
      {
        to: "/expenses",
        label: "Expenses",
        subtitle: "Cost tracking and spend controls",
        permission: "expenses.view",
      },
      {
        to: "/reports",
        label: "Reports",
        subtitle: "Sales intelligence and analytics",
        permission: "reports.view",
      },
      {
        to: "/crm",
        label: "CRM",
        subtitle: "Customer loyalty and campaign workflows",
        permission: "crm.view",
      },
      {
        to: "/user-management",
        label: "User Management",
        subtitle: "Users, roles, and custom access control",
        permission: "users.view",
      },
      {
        to: "/settings",
        label: "Settings",
        subtitle: "System configuration and security",
        permission: "settings.view",
      },
    ];

    if (user?.role === "ADMIN") {
      const permittedLinks = adminLinks.filter((link) =>
        hasPermission(user, link.permission)
      );
      if (permittedLinks.length > 0) {
        return permittedLinks;
      }
    }

    const cashierLinks = [
      {
        to: "/pos",
        label: "POS Billing",
        subtitle: "Fast checkout and order operations",
        permission: "pos.view",
      },
      {
        to: "/order-queue",
        label: "Orders",
        subtitle: "Incoming QR orders and order details",
        permission: "sales.view",
      },
      {
        to: "/sales",
        label: "Sales",
        subtitle: "Invoice ledger and transaction history",
        permission: "sales.view",
      },
    ].filter((link) => hasPermission(user, link.permission));

    if (cashierLinks.length > 0) {
      return cashierLinks;
    }
    return [
      {
        to: "/pos",
        label: "POS Billing",
        subtitle: "Fast checkout and order operations",
        permission: "pos.view",
      },
    ];
  }, [user]);

  const activeLink = useMemo(() => {
    return (
      links.find((link) => location.pathname === link.to || location.pathname.startsWith(`${link.to}/`)) ||
      links[0]
    );
  }, [links, location.pathname]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    try {
      localStorage.setItem("cv_sidebar_collapsed", sidebarCollapsed ? "1" : "0");
    } catch {
      // ignore storage errors
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!mobileNavOpen) {
      return undefined;
    }
    const isMobileViewport = window.matchMedia("(max-width: 1024px)").matches;
    if (!isMobileViewport) {
      return undefined;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    if (!user?.token) {
      setBranches([]);
      return undefined;
    }

    let mounted = true;

    const loadBranches = async () => {
      try {
        const [branchesRes, defaultRes] = await Promise.all([
          api.get("/branches"),
          api.get("/branches/me/default"),
        ]);
        if (!mounted) {
          return;
        }

        const availableBranches = Array.isArray(branchesRes.data)
          ? branchesRes.data.filter((branch) => branch?.is_active !== false)
          : [];
        setBranches(availableBranches);

        if (availableBranches.length === 0) {
          setActiveBranchId(null);
          return;
        }

        const storedBranchId = getActiveBranchId(null);
        const isStoredValid = availableBranches.some(
          (branch) => Number(branch.id) === Number(storedBranchId)
        );
        const defaultBranchId = Number(defaultRes?.data?.branch?.id || 0) || null;
        const isDefaultValid = availableBranches.some(
          (branch) => Number(branch.id) === Number(defaultBranchId)
        );

        const nextBranchId = isStoredValid
          ? Number(storedBranchId)
          : isDefaultValid
          ? Number(defaultBranchId)
          : Number(availableBranches[0]?.id || 0) || null;

        setActiveBranchId(nextBranchId);
        setStoredActiveBranchId(nextBranchId);
      } catch (err) {
        console.error("Failed to load branches for workspace:", err);
      }
    };

    loadBranches();
    return () => {
      mounted = false;
    };
  }, [user?.token]);

  useEffect(() => onActiveBranchChange((nextBranchId) => setActiveBranchId(nextBranchId)), []);

  const handleBranchChange = (event) => {
    const nextBranchId = Number.parseInt(event.target.value, 10);
    if (!Number.isFinite(nextBranchId) || nextBranchId <= 0) {
      return;
    }
    setActiveBranchId(nextBranchId);
    setStoredActiveBranchId(nextBranchId);
  };

  const toggleSidebarCollapsed = () => {
    // Keep mobile drawer behavior unchanged.
    if (window.matchMedia("(max-width: 1024px)").matches) {
      return;
    }
    setSidebarCollapsed((prev) => !prev);
  };

  return (
    <div className={`cv-shell ${sidebarCollapsed ? "is-sidebar-collapsed" : ""}`}>
      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="cv-mobile-backdrop"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <aside className={`cv-sidebar ${mobileNavOpen ? "is-open" : ""} ${sidebarCollapsed ? "is-collapsed" : ""}`}>
        <button
          type="button"
          className="cv-brand cv-brand-toggle"
          onClick={toggleSidebarCollapsed}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <div className="cv-brand-media">
            <img src={logo} alt="Camellia POS Logo" className="h-full w-full object-cover" />
          </div>
          <div className="cv-brand-text">
            <div className="cv-brand-title">Camellia POS</div>
            <div className="cv-brand-subtitle">Cafe & Restaurant</div>
          </div>
        </button>

        <nav className="cv-nav">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              title={link.label}
              className={({ isActive }) => `cv-nav-link ${isActive ? "is-active" : ""}`}
            >
              <span className="cv-nav-icon">
                <i className={menuIconClasses[link.label] || "fi-rr-apps"} aria-hidden="true" />
              </span>
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="cv-user-area">
          <div className="cv-user-card">
            <div className="cv-user-avatar">{user?.username?.charAt(0).toUpperCase() || "U"}</div>
            <div className="min-w-0">
              <div className="cv-user-name">{user?.username || "User"}</div>
              <div className="cv-user-role">{user?.role || "Role"}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="cv-logout-btn"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.5 16.5L20 12l-4.5-4.5M20 12H9m6.5 6.5v1a2 2 0 01-2 2h-8a2 2 0 01-2-2v-15a2 2 0 012-2h8a2 2 0 012 2v1" />
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="cv-main">
        {isPOSWorkspace ? (
          <header className="cv-topbar cv-topbar--minimal">
            <div className="cv-topbar-start">
              <button
                type="button"
                className="cv-mobile-toggle"
                onClick={() => setMobileNavOpen((prev) => !prev)}
                aria-label="Toggle navigation"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </button>
            </div>
          </header>
        ) : (
          <header className="cv-topbar">
            <div className="cv-topbar-start">
              <button
                type="button"
                className="cv-mobile-toggle"
                onClick={() => setMobileNavOpen((prev) => !prev)}
                aria-label="Toggle navigation"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </button>
              <div className="cv-route-meta">
                <div className="cv-welcome-title cv-route-title-row">
                  <span className="cv-route-icon" aria-hidden="true">
                    <i className={menuIconClasses[activeLink?.label] || "fi-rr-apps"} />
                  </span>
                  <span>Welcome, {user?.username || "Operator"}</span>
                </div>
                <div className="cv-route-subtitle">{activeLink?.subtitle || "Professional POS operations"}</div>
                <div className="cv-route-pill">{activeLink?.label || "Workspace"}</div>
              </div>
            </div>

            <div className="cv-topbar-end">
              {branches.length > 0 && (
                <select
                  value={activeBranchId || ""}
                  onChange={handleBranchChange}
                  className="cv-branch-select"
                  aria-label="Active Branch"
                >
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.code || `B${branch.id}`} - {branch.name}
                    </option>
                  ))}
                </select>
              )}
              <button type="button" className="cv-top-icon-btn" aria-label="Search">
                <i className="fi-rr-search" aria-hidden="true" />
              </button>
              <HeaderNotifications />
              <div className="cv-role-chip">
                {user?.isSuperAdmin || String(user?.username || "").trim().toUpperCase() === "VOXO"
                  ? "SUPER ADMIN"
                  : user?.role || "USER"}
              </div>
              <div className="cv-date-chip">
                {formatBusinessDate(new Date(), {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
              <div className="cv-profile-chip" title={user?.username || "User"}>
                {(user?.username?.charAt(0) || "U").toUpperCase()}
              </div>
            </div>
          </header>
        )}

        <div className="cv-content-wrap">
          <div className="cv-content">
            <Outlet />
          </div>
          <Footer />
        </div>
      </main>
    </div>
  );
}

