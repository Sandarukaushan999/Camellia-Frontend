import React, { useEffect, useMemo, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip";
import { useLocation, useParams } from "react-router-dom";
import publicApi from "../utils/publicApi.js";
import "../styles/public-menu.css";

const PAYMENT_METHOD_OPTIONS = ["CASH", "CARD", "QR", "ONLINE"];
const CUSTOMER_PROFILE_STORAGE_KEY = "cv_public_customer_profiles_v1";
const MAX_STORED_CUSTOMERS = 80;

const CATEGORY_ORDER = ["burger", "kottu", "submarine", "cafe", "juice", "rice", "pizza"];
const CATEGORY_META = {
  all: { label: "ALL", icon: "\uD83D\uDCE6" },
  burger: { label: "Burger", icon: "\uD83C\uDF54" },
  kottu: { label: "Kottu", icon: "\uD83C\uDF5C" },
  submarine: { label: "Submarine", icon: "\uD83E\uDD56" },
  cafe: { label: "Caf\u00e9", icon: "\u2615" },
  juice: { label: "Juice", icon: "\uD83E\uDD64" },
  rice: { label: "Rice", icon: "\uD83C\uDF5A" },
  pizza: { label: "Pizza", icon: "\uD83C\uDF55" },
};

function toCategoryStep(categoryKeyValue) {
  return `category:${categoryKeyValue}`;
}

function getViewportSnapshot() {
  if (typeof window === "undefined") {
    return { width: 390, height: 780 };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

const DEFAULT_ORDER_FORM = {
  customer_name: "",
  customer_phone: "",
  customer_email: "",
  customer_address: "",
  table_number: "",
  payment_method: "CASH",
  note: "",
};

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
          setCrmLookupMessage("New customer. Submission will require admin CRM approval.");
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

  const stopFlipGesture = (event) => {
    event.stopPropagation();
  };

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
      className="space-y-3"
      onPointerDownCapture={stopFlipGesture}
      onMouseDownCapture={stopFlipGesture}
      onTouchStartCapture={stopFlipGesture}
      onClickCapture={stopFlipGesture}
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
      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase text-slate-600">Your name *</span>
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
      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase text-slate-600">Phone number</span>
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
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
          {crmLookupMessage}
        </div>
      )}
      {matchedProfile && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">
          Returning customer detected.
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
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
        <label className="block">
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
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="cv-public-order-type-fixed">DINE-IN</div>
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
      </div>
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
      {detectedTable && (
        <p className="text-xs font-semibold text-slate-500">Auto-detected from QR code</p>
      )}
      <textarea
        className="cv-public-input min-h-[84px] resize-y"
        value={orderForm.note}
        onChange={(event) => setOrderForm((prev) => ({ ...prev, note: event.target.value }))}
        placeholder="Special notes"
        autoComplete="off"
      />
      <div className="cv-public-form-submit-stick">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-semibold uppercase text-slate-500">Estimated Total</div>
          <div className="mt-1 text-xl font-black text-slate-900">{toMoney(cartTotal)}</div>
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
          <p className="text-xs font-semibold text-slate-500">Checking CRM customer profile...</p>
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
  const [activeStep, setActiveStep] = useState("cover");
  const [viewport, setViewport] = useState(getViewportSnapshot);
  const flipBookRef = useRef(null);
  const resizeDebounceRef = useRef(null);

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
        const { data } = await publicApi.get("/public/menu", { params });
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
          setMessage(err?.response?.data?.message || "Failed to load menu");
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

  useEffect(() => {
    const updateViewport = () => {
      if (resizeDebounceRef.current) {
        clearTimeout(resizeDebounceRef.current);
      }
      resizeDebounceRef.current = setTimeout(() => {
        const next = getViewportSnapshot();
        setViewport((prev) =>
          prev.width === next.width && prev.height === next.height ? prev : next
        );
      }, 120);
    };
    updateViewport();
    window.addEventListener("resize", updateViewport, { passive: true });
    return () => {
      if (resizeDebounceRef.current) {
        clearTimeout(resizeDebounceRef.current);
      }
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  const categoryPageKeys = useMemo(() => {
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

  const stepKeys = useMemo(
    () => ["cover", ...categoryPageKeys.map((key) => toCategoryStep(key)), "cart", "thanks"],
    [categoryPageKeys]
  );
  const stepIndex = useMemo(
    () => Object.fromEntries(stepKeys.map((stepKey, index) => [stepKey, index])),
    [stepKeys]
  );
  const firstCategoryStep = useMemo(() => toCategoryStep(categoryPageKeys[0] || "all"), [categoryPageKeys]);

  const categoryItemsByKey = useMemo(() => {
    const groups = Object.fromEntries(categoryPageKeys.map((key) => [key, []]));
    const allItems = Array.isArray(menuData.items) ? menuData.items : [];
    groups.all = allItems;
    allItems.forEach((item) => {
      const key = categoryKey(item.category);
      if (key !== "all") {
        if (!Array.isArray(groups[key])) groups[key] = [];
        groups[key].push(item);
      }
    });
    return groups;
  }, [categoryPageKeys, menuData.items]);

  const categoryCountByKey = useMemo(
    () =>
      Object.fromEntries(
        categoryPageKeys.map((key) => [key, Number((categoryItemsByKey[key] || []).length)])
      ),
    [categoryItemsByKey, categoryPageKeys]
  );

  const cartLines = useMemo(() => {
    const itemsMap = new Map((menuData.items || []).map((item) => [String(item.id), item]));
    return Object.entries(cart)
      .map(([productId, qty]) => ({
        productId,
        qty: Number(qty || 0),
        item: itemsMap.get(String(productId)),
      }))
      .filter((line) => line.item && line.qty > 0)
      .map((line) => ({
        ...line,
        lineTotal: Number(line.item.price || 0) * line.qty,
      }));
  }, [cart, menuData.items]);

  const cartTotal = useMemo(
    () => cartLines.reduce((sum, line) => sum + Number(line.lineTotal || 0), 0),
    [cartLines]
  );
  const cartCount = useMemo(
    () => cartLines.reduce((sum, line) => sum + Number(line.qty || 0), 0),
    [cartLines]
  );

  const maxStepIndex = orderSuccess ? stepIndex.thanks : stepIndex.cart;
  const activeStepIndex = stepIndex[activeStep] ?? 0;
  const isCategoryStep = activeStep.startsWith("category:");
  const isMobileViewport = viewport.width <= 920;
  const flipBookWidth = useMemo(() => {
    const horizontalPadding =
      viewport.width <= 480 ? 10 : viewport.width <= 920 ? 18 : viewport.width <= 1280 ? 28 : 36;
    return Math.max(300, viewport.width - horizontalPadding);
  }, [viewport.width]);
  const flipBookHeight = useMemo(() => {
    const verticalPadding = viewport.width <= 640 ? 20 : 30;
    return Math.max(460, viewport.height - verticalPadding);
  }, [viewport.height, viewport.width]);
  const categoryStepSignature = useMemo(() => categoryPageKeys.join("|"), [categoryPageKeys]);
  const flipBookRenderKey = useMemo(
    () => `${isMobileViewport ? "mobile" : "desktop"}-${categoryStepSignature}`,
    [categoryStepSignature, isMobileViewport]
  );

  const getFlipApi = () => {
    try {
      return flipBookRef.current?.pageFlip?.() || null;
    } catch {
      return null;
    }
  };

  const goToStep = (stepKey) => {
    const nextIndex = stepIndex[stepKey];
    if (!Number.isFinite(nextIndex)) return;
    if (nextIndex > maxStepIndex) return;
    const api = getFlipApi();
    if (api) {
      api.turnToPage(nextIndex);
      return;
    }
    setActiveStep(stepKey);
  };

  const handlePageFlip = (event) => {
    const nextIndex = Number(event?.data ?? 0);
    if (!Number.isFinite(nextIndex)) return;
    if (nextIndex > maxStepIndex) {
      const api = getFlipApi();
      if (api) api.turnToPage(maxStepIndex);
      setActiveStep(stepKeys[maxStepIndex] || "cover");
      return;
    }
    setActiveStep(stepKeys[Math.max(0, Math.min(stepKeys.length - 1, nextIndex))] || "cover");
  };

  useEffect(() => {
    if (activeStepIndex <= maxStepIndex) return;
    setActiveStep(stepKeys[maxStepIndex] || "cover");
  }, [activeStepIndex, maxStepIndex, stepKeys]);

  useEffect(() => {
    if (stepIndex[activeStep] != null) return;
    setActiveStep("cover");
  }, [activeStep, stepIndex]);

  useEffect(() => {
    const api = getFlipApi();
    if (!api) return;
    const target = stepIndex[activeStep] ?? 0;
    const current = Number(api.getCurrentPageIndex?.() ?? 0);
    if (current !== target) {
      api.turnToPage(target);
    }
  }, [activeStep, flipBookRenderKey, stepIndex]);

  const changeQty = (productId, delta) => {
    const key = String(productId);
    setCart((prev) => {
      const nextQty = Math.max(0, Number(prev[key] || 0) + delta);
      const next = { ...prev };
      if (nextQty <= 0) delete next[key];
      else next[key] = nextQty;
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
        items: cartLines.map((line) => ({ product_id: line.productId, qty: line.qty })),
      };
      const { data } = await publicApi.post("/public/orders", payload);
      setOrderSuccess(data || null);
      setCart({});
      setActiveStep("thanks");
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
    setActiveStep(firstCategoryStep);
  };

  return (
    <div className="cv-public-menu min-h-screen">
      <div className="cv-public-menu-bg" />
      <div className="cv-public-book-stage relative mx-auto w-full max-w-none p-1 sm:p-2 md:p-3">
        <div className="cv-public-menu-meta-bar">
          <span className="cv-public-meta-chip">
            Branch: {menuData?.branch?.code || "-"} - {menuData?.branch?.name || "Unknown"}
          </span>
          <span className="cv-public-meta-chip">
            {Math.max(0, categoryPageKeys.length - 1)} categories
          </span>
          <span className="cv-public-meta-chip">{Array.isArray(menuData.items) ? menuData.items.length : 0} items</span>
        </div>

        <div className="cv-public-book-root">
          <div className="cv-public-book-frame">
            <HTMLFlipBook
              key={flipBookRenderKey}
              ref={flipBookRef}
              className="cv-public-flipbook"
              width={flipBookWidth}
              height={flipBookHeight}
              startPage={activeStepIndex}
              size="fixed"
              maxShadowOpacity={isMobileViewport ? 0.22 : 0.4}
              drawShadow={false}
              usePortrait
              showCover
              showPageCorners={false}
              mobileScrollSupport
              disableFlipByClick
              useMouseEvents
              swipeDistance={isMobileViewport ? 26 : 48}
              flippingTime={isMobileViewport ? 620 : 760}
              onFlip={handlePageFlip}
            >
              <div key="cover" className="cv-public-flip-page cv-public-flip-page--cover">
                <article className="cv-public-cover-poster h-full min-h-full">
                  <div className="cv-public-cover-accent" />
                  <div className="cv-public-cover-headline">
                    <p className="cv-public-cover-kicker">Camellia Cafe</p>
                    <h1>Signature Menu</h1>
                    <p>Browse categories, add items, review cart, then place your order.</p>
                  </div>
                  <div className="cv-public-cover-price-tag">
                    <span>Live</span>
                    <strong>MENU</strong>
                  </div>
                  <div className="cv-public-page-number cv-public-page-number--cover">
                    {(stepIndex.cover || 0) + 1}
                  </div>
                </article>
              </div>

              {categoryPageKeys.map((categoryPageKey) => {
                const stepKey = toCategoryStep(categoryPageKey);
                const meta = getCategoryMeta(categoryPageKey);
                const totalCategoryItems = Number(categoryCountByKey[categoryPageKey] || 0);
                const categoryItems = loading ? [] : categoryItemsByKey[categoryPageKey] || [];
                return (
                  <div key={stepKey} className="cv-public-flip-page cv-public-flip-page--categories">
                    <div className="cv-public-flip-content">
                      <header className="cv-public-flip-header">
                        <p className="cv-public-menu-kicker">Category</p>
                        <h2 className="cv-public-flip-title">
                          {meta.icon} {meta.label}
                        </h2>
                        <p className="cv-public-menu-subtitle">
                          {loading ? "Loading..." : `${totalCategoryItems} items`}
                        </p>
                      </header>
                      <div className="cv-public-flip-scroll">
                        <div className="cv-public-category-chip-row">
                          {categoryPageKeys.map((chipKey) => {
                            const chipMeta = getCategoryMeta(chipKey);
                            return (
                              <button
                                key={chipKey}
                                type="button"
                                onClick={() => goToStep(toCategoryStep(chipKey))}
                                className={`cv-public-cat-chip ${
                                  chipKey === categoryPageKey ? "is-active" : ""
                                }`}
                              >
                                <span>{chipMeta.icon} {chipMeta.label}</span>
                                <span className="cv-public-cat-chip-count">
                                  {Number(categoryCountByKey[chipKey] || 0)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        {loading ? (
                          <div className="cv-public-category-items-grid mt-3">
                            {Array.from({ length: isMobileViewport ? 4 : 8 }).map((_, idx) => (
                              <article
                                key={`skeleton-${categoryPageKey}-${idx}`}
                                className="cv-public-menu-card cv-public-menu-card--category cv-public-menu-card--skeleton"
                                aria-hidden="true"
                              >
                                <div className="cv-public-menu-image-wrap cv-public-skeleton-block" />
                                <div className="p-3">
                                  <div className="cv-public-skeleton-line cv-public-skeleton-line--lg" />
                                  <div className="cv-public-skeleton-line cv-public-skeleton-line--sm mt-2" />
                                  <div className="cv-public-skeleton-line cv-public-skeleton-line--md mt-3" />
                                </div>
                              </article>
                            ))}
                          </div>
                        ) : categoryItems.length === 0 ? (
                          <div className="cv-public-flip-note mt-3">
                            <h3>{`No items in ${meta.label}`}</h3>
                            <p>Use another category page to continue browsing.</p>
                          </div>
                        ) : (
                          <div className="cv-public-category-items-grid mt-3">
                            {categoryItems.map((item) => {
                              const qty = Number(cart[String(item.id)] || 0);
                              return (
                                <article
                                  key={String(item.id)}
                                  className="cv-public-menu-card cv-public-menu-card--category"
                                >
                                  <div className="cv-public-menu-image-wrap">
                                    {item.image_url ? (
                                      <img
                                        src={item.image_url}
                                        alt={item.name}
                                        className="cv-public-menu-image"
                                        loading="lazy"
                                        decoding="async"
                                        fetchpriority="low"
                                      />
                                    ) : (
                                      <div className="cv-public-menu-image-placeholder">No Image</div>
                                    )}
                                  </div>
                                  <div className="p-3">
                                    <h3 className="text-sm font-extrabold text-slate-900">{item.name}</h3>
                                    <p className="text-xs font-semibold text-slate-500">
                                      {normalizeCategory(item.category)}
                                    </p>
                                    <div className="mt-2 flex items-center justify-between">
                                      <span className="text-sm font-black text-slate-900">{toMoney(item.price)}</span>
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => changeQty(item.id, -1)}
                                          className="cv-public-qty-btn"
                                          disabled={qty <= 0}
                                          aria-label={`Decrease quantity for ${item.name}`}
                                        >
                                          -
                                        </button>
                                        <span className="w-8 text-center text-sm font-black" aria-live="polite">
                                          {qty}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => changeQty(item.id, 1)}
                                          className="cv-public-qty-btn"
                                          aria-label={`Increase quantity for ${item.name}`}
                                        >
                                          +
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="cv-public-page-number">{(stepIndex[stepKey] || 0) + 1}</div>
                    </div>
                  </div>
                );
              })}

              <div key="cart" className="cv-public-flip-page cv-public-flip-page--cart">
                <div className="cv-public-flip-content">
                  <header className="cv-public-flip-header">
                    <p className="cv-public-menu-kicker">Cart</p>
                    <h2 className="cv-public-flip-title">Your Order</h2>
                    <p className="cv-public-menu-subtitle">{cartCount} items</p>
                  </header>
                  <div className="cv-public-flip-scroll">
                    <div className="space-y-4 cv-public-order-stack">
                      {cartLines.length === 0 ? (
                        <div className="cv-public-flip-note">
                          <h3>Your cart is empty</h3>
                          <p>Add items from Categories.</p>
                        </div>
                      ) : (
                        <div className="cv-public-cart-panel cv-public-cart-panel--flat cv-public-order-summary-card">
                          <div className="cv-public-cart-lines">
                            {cartLines.map((line) => (
                              <div key={`cart-${line.productId}`} className="cv-public-cart-line">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-bold text-slate-900">
                                    {line.item?.name}
                                  </div>
                                  <div className="text-xs text-slate-500">{toMoney(line.item?.price)} each</div>
                                </div>
                                <div className="text-right text-sm font-extrabold text-slate-900">
                                  x{line.qty} | {toMoney(line.lineTotal)}
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="text-xs font-semibold uppercase text-slate-500">
                              Estimated Total
                            </div>
                            <div className="mt-1 text-lg font-extrabold text-slate-900">
                              {toMoney(cartTotal)}
                            </div>
                          </div>
                        </div>
                      )}

                      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm cv-public-order-form-shell">
                        <header className="mb-3">
                          <p className="cv-public-menu-kicker">Place Your Order</p>
                          <h3 className="text-base font-extrabold text-slate-900">Customer Details</h3>
                          <p className="text-xs font-semibold text-slate-500">
                            Fill details below and submit order from this section.
                          </p>
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
                  </div>
                  <div className="cv-public-page-number">{(stepIndex.cart || 0) + 1}</div>
                </div>
              </div>

              <div key="thanks" className="cv-public-flip-page cv-public-flip-page--thanks">
                <div className="cv-public-flip-content">
                  <header className="cv-public-flip-header">
                    <p className="cv-public-menu-kicker">Order Complete</p>
                    <h2 className="cv-public-flip-title">Thank You</h2>
                  </header>
                  <div className="cv-public-flip-scroll">
                    {orderSuccess ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <div className="text-sm font-semibold text-emerald-900">
                          Reference: {orderSuccess.reference || "-"}
                        </div>
                        <div className="mt-2 text-sm font-semibold text-emerald-900">
                          Invoice: {orderSuccess.invoice_number || "-"}
                        </div>
                        <button type="button" onClick={startNewOrder} className="cv-public-submit-btn mt-4">
                          Start New Order
                        </button>
                      </div>
                    ) : (
                      <div className="cv-public-flip-note">
                        <h3>No completed order</h3>
                        <p>Place your order from the Cart page.</p>
                      </div>
                    )}
                  </div>
                  <div className="cv-public-page-number">{(stepIndex.thanks || 0) + 1}</div>
                </div>
              </div>
            </HTMLFlipBook>
          </div>
        </div>

        {isCategoryStep && cartCount > 0 && (
          <div className="cv-public-sticky-cart" role="region" aria-label="Cart summary">
            <div className="cv-public-sticky-cart-meta">
              <span>{cartCount} {cartCount === 1 ? "item" : "items"}</span>
              <strong>{toMoney(cartTotal)}</strong>
            </div>
            <button
              type="button"
              className="cv-public-sticky-cart-btn"
              onClick={() => goToStep("cart")}
            >
              View Cart
            </button>
          </div>
        )}

        {message && (
          <div
            className={`fixed right-4 z-50 rounded-lg bg-rose-600 px-4 py-2 text-sm text-white shadow-lg ${
              isCategoryStep && cartCount > 0 ? "bottom-24" : "bottom-4"
            }`}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
