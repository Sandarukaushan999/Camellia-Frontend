import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(username, password);
      navigate(user.role === "ADMIN" ? "/dashboard" : "/pos");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-xl p-8 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Login</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <button
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400"
              type="submit"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>
        </div>
        
        {/* Copyright Footer */}
        <div className="mt-8 text-center text-xs text-gray-600">
          <div className="space-y-1">
            <div>© {new Date().getFullYear()} VOXOsolution</div>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <a href="mailto:voxosolution@gmail.com" className="hover:text-blue-600 transition-colors">
                voxosolution@gmail.com
              </a>
              <span>•</span>
              <a href="https://wa.me/94710901871" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">
                0710901871
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

