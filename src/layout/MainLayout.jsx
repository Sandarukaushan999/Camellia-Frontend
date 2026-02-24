import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext.jsx";
import AlertNotifications from "../components/AlertNotifications.jsx";
import { Footer } from "../components/Footer.jsx";
import logo from "../assests/Clogo.jpeg";

const menuIcons = {
  Dashboard: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 13.5L12 4l9 9.5M5.5 11v8.5h13V11M9.5 19.5v-5h5v5" />
    </svg>
  ),
  "POS Billing": (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 4.5h8M7 7.5h10M7 19.5h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10.5a2 2 0 002 2zM9.5 11.5h5m-5 3h5" />
    </svg>
  ),
  Products: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7.5L12 3l8 4.5-8 4.5L4 7.5zm0 0V16.5L12 21l8-4.5V7.5" />
    </svg>
  ),
  Inventory: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 7h14v11a2 2 0 01-2 2H7a2 2 0 01-2-2V7zm0 0l2.5-4h9L19 7M9 12h6" />
    </svg>
  ),
  Reports: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 19.5h14M7.5 16V10m4.5 6V6m4.5 10v-3" />
    </svg>
  ),
  CRM: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M3.5 19.5h17M8 19.5v-1.8a3.8 3.8 0 017.6 0v1.8M12 11.5a3 3 0 100-6 3 3 0 000 6z"
      />
    </svg>
  ),
  Settings: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zm8 3.5l-1.7-.5a6.5 6.5 0 00-.5-1.2l1-1.5-1.8-1.8-1.5 1a6.5 6.5 0 00-1.2-.5L14 4h-2l-.5 1.7a6.5 6.5 0 00-1.2.5l-1.5-1L7 7l1 1.5a6.5 6.5 0 00-.5 1.2L5.8 10v2l1.7.5a6.5 6.5 0 00.5 1.2l-1 1.5L7 17l1.5-1a6.5 6.5 0 001.2.5L10 18h2l.5-1.7a6.5 6.5 0 001.2-.5l1.5 1 1.8-1.8-1-1.5c.2-.4.4-.8.5-1.2L20 12v0z" />
    </svg>
  ),
};

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const links =
    user?.role === "ADMIN"
      ? [
          { to: "/dashboard", label: "Dashboard", subtitle: "Operational overview and live KPIs" },
          { to: "/pos", label: "POS Billing", subtitle: "Fast checkout and order operations" },
          { to: "/products", label: "Products", subtitle: "Menu catalog and pricing control" },
          { to: "/inventory", label: "Inventory", subtitle: "Stock, ingredients, and alerts" },
          { to: "/reports", label: "Reports", subtitle: "Sales intelligence and analytics" },
          { to: "/crm", label: "CRM", subtitle: "Customer loyalty and campaign workflows" },
          { to: "/settings", label: "Settings", subtitle: "System configuration and security" },
        ]
      : [{ to: "/pos", label: "POS Billing", subtitle: "Fast checkout and order operations" }];

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

  return (
    <div className="cv-shell">
      <AlertNotifications />

      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="cv-mobile-backdrop"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <aside className={`cv-sidebar ${mobileNavOpen ? "is-open" : ""}`}>
        <div className="cv-brand">
          <div className="cv-brand-media">
            <img src={logo} alt="Camellia POS Logo" className="h-full w-full object-cover" />
          </div>
          <div>
            <div className="cv-brand-title">Camellia POS</div>
            <div className="cv-brand-subtitle">Cafe & Restaurant</div>
          </div>
        </div>

        <nav className="cv-nav">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `cv-nav-link ${isActive ? "is-active" : ""}`}
            >
              <span className="cv-nav-icon">{menuIcons[link.label]}</span>
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
              <div className="cv-route-pill">{activeLink?.label || "Workspace"}</div>
              <div className="cv-route-subtitle">{activeLink?.subtitle || "Professional POS operations"}</div>
            </div>
          </div>

          <div className="cv-topbar-end">
            <div className="cv-role-chip">{user?.role || "USER"}</div>
            <div className="cv-date-chip">
              {new Date().toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          </div>
        </header>

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

