import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import publicApi from "../utils/publicApi.js";
import "../styles/public-menu.css";

const PAYMENT_METHOD_OPTIONS = ["CASH", "CARD", "QR", "ONLINE"];
const CUSTOMER_PROFILE_STORAGE_KEY = "cv_public_customer_profiles_v1";
const MAX_STORED_CUSTOMERS = 80;
const MENU_LOAD_TIMEOUT_MS = 45000;
const MENU_LOAD_RETRY_DELAYS_MS = [900, 1800];
const PORTION_OPTIONS = Object.freeze(["SMALL", "LARGE"]);

const CATEGORY_ORDER = ["burger", "kottu", "noodles", "submarine", "cafe", "juice", "rice", "pizza"];
const CATEGORY_META = {
  all: { label: "ALL", icon: "\uD83D\uDCE6" },
  burger: { label: "Burger", icon: "\uD83C\uDF54" },
  kottu: { label: "Kottu", icon: "\uD83C\uDF5C" },
  noodles: { label: "Noodles", icon: "\uD83C\uDF5D" },
  noodle: { label: "Noodles", icon: "\uD83C\uDF5D" },
  submarine: { label: "Submarine", icon: "\uD83E\uDD56" },
  cafe: { label: "Caf\u00e9", icon: "\u2615" },
  juice: { label: "Juice", icon: "\uD83E\uDD64" },
  rice: { label: "Rice", icon: "\uD83C\uDF5A" },
  pizza: { label: "Pizza", icon: "\uD83C\uDF55" },
};

const DEFAULT_ORDER_FORM = {
  customer_name: "",
  customer_phone: "",
  customer_email: "",
  customer_address: "",
  table_number: "",
  payment_method: "CASH",
  note: "",
};

function toSafeMoney(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

function toMoney(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalizePhone(value) {
  return String(value || "").replace(/[^\d+]/g, "").trim().slice(0, 24);
}

function normalizeCategory(value) {
  return String(value || "").trim() || "Other";
}

function normalizePortion(value) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  return PORTION_OPTIONS.includes(normalized) ? normalized : null;
}

function getPortionLabel(portion) {
  return normalizePortion(portion) === "LARGE" ? "Large" : "Small";
}

function getMenuItemPortionPrices(item) {
  const smallPriceRaw = toSafeMoney(
    item?.small_price ??
      item?.smallPrice ??
      item?.portion_prices?.small ??
      item?.portions?.small,
    NaN
  );
  const largePriceRaw = toSafeMoney(
    item?.large_price ??
      item?.largePrice ??
      item?.portion_prices?.large ??
      item?.portions?.large,
    NaN
  );
  const basePrice = toSafeMoney(item?.price, 0);

  const hasSmall = Number.isFinite(smallPriceRaw) && smallPriceRaw > 0;
  const hasLarge = Number.isFinite(largePriceRaw) && largePriceRaw > 0;
  const hasPortions = item?.has_portions === true || hasSmall || hasLarge;

  const smallPrice = hasSmall ? smallPriceRaw : hasLarge ? largePriceRaw : basePrice;
  const largePrice = hasLarge ? largePriceRaw : hasSmall ? smallPriceRaw : basePrice;

  return {
    hasPortions,
    basePrice,
    smallPrice,
    largePrice,
  };
}

function resolveMenuItemUnitPrice(item, portion = null) {
  const normalizedPortion = normalizePortion(portion);
  const pricing = getMenuItemPortionPrices(item);
  if (!pricing.hasPortions || !normalizedPortion) {
    return pricing.basePrice;
  }
  if (normalizedPortion === "LARGE") {
    return pricing.largePrice;
  }
  return pricing.smallPrice;
}

function buildCartKey(productId, portion = null) {
  const normalizedPortion = normalizePortion(portion);
  return `${String(productId || "")}::${normalizedPortion || "DEFAULT"}`;
}

function getDisplayName(name, portion = null) {
  const baseName = String(name || "").trim() || "Item";
  const normalizedPortion = normalizePortion(portion);
  if (!normalizedPortion) {
    return baseName;
  }
  return `${baseName} (${getPortionLabel(normalizedPortion)})`;
}

function categoryKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getDetectedTable(search) {
  const params = new URLSearchParams(search);
  const raw =
    params.get("table") || params.get("table_no") || params.get("table_number") || "";
  return String(raw).trim().slice(0, 40);
}

function categoryLabelFromKey(key) {
  const raw = String(key || "").trim();
  if (!raw) return "Other";
  return raw
    .split(/[\s_-]+/g)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function getCategoryMeta(categoryPageKey) {
  const meta = CATEGORY_META[categoryPageKey];
  if (meta) return meta;
  return { label: categoryLabelFromKey(categoryPageKey), icon: "\uD83D\uDCE6" };
}

function isEmailValid(value) {
  const email = String(value || "").trim();
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function shouldRetryMenuLoad(err) {
  const status = Number(err?.response?.status || 0);
  if (status >= 500 || status === 429 || status === 0) {
    return true;
  }
  const code = String(err?.code || "").toUpperCase();
  if (
    code === "ECONNABORTED" ||
    code === "ERR_NETWORK" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET"
  ) {
    return true;
  }
  return /timeout/i.test(String(err?.message || ""));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadPublicMenuWithRetry(params) {
  let lastError = null;
  for (let attempt = 0; attempt <= MENU_LOAD_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await publicApi.get("/public/menu", {
        params,
        timeout: MENU_LOAD_TIMEOUT_MS,
      });
    } catch (err) {
      lastError = err;
      const isLastAttempt = attempt >= MENU_LOAD_RETRY_DELAYS_MS.length;
      if (isLastAttempt || !shouldRetryMenuLoad(err)) {
        throw err;
      }
      await wait(MENU_LOAD_RETRY_DELAYS_MS[attempt]);
    }
  }
  throw lastError;
}

function validatePublicOrderForm(formValues) {
  const errors = {};
  const name = String(formValues?.customer_name || "").trim();
  const phone = normalizePhone(formValues?.customer_phone || "");
  const email = String(formValues?.customer_email || "").trim();

  if (name.length < 2) errors.customer_name = "Name must be at least 2 characters.";
  if (phone && phone.length < 7) errors.customer_phone = "Phone number looks too short.";
  if (email && !isEmailValid(email)) errors.customer_email = "Enter a valid email address.";
  return errors;
}

function readStoredCustomerProfiles() {
  try {
    const raw = localStorage.getItem(CUSTOMER_PROFILE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function trimCustomerProfiles(profileMap = {}) {
  const sorted = Object.entries(profileMap).sort((a, b) => {
    const aTime = new Date(a[1]?.updated_at || 0).getTime();
    const bTime = new Date(b[1]?.updated_at || 0).getTime();
    return bTime - aTime;
  });
  return Object.fromEntries(sorted.slice(0, MAX_STORED_CUSTOMERS));
}

const PublicOrderPaymentForm = React.memo(function PublicOrderPaymentForm({
  detectedTable,
  cartTotal,
  cartLineCount,
  submitting,
  resetToken,
  onSubmit,
}) {
  const [orderForm, setOrderForm] = useState(() => ({
    ...DEFAULT_ORDER_FORM,
    table_number: detectedTable || "",
  }));
  const [customerProfiles, setCustomerProfiles] = useState(() => readStoredCustomerProfiles());
  const [crmLookupState, setCrmLookupState] = useState("idle");
  const [crmLookupMessage, setCrmLookupMessage] = useState("");
  const [touchedFields, setTouchedFields] = useState({});

  useEffect(() => {
    setOrderForm({
      ...DEFAULT_ORDER_FORM,
      table_number: detectedTable || "",
    });
    setCrmLookupState("idle");
    setCrmLookupMessage("");
    setTouchedFields({});
  }, [detectedTable, resetToken]);

  useEffect(() => {
    try {
      localStorage.setItem(
        CUSTOMER_PROFILE_STORAGE_KEY,
        JSON.stringify(trimCustomerProfiles(customerProfiles))
      );
    } catch {
      // ignore storage errors
    }
  }, [customerProfiles]);

  useEffect(() => {
    const phone = normalizePhone(orderForm.customer_phone);
    if (!phone || phone.length < 7) {
      setCrmLookupState("idle");
      setCrmLookupMessage("");
      return undefined;
    }

    let active = true;
    const timeout = setTimeout(async () => {
      try {
        setCrmLookupState("loading");
        setCrmLookupMessage("");
        const { data } = await publicApi.get("/public/customer-profile", { params: { phone } });
        if (!active) return;
        const customer = data?.customer || null;
        if (customer) {
          setOrderForm((prev) => ({
            ...prev,
            customer_name: prev.customer_name || customer.full_name || "",
            customer_email: prev.customer_email || customer.email || "",
            customer_address: prev.customer_address || customer.address || "",
          }));
          setCrmLookupState("found");
          setCrmLookupMessage("Customer found in CRM. Details auto-filled.");
        } else {
          setCrmLookupState("not-found");
          setCrmLookupMessage(
            "Phone not found in CRM. Customer profile will be created automatically after order."
          );
        }
      } catch {
        if (!active) return;
        setCrmLookupState("error");
        setCrmLookupMessage("CRM lookup unavailable. You can still place the order.");
      }
    }, 280);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [orderForm.customer_phone]);

  const matchedProfile = useMemo(() => {
    const key = normalizePhone(orderForm.customer_phone);
    return key ? customerProfiles[key] || null : null;
  }, [customerProfiles, orderForm.customer_phone]);

  const validationErrors = useMemo(() => validatePublicOrderForm(orderForm), [orderForm]);
  const hasValidationErrors = Object.keys(validationErrors).length > 0;
  const canPlaceOrder =
    !hasValidationErrors &&
    String(orderForm.customer_name || "").trim().length >= 2 &&
    cartLineCount > 0;

  const markTouched = (fieldName) => {
    setTouchedFields((prev) => ({ ...prev, [fieldName]: true }));
  };

  const fieldError = (fieldName) =>
    touchedFields[fieldName] ? validationErrors[fieldName] || "" : "";

  const handlePhoneChange = (value) => {
    const normalized = normalizePhone(value);
    setOrderForm((prev) => ({ ...prev, customer_phone: normalized }));
    const profile = normalized ? customerProfiles[normalized] : null;
    if (!profile) return;
    setOrderForm((prev) => ({
      ...prev,
      customer_phone: normalized,
      customer_name: prev.customer_name || profile.customer_name || "",
      customer_email: prev.customer_email || profile.customer_email || "",
      customer_address: prev.customer_address || profile.customer_address || "",
      table_number: prev.table_number || profile.table_number || detectedTable || "",
      payment_method:
        prev.payment_method === "CASH" && profile.payment_method
          ? profile.payment_method
          : prev.payment_method,
      note: prev.note || profile.note || "",
    }));
  };

  return (
    <form
      className="cv-public-order-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setTouchedFields({
          customer_name: true,
          customer_phone: true,
          customer_email: true,
        });
        if (!canPlaceOrder || submitting) return;
        const ok = await onSubmit(orderForm);
        if (!ok) return;
        const phoneKey = normalizePhone(orderForm.customer_phone);
        if (!phoneKey) return;
        setCustomerProfiles((prev) => ({
          ...prev,
          [phoneKey]: {
            customer_name: orderForm.customer_name || "",
            customer_email: orderForm.customer_email || "",
            customer_address: orderForm.customer_address || "",
            table_number: orderForm.table_number || "",
            payment_method: orderForm.payment_method || "CASH",
            note: orderForm.note || "",
            updated_at: new Date().toISOString(),
          },
        }));
      }}
    >
      <label className="cv-public-field">
        <span>Your Name *</span>
        <input
          type="text"
          className="cv-public-input"
          value={orderForm.customer_name}
          onChange={(event) =>
            setOrderForm((prev) => ({ ...prev, customer_name: event.target.value }))
          }
          onBlur={() => markTouched("customer_name")}
          autoComplete="name"
          inputMode="text"
          aria-invalid={Boolean(fieldError("customer_name"))}
          placeholder="Customer name"
          required
        />
        {fieldError("customer_name") && (
          <p className="cv-public-form-error">{fieldError("customer_name")}</p>
        )}
      </label>

      <label className="cv-public-field">
        <span>Phone Number</span>
        <input
          type="tel"
          className="cv-public-input"
          value={orderForm.customer_phone}
          onChange={(event) => handlePhoneChange(event.target.value)}
          onBlur={() => markTouched("customer_phone")}
          autoComplete="tel-national"
          inputMode="tel"
          aria-invalid={Boolean(fieldError("customer_phone"))}
          placeholder="07xxxxxxxx"
        />
        {fieldError("customer_phone") && (
          <p className="cv-public-form-error">{fieldError("customer_phone")}</p>
        )}
      </label>

      {crmLookupMessage && (
        <div
          className={`cv-public-status-chip ${
            crmLookupState === "found"
              ? "is-success"
              : crmLookupState === "not-found"
                ? "is-warning"
                : "is-neutral"
          }`}
        >
          {crmLookupMessage}
        </div>
      )}

      {matchedProfile && (
        <div className="cv-public-status-chip is-neutral">Returning customer detected.</div>
      )}

      <div className="cv-public-form-grid">
        <label className="cv-public-field">
          <span>Email</span>
          <input
            type="email"
            className="cv-public-input"
            value={orderForm.customer_email}
            onChange={(event) =>
              setOrderForm((prev) => ({ ...prev, customer_email: event.target.value }))
            }
            onBlur={() => markTouched("customer_email")}
            autoComplete="email"
            inputMode="email"
            aria-invalid={Boolean(fieldError("customer_email"))}
            placeholder="name@example.com"
          />
          {fieldError("customer_email") && (
            <p className="cv-public-form-error">{fieldError("customer_email")}</p>
          )}
        </label>

        <label className="cv-public-field">
          <span>Address</span>
          <input
            type="text"
            className="cv-public-input"
            value={orderForm.customer_address}
            onChange={(event) =>
              setOrderForm((prev) => ({ ...prev, customer_address: event.target.value }))
            }
            autoComplete="street-address"
            inputMode="text"
            placeholder="Optional address"
          />
        </label>
      </div>

      <div className="cv-public-form-grid">
        <div className="cv-public-order-type-fixed">DINE-IN</div>
        <label className="cv-public-field">
          <span>Payment</span>
          <select
            className="cv-public-input"
            value={orderForm.payment_method}
            onChange={(event) =>
              setOrderForm((prev) => ({ ...prev, payment_method: event.target.value }))
            }
          >
            {PAYMENT_METHOD_OPTIONS.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="cv-public-field">
        <span>Table Number</span>
        <input
          type="text"
          className="cv-public-input"
          value={orderForm.table_number}
          onChange={(event) =>
            setOrderForm((prev) => ({ ...prev, table_number: event.target.value }))
          }
          autoComplete="off"
          inputMode="numeric"
          placeholder="Table no"
        />
      </label>

      {detectedTable && <p className="cv-public-sub-hint">Auto-detected from QR code.</p>}

      <label className="cv-public-field">
        <span>Special Notes</span>
        <textarea
          className="cv-public-input cv-public-textarea"
          value={orderForm.note}
          onChange={(event) => setOrderForm((prev) => ({ ...prev, note: event.target.value }))}
          placeholder="Special notes"
          autoComplete="off"
        />
      </label>

      <div className="cv-public-form-submit-stick">
        <div className="cv-public-total-estimate">
          <div>Estimated Total</div>
          <strong>{toMoney(cartTotal)}</strong>
        </div>
        <button
          type="submit"
          className="cv-public-submit-btn"
          disabled={!canPlaceOrder || submitting}
          aria-disabled={!canPlaceOrder || submitting}
        >
          {submitting ? "Placing..." : "Place Order"}
        </button>
        {crmLookupState === "loading" && (
          <p className="cv-public-sub-hint">Checking CRM customer profile...</p>
        )}
      </div>
    </form>
  );
});

export default function PublicMenu() {
  const { branchCode: routeBranchCode = "" } = useParams();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [menuData, setMenuData] = useState({
    branch: null,
    categories: [],
    items: [],
    generated_at: null,
  });
  const [cart, setCart] = useState({});
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [paymentFormResetToken, setPaymentFormResetToken] = useState(0);
  const [activeCategory, setActiveCategory] = useState("all");
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const detectedTable = useMemo(() => getDetectedTable(location.search), [location.search]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setMessage("");
      const params = {};
      try {
        if (routeBranchCode) {
          params.branch_code = String(routeBranchCode).trim().toUpperCase();
        }
        const qp = new URLSearchParams(location.search);
        const branchId = Number.parseInt(qp.get("branch_id"), 10);
        if (Number.isFinite(branchId) && branchId > 0) {
          params.branch_id = branchId;
        }
        const { data } = await loadPublicMenuWithRetry(params);
        if (!mounted) return;
        setMenuData({
          branch: data?.branch || null,
          categories: Array.isArray(data?.categories) ? data.categories : [],
          items: Array.isArray(data?.items) ? data.items : [],
          generated_at: data?.generated_at || null,
        });
      } catch (err) {
        console.error("Failed to load public menu:", err);
        if (mounted) {
          const fallbackMessage =
            /timeout/i.test(String(err?.message || "")) ||
            String(err?.code || "").toUpperCase() === "ECONNABORTED"
              ? "Server is taking too long to respond. Please retry in a few seconds."
              : "Failed to load menu";
          setMessage(err?.response?.data?.message || fallbackMessage);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [location.search, routeBranchCode]);

  const categoryKeys = useMemo(() => {
    const fromCategories = Array.isArray(menuData.categories)
      ? menuData.categories
          .map((category) => categoryKey(category?.name))
          .filter((key) => key && key !== "all")
      : [];
    const fromItems = Array.isArray(menuData.items)
      ? menuData.items
          .map((item) => categoryKey(item?.category))
          .filter((key) => key && key !== "all")
      : [];

    const uniqueCategoryKeys = [...new Set([...fromCategories, ...fromItems])];
    const orderedKnown = CATEGORY_ORDER.filter((key) => uniqueCategoryKeys.includes(key));
    const extraKeys = uniqueCategoryKeys
      .filter((key) => !CATEGORY_ORDER.includes(key))
      .sort((a, b) => a.localeCompare(b));

    return ["all", ...orderedKnown, ...extraKeys];
  }, [menuData.categories, menuData.items]);

  useEffect(() => {
    if (categoryKeys.includes(activeCategory)) {
      return;
    }
    setActiveCategory("all");
  }, [activeCategory, categoryKeys]);

  const categoryItemsByKey = useMemo(() => {
    const groups = Object.fromEntries(categoryKeys.map((key) => [key, []]));
    const allItems = Array.isArray(menuData.items) ? menuData.items : [];
    groups.all = allItems;

    allItems.forEach((item) => {
      const key = categoryKey(item.category);
      if (!key || key === "all") return;
      if (!Array.isArray(groups[key])) {
        groups[key] = [];
      }
      groups[key].push(item);
    });
    return groups;
  }, [categoryKeys, menuData.items]);

  const categoryCountByKey = useMemo(
    () =>
      Object.fromEntries(
        categoryKeys.map((key) => [key, Number((categoryItemsByKey[key] || []).length)])
      ),
    [categoryItemsByKey, categoryKeys]
  );

  const itemsMap = useMemo(
    () => new Map((menuData.items || []).map((item) => [String(item.id), item])),
    [menuData.items]
  );

  const cartLines = useMemo(() => {
    return Object.entries(cart)
      .map(([cartKey, line]) => {
        const productId = String(line?.productId || "").trim();
        const qty = Number(line?.qty || 0);
        if (!productId || qty <= 0) {
          return null;
        }

        const item = itemsMap.get(productId) || null;
        const portion = normalizePortion(line?.portion);
        const unitPrice = toSafeMoney(
          line?.unitPrice,
          resolveMenuItemUnitPrice(item || { price: 0 }, portion)
        );
        const name = String(line?.name || item?.name || `Item ${productId}`).trim();

        return {
          cartKey,
          productId,
          portion,
          qty,
          item,
          name,
          displayName: getDisplayName(name, portion),
          unitPrice,
          lineTotal: unitPrice * qty,
        };
      })
      .filter(Boolean);
  }, [cart, itemsMap]);

  const cartTotal = useMemo(
    () => cartLines.reduce((sum, line) => sum + Number(line.lineTotal || 0), 0),
    [cartLines]
  );
  const cartCount = useMemo(
    () => cartLines.reduce((sum, line) => sum + Number(line.qty || 0), 0),
    [cartLines]
  );

  const activeItems = useMemo(
    () => (loading ? [] : categoryItemsByKey[activeCategory] || []),
    [activeCategory, categoryItemsByKey, loading]
  );
  const activeCategoryMeta = useMemo(() => getCategoryMeta(activeCategory), [activeCategory]);

  const getCartQty = (productId, portion = null) => {
    const key = buildCartKey(productId, portion);
    return Number(cart[key]?.qty || 0);
  };

  const changeQty = (item, delta, portion = null) => {
    const productId = String(item?.id || "").trim();
    if (!productId) {
      return;
    }
    const normalizedPortion = normalizePortion(portion);
    const key = buildCartKey(productId, normalizedPortion);
    setCart((prev) => {
      const previousLine = prev[key] || {};
      const nextQty = Math.max(0, Number(previousLine.qty || 0) + Number(delta || 0));
      const next = { ...prev };
      if (nextQty <= 0) {
        delete next[key];
      } else {
        next[key] = {
          productId,
          portion: normalizedPortion,
          qty: nextQty,
          name: String(item?.name || "").trim() || `Item ${productId}`,
          unitPrice: resolveMenuItemUnitPrice(item, normalizedPortion),
        };
      }
      return next;
    });
  };

  const submitOrder = async (formValues) => {
    if (!formValues || String(formValues.customer_name || "").trim().length < 2) return false;
    if (!Array.isArray(cartLines) || cartLines.length === 0) return false;

    setSubmitting(true);
    setMessage("");
    try {
      const payload = {
        branch_id: menuData?.branch?.id || undefined,
        branch_code: menuData?.branch?.code || undefined,
        customer_name: formValues.customer_name,
        customer_phone: formValues.customer_phone || undefined,
        customer_email: formValues.customer_email || undefined,
        customer_address: formValues.customer_address || undefined,
        order_type: "DINE-IN",
        table_number: formValues.table_number || undefined,
        payment_method: formValues.payment_method || "CASH",
        note: formValues.note || undefined,
        items: cartLines.map((line) => ({
          product_id: line.productId,
          qty: line.qty,
          portion: line.portion || undefined,
        })),
      };

      const { data } = await publicApi.post("/public/orders", payload);
      setOrderSuccess(data || null);
      setCart({});
      setIsCheckoutOpen(true);
      return true;
    } catch (err) {
      console.error("Failed to submit menu order:", err);
      setMessage(err?.response?.data?.message || "Failed to submit order");
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const startNewOrder = () => {
    setOrderSuccess(null);
    setMessage("");
    setCart({});
    setPaymentFormResetToken((prev) => prev + 1);
    setIsCheckoutOpen(false);
  };

  return (
    <div className="cv-public-menu">
      <div className="cv-public-menu-bg" />

      <div className="cv-public-shell">
        <header className="cv-public-topbar">
          <div>
            <p className="cv-public-kicker">Camellia Cafe & Restaurant</p>
            <h1 className="cv-public-title">Digital QR Menu</h1>
            <p className="cv-public-title-sub">
              Browse categories, add items, and place your order directly from your phone.
            </p>
          </div>
          <div className="cv-public-top-meta">
            <span className="cv-public-chip">
              Branch: {menuData?.branch?.code || "-"} - {menuData?.branch?.name || "Unknown"}
            </span>
            <span className="cv-public-chip">
              {Math.max(0, categoryKeys.length - 1)} Categories
            </span>
            <span className="cv-public-chip">{Array.isArray(menuData.items) ? menuData.items.length : 0} Items</span>
            {detectedTable && <span className="cv-public-chip cv-public-chip--accent">Table {detectedTable}</span>}
          </div>
        </header>

        <div className="cv-public-layout">
          <main className="cv-public-menu-board">
            <section className="cv-public-category-strip" aria-label="Menu categories">
              {categoryKeys.map((key) => {
                const meta = getCategoryMeta(key);
                return (
                  <button
                    key={key}
                    type="button"
                    className={`cv-public-cat-chip ${activeCategory === key ? "is-active" : ""}`}
                    onClick={() => setActiveCategory(key)}
                  >
                    <span>{meta.icon} {meta.label}</span>
                    <span className="cv-public-cat-chip-count">{Number(categoryCountByKey[key] || 0)}</span>
                  </button>
                );
              })}
            </section>

            <section className="cv-public-items-panel">
              <header className="cv-public-items-head">
                <h2>
                  {activeCategoryMeta.icon} {activeCategoryMeta.label}
                </h2>
                <p>{loading ? "Loading menu..." : `${activeItems.length} items`}</p>
              </header>

              {loading ? (
                <div className="cv-public-items-grid">
                  {Array.from({ length: 8 }).map((_, idx) => (
                    <article key={`skeleton-${idx}`} className="cv-public-item-card cv-public-item-card--skeleton" />
                  ))}
                </div>
              ) : activeItems.length === 0 ? (
                <div className="cv-public-empty-state">
                  <h3>No items found</h3>
                  <p>Try another category from the list above.</p>
                </div>
              ) : (
                <div className="cv-public-items-grid">
                  {activeItems.map((item) => {
                    const pricing = getMenuItemPortionPrices(item);
                    const defaultQty = getCartQty(item.id);
                    return (
                      <article key={String(item.id)} className="cv-public-item-card">
                        <div className="cv-public-item-image-wrap">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="cv-public-item-image"
                              loading="lazy"
                              decoding="async"
                              fetchPriority="low"
                            />
                          ) : (
                            <div className="cv-public-item-image-placeholder">No Image</div>
                          )}
                        </div>

                        <div className="cv-public-item-body">
                          <h3>{item.name}</h3>
                          <p>{normalizeCategory(item.category)}</p>
                          {pricing.hasPortions ? (
                            <div className="cv-public-portion-grid">
                              {PORTION_OPTIONS.map((portionOption) => {
                                const portionPrice =
                                  portionOption === "LARGE"
                                    ? pricing.largePrice
                                    : pricing.smallPrice;
                                const qty = getCartQty(item.id, portionOption);
                                return (
                                  <div key={`${item.id}-${portionOption}`} className="cv-public-portion-row">
                                    <div className="cv-public-portion-meta">
                                      <span className="cv-public-portion-badge">
                                        {portionOption === "LARGE" ? "L" : "S"}
                                      </span>
                                      <strong>{toMoney(portionPrice)}</strong>
                                    </div>
                                    {qty <= 0 ? (
                                      <button
                                        type="button"
                                        className="cv-public-add-btn cv-public-add-btn--portion"
                                        onClick={() => changeQty(item, 1, portionOption)}
                                        aria-label={`Add ${getPortionLabel(portionOption)} portion of ${item.name}`}
                                      >
                                        Add
                                      </button>
                                    ) : (
                                      <div className="cv-public-qty-box cv-public-qty-box--portion">
                                        <button
                                          type="button"
                                          onClick={() => changeQty(item, -1, portionOption)}
                                          className="cv-public-qty-btn cv-public-qty-btn--portion"
                                          aria-label={`Decrease ${getPortionLabel(portionOption)} portion quantity for ${item.name}`}
                                        >
                                          -
                                        </button>
                                        <span aria-live="polite">{qty}</span>
                                        <button
                                          type="button"
                                          onClick={() => changeQty(item, 1, portionOption)}
                                          className="cv-public-qty-btn cv-public-qty-btn--portion"
                                          aria-label={`Increase ${getPortionLabel(portionOption)} portion quantity for ${item.name}`}
                                        >
                                          +
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="cv-public-item-footer">
                              <strong>{toMoney(pricing.basePrice)}</strong>
                              {defaultQty <= 0 ? (
                                <button
                                  type="button"
                                  className="cv-public-add-btn"
                                  onClick={() => changeQty(item, 1)}
                                  aria-label={`Add ${item.name}`}
                                >
                                  Add
                                </button>
                              ) : (
                                <div className="cv-public-qty-box">
                                  <button
                                    type="button"
                                    onClick={() => changeQty(item, -1)}
                                    className="cv-public-qty-btn"
                                    aria-label={`Decrease quantity for ${item.name}`}
                                  >
                                    -
                                  </button>
                                  <span aria-live="polite">{defaultQty}</span>
                                  <button
                                    type="button"
                                    onClick={() => changeQty(item, 1)}
                                    className="cv-public-qty-btn"
                                    aria-label={`Increase quantity for ${item.name}`}
                                  >
                                    +
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </main>

          <aside className={`cv-public-checkout-panel ${isCheckoutOpen ? "is-open" : ""}`} aria-label="Checkout panel">
            <header className="cv-public-checkout-head">
              <div>
                <p>Checkout</p>
                <h3>{cartCount} {cartCount === 1 ? "item" : "items"}</h3>
              </div>
              <button
                type="button"
                className="cv-public-checkout-close"
                onClick={() => setIsCheckoutOpen(false)}
              >
                Close
              </button>
            </header>

            <div className="cv-public-checkout-scroll">
              {orderSuccess && (
                <section className="cv-public-success-card">
                  <h4>Order Submitted</h4>
                  <p>Reference: {orderSuccess.reference || "-"}</p>
                  <p>Invoice: {orderSuccess.invoice_number || "-"}</p>
                  <button type="button" className="cv-public-submit-btn" onClick={startNewOrder}>
                    Start New Order
                  </button>
                </section>
              )}

              <section className="cv-public-cart-panel">
                <header>
                  <h4>Order Summary</h4>
                </header>

                {cartLines.length === 0 ? (
                  <div className="cv-public-empty-state cv-public-empty-state--compact">
                    <h3>Your cart is empty</h3>
                    <p>Add items from the menu to continue.</p>
                  </div>
                ) : (
                  <>
                    <div className="cv-public-cart-lines">
                      {cartLines.map((line) => (
                        <div key={`cart-${line.cartKey}`} className="cv-public-cart-line">
                          <div>
                            <strong>{line.displayName}</strong>
                            <span>{toMoney(line.unitPrice)} each</span>
                          </div>
                          <div>
                            x{line.qty}
                            <b>{toMoney(line.lineTotal)}</b>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="cv-public-cart-total">
                      <span>Total</span>
                      <strong>{toMoney(cartTotal)}</strong>
                    </div>
                  </>
                )}
              </section>

              <section className="cv-public-cart-panel">
                <header>
                  <h4>Customer Details</h4>
                  <p>New customers can register and place orders directly.</p>
                </header>
                <PublicOrderPaymentForm
                  detectedTable={detectedTable}
                  cartTotal={cartTotal}
                  cartLineCount={cartLines.length}
                  submitting={submitting}
                  resetToken={paymentFormResetToken}
                  onSubmit={submitOrder}
                />
              </section>
            </div>
          </aside>
        </div>
      </div>

      <div
        className={`cv-public-checkout-overlay ${isCheckoutOpen ? "is-open" : ""}`}
        onClick={() => setIsCheckoutOpen(false)}
        aria-hidden={!isCheckoutOpen}
      />

      <button
        type="button"
        className={`cv-public-mobile-cart-cta ${cartCount > 0 || orderSuccess ? "is-visible" : ""}`}
        onClick={() => setIsCheckoutOpen(true)}
      >
        <span>
          {orderSuccess ? "Order Submitted" : `${cartCount} ${cartCount === 1 ? "item" : "items"}`}
        </span>
        <strong>{toMoney(cartTotal)}</strong>
      </button>

      {message && <div className="cv-public-toast">{message}</div>}
    </div>
  );
}
