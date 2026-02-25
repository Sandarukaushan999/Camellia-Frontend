import React, { useEffect, useMemo, useState } from "react";
import api from "../utils/api.js";
import { useAuth } from "../state/AuthContext.jsx";
import { formatBusinessDateTime } from "../utils/timezone.js";

const USER_FORM_DEFAULT = {
  username: "",
  password: "",
  role: "CASHIER",
  custom_role_id: "",
  is_active: true,
};

const ROLE_FORM_DEFAULT = {
  id: null,
  name: "",
  description: "",
  base_role: "ADMIN",
  permissions: [],
};

function buildUserDraft(user) {
  return {
    username: user.username || "",
    role: user.role || "CASHIER",
    custom_role_id: user.custom_role_id ? String(user.custom_role_id) : "",
    is_active: user.is_active !== false,
  };
}

function buildUserDraftMap(users) {
  const map = {};
  for (const user of users) {
    map[user.id] = buildUserDraft(user);
  }
  return map;
}

function toDateTime(value) {
  return formatBusinessDateTime(value, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState("users");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [userDrafts, setUserDrafts] = useState({});
  const [userForm, setUserForm] = useState({ ...USER_FORM_DEFAULT });
  const [roleForm, setRoleForm] = useState({ ...ROLE_FORM_DEFAULT });
  const [roleMode, setRoleMode] = useState("create");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const showMessage = (text, error = false) => {
    setMessage(text);
    setIsError(error);
    window.clearTimeout(showMessage.timer);
    showMessage.timer = window.setTimeout(() => setMessage(""), 3000);
  };
  showMessage.timer = showMessage.timer || null;

  const roleOptionsByBase = useMemo(() => {
    return roles.reduce((acc, role) => {
      if (role.is_active === false) return acc;
      const base = String(role.base_role || "ADMIN").toUpperCase();
      if (!acc[base]) acc[base] = [];
      acc[base].push(role);
      return acc;
    }, {});
  }, [roles]);

  const permissionGroups = useMemo(() => {
    return permissions.reduce((acc, item) => {
      const key = String(item.module || "general").toUpperCase();
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [permissions]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [permRes, roleRes, userRes] = await Promise.all([
        api.get("/admin/access/permissions"),
        api.get("/admin/access/roles"),
        api.get("/admin/users", { params: { include_inactive: true } }),
      ]);
      const nextUsers = Array.isArray(userRes.data) ? userRes.data : [];
      setPermissions(Array.isArray(permRes.data) ? permRes.data : []);
      setRoles(Array.isArray(roleRes.data) ? roleRes.data : []);
      setUsers(nextUsers);
      setUserDrafts(buildUserDraftMap(nextUsers));
    } catch (err) {
      showMessage(err?.response?.data?.message || "Failed to load user management", true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    return () => window.clearTimeout(showMessage.timer);
  }, []);

  const refreshUsers = async () => {
    const { data } = await api.get("/admin/users", { params: { include_inactive: true } });
    const rows = Array.isArray(data) ? data : [];
    setUsers(rows);
    setUserDrafts(buildUserDraftMap(rows));
  };

  const refreshRoles = async () => {
    const { data } = await api.get("/admin/access/roles");
    setRoles(Array.isArray(data) ? data : []);
  };
  const onUserDraftChange = (userId, field, value) => {
    setUserDrafts((prev) => {
      const current = prev[userId] || {};
      const next = { ...current, [field]: value };
      if (field === "role") {
        const options = roleOptionsByBase[value] || [];
        const stillValid = options.some((role) => String(role.id) === String(next.custom_role_id || ""));
        if (!stillValid) next.custom_role_id = "";
      }
      return { ...prev, [userId]: next };
    });
  };

  const onCreateUser = async (event) => {
    event.preventDefault();
    const payload = {
      username: userForm.username.trim(),
      password: userForm.password,
      role: userForm.role,
      custom_role_id: userForm.custom_role_id ? Number.parseInt(userForm.custom_role_id, 10) : null,
      is_active: userForm.is_active !== false,
    };
    if (!payload.username) {
      showMessage("Username is required", true);
      return;
    }
    if ((payload.password || "").length < 6) {
      showMessage("Password must be at least 6 characters", true);
      return;
    }

    setBusy(true);
    try {
      await api.post("/admin/users", payload);
      await refreshUsers();
      setUserForm({ ...USER_FORM_DEFAULT, role: payload.role });
      showMessage("User created");
    } catch (err) {
      showMessage(err?.response?.data?.message || "Failed to create user", true);
    } finally {
      setBusy(false);
    }
  };

  const onSaveUser = async (userId) => {
    const draft = userDrafts[userId];
    if (!draft) return;
    setBusy(true);
    try {
      await api.put(`/admin/users/${userId}`, {
        username: String(draft.username || "").trim(),
        role: draft.role,
        custom_role_id: draft.custom_role_id ? Number.parseInt(draft.custom_role_id, 10) : null,
        is_active: draft.is_active !== false,
      });
      await refreshUsers();
      showMessage("User updated");
    } catch (err) {
      showMessage(err?.response?.data?.message || "Failed to update user", true);
    } finally {
      setBusy(false);
    }
  };

  const onResetPassword = async (user) => {
    const password = window.prompt(`New password for ${user.username}:`, "");
    if (password === null) return;
    const confirm = window.prompt("Confirm password:", "");
    if (confirm === null) return;

    setBusy(true);
    try {
      await api.post(`/admin/users/${user.id}/reset-password`, {
        password,
        confirm_password: confirm,
      });
      showMessage("Password reset complete");
    } catch (err) {
      showMessage(err?.response?.data?.message || "Failed to reset password", true);
    } finally {
      setBusy(false);
    }
  };

  const onDeleteUser = async (user) => {
    if (!window.confirm(`Delete user '${user.username}'? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api.delete(`/admin/users/${user.id}`);
      await refreshUsers();
      showMessage("User deleted");
    } catch (err) {
      showMessage(err?.response?.data?.message || "Failed to delete user", true);
    } finally {
      setBusy(false);
    }
  };

  const toggleRolePermission = (key) => {
    setRoleForm((prev) => {
      const current = Array.isArray(prev.permissions) ? prev.permissions : [];
      const exists = current.includes(key);
      return {
        ...prev,
        permissions: exists ? current.filter((item) => item !== key) : [...current, key],
      };
    });
  };

  const resetRoleForm = () => {
    setRoleMode("create");
    setRoleForm({ ...ROLE_FORM_DEFAULT });
  };

  const onEditRole = (role) => {
    setRoleMode("edit");
    setRoleForm({
      id: role.id,
      name: role.name || "",
      description: role.description || "",
      base_role: role.base_role || "ADMIN",
      permissions: Array.isArray(role.permissions) ? role.permissions : [],
    });
    setTab("roles");
  };

  const onSaveRole = async (event) => {
    event.preventDefault();
    const payload = {
      name: roleForm.name.trim(),
      description: roleForm.description.trim(),
      base_role: roleForm.base_role,
      permissions: roleForm.permissions,
    };
    if (!payload.name || payload.name.length < 3) {
      showMessage("Role name must be at least 3 characters", true);
      return;
    }
    if (!Array.isArray(payload.permissions) || payload.permissions.length === 0) {
      showMessage("Select at least one permission", true);
      return;
    }

    setBusy(true);
    try {
      if (roleMode === "edit" && roleForm.id) {
        await api.put(`/admin/access/roles/${roleForm.id}`, payload);
        showMessage("Role updated");
      } else {
        await api.post("/admin/access/roles", payload);
        showMessage("Role created");
      }
      await refreshRoles();
      await refreshUsers();
      resetRoleForm();
    } catch (err) {
      showMessage(err?.response?.data?.message || "Failed to save role", true);
    } finally {
      setBusy(false);
    }
  };

  const onDeleteRole = async (role) => {
    if (!window.confirm(`Delete role '${role.name}'?`)) return;
    setBusy(true);
    try {
      await api.delete(`/admin/access/roles/${role.id}`);
      await refreshRoles();
      await refreshUsers();
      if (Number(roleForm.id) === Number(role.id)) resetRoleForm();
      showMessage("Role deleted");
    } catch (err) {
      showMessage(err?.response?.data?.message || "Failed to delete role", true);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="cv-page cv-page--users p-6">
        <div className="max-w-7xl mx-auto bg-white border border-gray-200 rounded-xl p-8 text-gray-600">
          Loading user management...
        </div>
      </div>
    );
  }

  return (
    <div className="cv-page cv-page--users p-4 md:p-6 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="cv-page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="cv-page-title text-2xl font-bold text-gray-900 flex items-center gap-2">
              <i className="fi-rr-users-gear" aria-hidden="true" />
              User Management
            </h1>
            <p className="cv-page-subtitle text-sm text-gray-600 mt-1">
              Manage users, custom roles, and permission-based access
            </p>
          </div>
          <button type="button" onClick={loadData} className="cv-acid-btn px-4 py-2 rounded-lg text-sm font-semibold" disabled={busy}>
            Refresh
          </button>
        </div>

        <div className="cv-users-tabs bg-white border border-gray-200 rounded-xl p-2 inline-flex gap-2">
          <button type="button" onClick={() => setTab("users")} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === "users" ? "cv-acid-btn" : "bg-gray-100 text-gray-700"}`}>
            Users
          </button>
          <button type="button" onClick={() => setTab("roles")} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === "roles" ? "cv-acid-btn" : "bg-gray-100 text-gray-700"}`}>
            Roles & Permissions
          </button>
        </div>
        {tab === "users" && (
          <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-4">
            <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <i className="fi-rr-user-add" aria-hidden="true" />
                Add User
              </h2>
              <form onSubmit={onCreateUser} className="space-y-3">
                <input
                  type="text"
                  value={userForm.username}
                  onChange={(event) => setUserForm((prev) => ({ ...prev, username: event.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Username"
                  autoComplete="off"
                  required
                />
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(event) => setUserForm((prev) => ({ ...prev, password: event.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Password"
                  required
                />
                <select
                  value={userForm.role}
                  onChange={(event) => setUserForm((prev) => ({ ...prev, role: event.target.value, custom_role_id: "" }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="CASHIER">CASHIER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
                <select
                  value={userForm.custom_role_id}
                  onChange={(event) => setUserForm((prev) => ({ ...prev, custom_role_id: event.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Auto default</option>
                  {(roleOptionsByBase[userForm.role] || []).map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={userForm.is_active !== false}
                    onChange={(event) => setUserForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                  />
                  Active user
                </label>
                <button type="submit" disabled={busy} className={`w-full px-4 py-2.5 rounded-lg font-semibold ${busy ? "bg-gray-300 text-gray-500" : "cv-acid-btn"}`}>
                  Create User
                </button>
              </form>
            </section>

            <section className="cv-table-card cv-table-wrap bg-white border border-gray-200 rounded-xl overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left">Username</th>
                    <th className="px-4 py-3 text-left">Role</th>
                    <th className="px-4 py-3 text-left">Custom Role</th>
                    <th className="px-4 py-3 text-center">Active</th>
                    <th className="px-4 py-3 text-center">Perms</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-gray-500">No users found</td>
                    </tr>
                  ) : (
                    users.map((user) => {
                      const draft = userDrafts[user.id] || buildUserDraft(user);
                      const options = roleOptionsByBase[draft.role] || [];
                      const isSuperAdminRow =
                        user.is_super_admin === true ||
                        String(user.username || "").trim().toUpperCase() === "VOXO";
                      const actorIsSuperAdmin =
                        currentUser?.isSuperAdmin === true ||
                        String(currentUser?.username || "").trim().toUpperCase() === "VOXO";
                      const lockProtectedRow = isSuperAdminRow && !actorIsSuperAdmin;
                      const isSelf = String(currentUser?.id || "") === String(user.id);
                      return (
                        <tr key={user.id}>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={draft.username || ""}
                              onChange={(event) => onUserDraftChange(user.id, "username", event.target.value)}
                              className="w-full min-w-[160px] px-3 py-2 border border-gray-300 rounded-lg"
                              disabled={busy || lockProtectedRow}
                            />
                            {isSuperAdminRow ? (
                              <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                                SUPER ADMIN
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={draft.role || "CASHIER"}
                              onChange={(event) => onUserDraftChange(user.id, "role", event.target.value)}
                              className="w-full min-w-[120px] px-3 py-2 border border-gray-300 rounded-lg"
                              disabled={busy || lockProtectedRow}
                            >
                              <option value="CASHIER">CASHIER</option>
                              <option value="ADMIN">ADMIN</option>
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={draft.custom_role_id || ""}
                              onChange={(event) => onUserDraftChange(user.id, "custom_role_id", event.target.value)}
                              className="w-full min-w-[180px] px-3 py-2 border border-gray-300 rounded-lg"
                              disabled={busy || lockProtectedRow}
                            >
                              <option value="">Auto default</option>
                              {options.map((role) => (
                                <option key={role.id} value={role.id}>{role.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={draft.is_active !== false}
                              onChange={(event) => onUserDraftChange(user.id, "is_active", event.target.checked)}
                              disabled={busy || lockProtectedRow}
                            />
                          </td>
                          <td className="px-4 py-3 text-center">{Array.isArray(user.permissions) ? user.permissions.length : 0}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => onSaveUser(user.id)} disabled={busy || lockProtectedRow} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${busy || lockProtectedRow ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-gray-100 hover:bg-gray-200"}`}>Save</button>
                              <button type="button" onClick={() => onResetPassword(user)} disabled={busy || lockProtectedRow} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${busy || lockProtectedRow ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-gray-100 hover:bg-gray-200"}`}>Reset</button>
                              <button
                                type="button"
                                onClick={() => onDeleteUser(user)}
                                disabled={busy || isSuperAdminRow || isSelf}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${busy || isSuperAdminRow || isSelf ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-red-100 text-red-700 hover:bg-red-200"}`}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </section>
          </div>
        )}
        {tab === "roles" && (
          <div className="grid grid-cols-1 xl:grid-cols-[400px_1fr] gap-4">
            <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <i className="fi-rr-user-gear" aria-hidden="true" />
                {roleMode === "edit" ? "Edit Role" : "Create Role"}
              </h2>
              <form onSubmit={onSaveRole} className="space-y-3">
                <input
                  type="text"
                  value={roleForm.name}
                  onChange={(event) => setRoleForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Role name"
                  required
                />
                <select
                  value={roleForm.base_role}
                  onChange={(event) => setRoleForm((prev) => ({ ...prev, base_role: event.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="ADMIN">ADMIN</option>
                  <option value="CASHIER">CASHIER</option>
                </select>
                <textarea
                  value={roleForm.description}
                  onChange={(event) => setRoleForm((prev) => ({ ...prev, description: event.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                  placeholder="Description"
                />
                <div className="border border-gray-200 rounded-lg p-3 max-h-72 overflow-y-auto space-y-3">
                  {Object.entries(permissionGroups).map(([group, items]) => (
                    <div key={group} className="space-y-2">
                      <div className="text-xs font-bold text-gray-700 uppercase">{group}</div>
                      {items.map((permission) => (
                        <label key={permission.key} className="flex items-start gap-2 text-xs text-gray-700">
                          <input
                            type="checkbox"
                            checked={roleForm.permissions.includes(permission.key)}
                            onChange={() => toggleRolePermission(permission.key)}
                          />
                          <span>
                            <span className="font-semibold">{permission.label}</span>
                            <span className="block text-gray-500">{permission.description}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button type="submit" disabled={busy} className={`flex-1 px-4 py-2.5 rounded-lg font-semibold ${busy ? "bg-gray-300 text-gray-500" : "cv-acid-btn"}`}>
                    {roleMode === "edit" ? "Update Role" : "Create Role"}
                  </button>
                  {roleMode === "edit" && (
                    <button type="button" onClick={resetRoleForm} className="px-4 py-2.5 rounded-lg font-semibold bg-gray-100 text-gray-700">
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </section>

            <section className="cv-table-card cv-table-wrap bg-white border border-gray-200 rounded-xl overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left">Role</th>
                    <th className="px-4 py-3 text-left">Base</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-center">Users</th>
                    <th className="px-4 py-3 text-center">Perms</th>
                    <th className="px-4 py-3 text-left">Updated</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {roles.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-gray-500">No roles found</td>
                    </tr>
                  ) : (
                    roles.map((role) => (
                      <tr key={role.id}>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900">{role.name}</div>
                          {role.description ? <div className="text-xs text-gray-500 mt-0.5">{role.description}</div> : null}
                        </td>
                        <td className="px-4 py-3">{role.base_role}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${role.is_system ? "bg-indigo-100 text-indigo-700" : role.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-700"}`}>
                            {role.is_system ? "SYSTEM" : role.is_active ? "ACTIVE" : "INACTIVE"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">{role.assigned_user_count}</td>
                        <td className="px-4 py-3 text-center">{Array.isArray(role.permissions) ? role.permissions.length : 0}</td>
                        <td className="px-4 py-3 text-xs text-gray-600">{toDateTime(role.updated_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => onEditRole(role)} disabled={busy || role.is_system === true} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${role.is_system ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                              Edit
                            </button>
                            <button type="button" onClick={() => onDeleteRole(role)} disabled={busy || role.is_system === true} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${role.is_system ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-red-100 text-red-700 hover:bg-red-200"}`}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>
          </div>
        )}
      </div>

      {message && (
        <div className={`fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg text-sm font-semibold z-50 ${isError ? "bg-red-600 text-white" : "cv-acid-btn text-[var(--cv-acid-ink)]"}`}>
          {message}
        </div>
      )}
    </div>
  );
}
