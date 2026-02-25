function sanitizeBase(base) {
  const raw = String(base || "").trim();
  if (!raw) return "";
  return raw.replace(/\/+$/, "");
}

function appendApiPath(base) {
  const clean = sanitizeBase(base);
  if (!clean) return "/api";
  if (/\/api$/i.test(clean)) return clean;
  return `${clean}/api`;
}

export function resolveApiBaseUrl() {
  const configured = sanitizeBase(import.meta.env.VITE_API_URL);
  if (!configured) return "/api";

  if (/^https?:\/\//i.test(configured)) {
    try {
      const url = new URL(configured);
      const pathname = sanitizeBase(url.pathname);
      if (!pathname || pathname === "/") {
        url.pathname = "/api";
      } else if (!/\/api$/i.test(pathname)) {
        url.pathname = `${pathname}/api`;
      }
      return url.toString().replace(/\/+$/, "");
    } catch {
      return appendApiPath(configured);
    }
  }

  if (configured.startsWith("/")) {
    return appendApiPath(configured);
  }

  return appendApiPath(configured);
}

