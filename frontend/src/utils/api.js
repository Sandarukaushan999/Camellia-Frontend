import axios from "axios";

const api = axios.create({
  // In production, use VITE_API_URL if set; in dev, use Vite proxy (/api)
  baseURL: import.meta.env.VITE_API_URL || "/api",
});

// Request interceptor: Always add token from localStorage if available
api.interceptors.request.use(
  (config) => {
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

// Response interceptor: Handle 401 errors
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Token expired or invalid - clear auth and redirect to login
      localStorage.removeItem("cv_user");
      delete api.defaults.headers.common.Authorization;
      // Only redirect if we're not already on login page
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export default api;

