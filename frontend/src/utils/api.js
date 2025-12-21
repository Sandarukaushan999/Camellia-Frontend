import axios from "axios";

// In production, use VITE_API_URL if set; in dev, use Vite proxy (/api)
// Backend URL: https://camellia-backend-production.up.railway.app/api
const baseURL = import.meta.env.VITE_API_URL || "/api";

// Always log the base URL for debugging (helps identify configuration issues)
console.log("[API Config] Base URL:", baseURL);
console.log("[API Config] Mode:", import.meta.env.MODE);
console.log("[API Config] VITE_API_URL:", import.meta.env.VITE_API_URL || "NOT SET - using /api");

const api = axios.create({
  baseURL,
});

// Request interceptor: Always add token from localStorage if available
api.interceptors.request.use(
  (config) => {
    // Log the full URL being called (helpful for debugging)
    const fullURL = config.baseURL + config.url;
    console.log(`[API Request] ${config.method?.toUpperCase()} ${fullURL}`);
    
    const cached = localStorage.getItem("cv_user");
    if (cached) {
      try {
        const user = JSON.parse(cached);
        if (user?.token) {
          config.headers.Authorization = `Bearer ${user.token}`;
        }
      } catch (e) {
        // Invalid JSON, ignore
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle errors
api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Handle 401 errors - unauthorized
    if (err.response?.status === 401) {
      // Token expired or invalid - clear auth and redirect to login
      localStorage.removeItem("cv_user");
      delete api.defaults.headers.common.Authorization;
      // Only redirect if we're not already on login page
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    // Handle 404 errors - not found
    if (err.response?.status === 404) {
      console.error("API endpoint not found:", err.config?.url);
      console.error("Full URL:", err.config?.baseURL + err.config?.url);
      console.error("Full error:", err.response?.data);
    }
    // Handle network errors (backend not reachable)
    if (!err.response && err.code === "ERR_NETWORK") {
      console.error("Backend server is not reachable. Please ensure the backend is running.");
      console.error("API Base URL:", api.defaults.baseURL);
      console.error("Requested URL:", err.config?.baseURL + err.config?.url);
    }
    return Promise.reject(err);
  }
);

export default api;

