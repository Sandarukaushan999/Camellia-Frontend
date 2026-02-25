import React, { useEffect, useMemo, useState } from "react";
import api from "../utils/api.js";
import publicApi from "../utils/publicApi.js";
import { getActiveBranchId, onActiveBranchChange } from "../utils/branchContext.js";

const PUBLIC_HOST_STORAGE_KEY = "cv_public_menu_host";

function getDefaultPublicHost() {
  if (typeof window === "undefined") {
    return "";
  }
  return `${window.location.protocol}//${window.location.host}`;
}

function normalizePublicHost(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) {
    return "";
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  return `http://${raw}`;
}

function buildQrImageUrl(targetUrl, size = 320) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=12&data=${encodeURIComponent(
    targetUrl
  )}`;
}

function toMoney(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function QRCategory() {
  const [branches, setBranches] = useState([]);
  const [activeBranchId, setActiveBranchId] = useState(() => getActiveBranchId(null));
  const [publicHostInput, setPublicHostInput] = useState(() => {
    try {
      return localStorage.getItem(PUBLIC_HOST_STORAGE_KEY) || getDefaultPublicHost();
    } catch {
      return getDefaultPublicHost();
    }
  });
  const [menuPreview, setMenuPreview] = useState({ categories: [], items: [], branch: null });
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => onActiveBranchChange((nextBranchId) => setActiveBranchId(nextBranchId)), []);

  useEffect(() => {
    let mounted = true;
    const loadBranches = async () => {
      try {
        const { data } = await api.get("/branches");
        if (!mounted) {
          return;
        }
        const active = Array.isArray(data) ? data.filter((branch) => branch?.is_active !== false) : [];
        setBranches(active);
        if (active.length > 0 && !active.some((branch) => Number(branch.id) === Number(activeBranchId))) {
          setActiveBranchId(Number(active[0].id));
        }
      } catch (err) {
        console.error("Failed to load branches for QR menu:", err);
        if (mounted) {
          setBranches([]);
          setMessage("Failed to load branches");
        }
      }
    };
    loadBranches();
    return () => {
      mounted = false;
    };
  }, [activeBranchId]);

  const selectedBranch = useMemo(
    () => branches.find((branch) => Number(branch.id) === Number(activeBranchId)) || branches[0] || null,
    [activeBranchId, branches]
  );

  const normalizedPublicHost = useMemo(
    () => normalizePublicHost(publicHostInput) || getDefaultPublicHost(),
    [publicHostInput]
  );

  const menuPath = useMemo(() => {
    if (!selectedBranch?.id) {
      return "/menu";
    }
    return `/menu?branch_id=${encodeURIComponent(String(selectedBranch.id))}`;
  }, [selectedBranch?.id]);

  const menuUrl = useMemo(() => `${normalizedPublicHost}${menuPath}`, [menuPath, normalizedPublicHost]);
  const qrImageUrl = useMemo(() => buildQrImageUrl(menuUrl, 340), [menuUrl]);

  useEffect(() => {
    try {
      localStorage.setItem(PUBLIC_HOST_STORAGE_KEY, normalizedPublicHost);
    } catch {
      // ignore storage errors
    }
  }, [normalizedPublicHost]);

  useEffect(() => {
    if (!selectedBranch?.code) {
      setMenuPreview({ categories: [], items: [], branch: null });
      return;
    }
    let mounted = true;
    const loadPreview = async () => {
      setLoadingPreview(true);
      try {
        const { data } = await publicApi.get("/public/menu", {
          params: { branch_code: selectedBranch.code },
        });
        if (!mounted) {
          return;
        }
        setMenuPreview({
          categories: Array.isArray(data?.categories) ? data.categories : [],
          items: Array.isArray(data?.items) ? data.items : [],
          branch: data?.branch || null,
        });
      } catch (err) {
        console.error("Failed to load QR menu preview:", err);
        if (mounted) {
          setMenuPreview({ categories: [], items: [], branch: null });
        }
      } finally {
        if (mounted) {
          setLoadingPreview(false);
        }
      }
    };
    loadPreview();
    return () => {
      mounted = false;
    };
  }, [selectedBranch?.code]);

  const copyMenuUrl = async () => {
    try {
      await navigator.clipboard.writeText(menuUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy menu URL:", err);
      setMessage("Failed to copy menu link");
      setTimeout(() => setMessage(""), 1800);
    }
  };

  const totalItems = Array.isArray(menuPreview.items) ? menuPreview.items.length : 0;
  const totalCategories = Array.isArray(menuPreview.categories) ? menuPreview.categories.length : 0;

  return (
    <div className="cv-page cv-page--qr p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="cv-page-header flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="cv-page-title text-2xl font-bold text-gray-900">QR Category</h1>
            <p className="cv-page-subtitle text-sm text-gray-600 mt-1">
              Stable QR code for customers. Menu updates live whenever products and prices change.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-lime-300 bg-lime-50 px-3 py-1 text-xs font-semibold text-lime-800">
            <i className="fi-rr-qrcode" aria-hidden="true" />
            Stable QR, dynamic menu content
          </div>
        </div>

        <div className="cv-qr-grid grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr]">
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">QR Settings</h2>

            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                Branch
              </label>
              <select
                value={selectedBranch?.id || ""}
                onChange={(event) => setActiveBranchId(Number.parseInt(event.target.value, 10))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.code} - {branch.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                Public Host URL
              </label>
              <input
                type="text"
                value={publicHostInput}
                onChange={(event) => setPublicHostInput(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="https://your-pos-domain.com"
              />
              <p className="text-xs text-gray-500">
                Use your live domain or LAN IP for mobile scanning. Example: `http://192.168.1.25:5173`
              </p>
            </div>

            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Menu URL</div>
              <div className="mt-1 break-all text-sm font-medium text-gray-800">{menuUrl}</div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={copyMenuUrl}
                className="cv-acid-btn rounded-lg px-3 py-2 text-sm font-semibold"
              >
                {copied ? "Copied" : "Copy Link"}
              </button>
              <a
                href={menuUrl}
                target="_blank"
                rel="noreferrer"
                className="cv-acid-btn-soft rounded-lg px-3 py-2 text-center text-sm font-semibold"
              >
                Open Menu
              </a>
            </div>

            <div className="mt-5 flex justify-center">
              <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
                <img
                  src={qrImageUrl}
                  alt="QR Code for customer menu"
                  className="h-[220px] w-[220px] rounded-lg object-contain"
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Menu Preview</h2>
                <p className="text-xs text-gray-500">
                  Branch: {menuPreview.branch?.code || selectedBranch?.code || "-"} -{" "}
                  {menuPreview.branch?.name || selectedBranch?.name || "-"}
                </p>
              </div>
              <div className="flex gap-2 text-xs">
                <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-700">
                  {totalCategories} categories
                </span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
                  {totalItems} items
                </span>
              </div>
            </div>

            {loadingPreview ? (
              <div className="mt-6 rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                Loading menu preview...
              </div>
            ) : totalItems === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                No active products found for this branch.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {menuPreview.categories.map((category) => (
                  <div key={category.name} className="rounded-xl border border-gray-200 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900">{category.name}</h3>
                      <span className="text-xs font-semibold text-gray-500">{category.count} items</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {(Array.isArray(category.items) ? category.items : []).slice(0, 6).map((item) => (
                        <div key={item.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                          <div className="line-clamp-1 text-sm font-semibold text-gray-800">{item.name}</div>
                          <div className="mt-1 text-xs font-medium text-gray-600">{toMoney(item.price)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {message && (
        <div className="fixed bottom-4 right-4 rounded-lg bg-red-600 px-4 py-2 text-sm text-white shadow-lg">
          {message}
        </div>
      )}
    </div>
  );
}
