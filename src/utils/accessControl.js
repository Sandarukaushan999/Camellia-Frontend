const ADMIN_FALLBACK_FULL_ACCESS = true;

export function getUserPermissions(user) {
  if (!Array.isArray(user?.permissions)) {
    return [];
  }
  return user.permissions
    .map((permission) => String(permission || "").trim())
    .filter(Boolean);
}

export function hasPermission(user, permission) {
  const required = String(permission || "").trim();
  if (!required) {
    return true;
  }
  if (!user) {
    return false;
  }

  const permissions = getUserPermissions(user);
  if (
    ADMIN_FALLBACK_FULL_ACCESS &&
    String(user.role || "").toUpperCase() === "ADMIN" &&
    permissions.length === 0
  ) {
    return true;
  }

  return permissions.includes(required);
}

export function hasAllPermissions(user, requiredPermissions = []) {
  const required = Array.isArray(requiredPermissions)
    ? requiredPermissions.filter(Boolean)
    : [];
  if (required.length === 0) {
    return true;
  }
  return required.every((permission) => hasPermission(user, permission));
}

export function getDefaultRoute(user, options = {}) {
  if (!user) {
    return "/login";
  }

  const openPOSOnStart = options.openPOSOnStart !== false;
  const role = String(user.role || "").toUpperCase();

  if (role !== "ADMIN") {
    if (hasPermission(user, "pos.view")) {
      return "/pos";
    }
    if (hasPermission(user, "sales.view")) {
      return "/sales";
    }
    return "/pos";
  }

  if (openPOSOnStart && hasPermission(user, "pos.view")) {
    return "/pos";
  }
  if (hasPermission(user, "dashboard.view")) {
    return "/dashboard";
  }
  if (hasPermission(user, "pos.view")) {
    return "/pos";
  }
  if (hasPermission(user, "sales.view")) {
    return "/sales";
  }
  if (hasPermission(user, "products.view")) {
    return "/products";
  }
  if (hasPermission(user, "inventory.view")) {
    return "/inventory";
  }
  if (hasPermission(user, "expenses.view")) {
    return "/expenses";
  }
  if (hasPermission(user, "reports.view")) {
    return "/reports";
  }
  if (hasPermission(user, "crm.view")) {
    return "/crm";
  }
  if (hasPermission(user, "users.view")) {
    return "/user-management";
  }
  if (hasPermission(user, "settings.view")) {
    return "/settings";
  }
  return "/pos";
}
