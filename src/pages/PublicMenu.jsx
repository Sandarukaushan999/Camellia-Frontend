import React, { useEffect, useMemo, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip";
import { useLocation, useParams } from "react-router-dom";
import publicApi from "../utils/publicApi.js";
import { formatBusinessDateTime } from "../utils/timezone.js";

const PAYMENT_METHOD_OPTIONS = ["CASH", "CARD", "QR", "ONLINE"];
const CUSTOMER_PROFILE_STORAGE_KEY = "cv_public_customer_profiles_v1";
const MAX_STORED_CUSTOMERS = 80;

const CATEGORY_ORDER = ["burger", "kottu", "submarine", "cafe", "juice", "rice", "pizza"];
const QR_CATEGORY_PAGE_KEYS = ["all", ...CATEGORY_ORDER];
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

const STEP_KEYS = [
  "cover",
  ...QR_CATEGORY_PAGE_KEYS.map((key) => `category:${key}`),
  "cart",
  "payment",
  "thanks",
];
const STEP_INDEX = Object.fromEntries(STEP_KEYS.map((stepKey, index) => [stepKey, index]));
const FIRST_CATEGORY_STEP = `category:${QR_CATEGORY_PAGE_KEYS[0]}`;

function toCategoryStep(categoryKeyValue) {
  return `category:${categoryKeyValue}`;
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
  const [orderForm, setOrderForm] = useState(DEFAULT_ORDER_FORM);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [activeStep, setActiveStep] = useState("cover");
  const [customerProfiles, setCustomerProfiles] = useState(() => readStoredCustomerProfiles());
  const [crmLookupState, setCrmLookupState] = useState("idle");
  const [crmLookupMessage, setCrmLookupMessage] = useState("");
  const flipBookRef = useRef(null);

  const detectedTable = useMemo(() => getDetectedTable(location.search), [location.search]);

  useEffect(() => {
    const tableValue = String(detectedTable || "").trim();
    if (!tableValue) return;
    setOrderForm((prev) => ({
      ...prev,
      table_number: prev.table_number || tableValue,
    }));
  }, [detectedTable]);

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

  const categoryItemsByKey = useMemo(() => {
    const groups = Object.fromEntries(QR_CATEGORY_PAGE_KEYS.map((key) => [key, []]));
    const allItems = Array.isArray(menuData.items) ? menuData.items : [];
    groups.all = allItems;
    allItems.forEach((item) => {
      const key = categoryKey(item.category);
      if (key !== "all" && Array.isArray(groups[key])) {
        groups[key].push(item);
      }
    });
    return groups;
  }, [menuData.items]);

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
  const canPlaceOrder =
    String(orderForm.customer_name || "").trim().length >= 2 && cartLines.length > 0;
  const matchedProfile = useMemo(() => {
    const key = normalizePhone(orderForm.customer_phone);
    return key ? customerProfiles[key] || null : null;
  }, [customerProfiles, orderForm.customer_phone]);

  const maxStepIndex = orderSuccess ? STEP_INDEX.thanks : STEP_INDEX.payment;
  const activeStepIndex = STEP_INDEX[activeStep] ?? 0;
  const isCategoryStep = activeStep.startsWith("category:");
  const stopFlipGesture = (event) => {
    event.stopPropagation();
  };

  const getFlipApi = () => {
    try {
      return flipBookRef.current?.pageFlip?.() || null;
    } catch {
      return null;
    }
  };

  const goToStep = (stepKey) => {
    const nextIndex = STEP_INDEX[stepKey];
    if (!Number.isFinite(nextIndex)) return;
    if (nextIndex > maxStepIndex) return;
    const api = getFlipApi();
    if (api) {
      api.turnToPage(nextIndex);
      return;
    }
    setActiveStep(stepKey);
  };

  const goPrev = () => {
    if (activeStepIndex <= STEP_INDEX.cover) return;
    const api = getFlipApi();
    if (api) {
      api.flipPrev();
      return;
    }
    setActiveStep(STEP_KEYS[activeStepIndex - 1]);
  };

  const goNext = () => {
    if (activeStepIndex >= maxStepIndex) return;
    const api = getFlipApi();
    if (api) {
      api.flipNext();
      return;
    }
    setActiveStep(STEP_KEYS[activeStepIndex + 1]);
  };

  const handlePageFlip = (event) => {
    const nextIndex = Number(event?.data ?? 0);
    if (!Number.isFinite(nextIndex)) return;
    if (nextIndex > maxStepIndex) {
      const api = getFlipApi();
      if (api) api.turnToPage(maxStepIndex);
      setActiveStep(STEP_KEYS[maxStepIndex]);
      return;
    }
    setActiveStep(STEP_KEYS[Math.max(0, Math.min(STEP_KEYS.length - 1, nextIndex))] || "cover");
  };

  useEffect(() => {
    if (activeStepIndex <= maxStepIndex) return;
    setActiveStep(STEP_KEYS[maxStepIndex]);
  }, [activeStepIndex, maxStepIndex]);

  useEffect(() => {
    const api = getFlipApi();
    if (!api) return;
    const target = STEP_INDEX[activeStep] ?? 0;
    const current = Number(api.getCurrentPageIndex?.() ?? 0);
    if (current !== target) {
      api.turnToPage(target);
    }
  }, [activeStep]);

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

  const handlePhoneChange = (value) => {
    setOrderForm((prev) => ({ ...prev, customer_phone: value }));
    const key = normalizePhone(value);
    const profile = key ? customerProfiles[key] : null;
    if (!profile) return;
    setOrderForm((prev) => ({
      ...prev,
      customer_phone: value,
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

  const submitOrder = async () => {
    if (!canPlaceOrder) return;
    setSubmitting(true);
    setMessage("");
    try {
      const payload = {
        branch_id: menuData?.branch?.id || undefined,
        branch_code: menuData?.branch?.code || undefined,
        customer_name: orderForm.customer_name,
        customer_phone: orderForm.customer_phone || undefined,
        customer_email: orderForm.customer_email || undefined,
        customer_address: orderForm.customer_address || undefined,
        order_type: "DINE-IN",
        table_number: orderForm.table_number || undefined,
        payment_method: orderForm.payment_method,
        note: orderForm.note || undefined,
        items: cartLines.map((line) => ({ product_id: line.productId, qty: line.qty })),
      };
      const { data } = await publicApi.post("/public/orders", payload);
      setOrderSuccess(data || null);
      setCart({});
      setActiveStep("thanks");
    } catch (err) {
      console.error("Failed to submit menu order:", err);
      setMessage(err?.response?.data?.message || "Failed to submit order");
    } finally {
      setSubmitting(false);
    }
  };

  const startNewOrder = () => {
    setOrderSuccess(null);
    setMessage("");
    setCart({});
    setActiveStep(FIRST_CATEGORY_STEP);
  };

  return (
    <div className="cv-public-menu min-h-screen">
      <div className="cv-public-menu-bg" />
      <div className="relative mx-auto max-w-7xl p-3 md:p-5">
        <div className="cv-public-book-root">
          <HTMLFlipBook
            ref={flipBookRef}
            className="cv-public-flipbook"
            width={440}
            height={700}
            size="stretch"
            minWidth={300}
            maxWidth={1200}
            minHeight={520}
            maxHeight={860}
            maxShadowOpacity={0.22}
            drawShadow
            usePortrait
            showCover
            mobileScrollSupport
            disableFlipByClick
            useMouseEvents
            swipeDistance={68}
            onFlip={handlePageFlip}
          >
            <div className="cv-public-flip-page cv-public-flip-page--cover">
              <article className="cv-public-cover-poster min-h-[70vh]">
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
              </article>
            </div>

            {QR_CATEGORY_PAGE_KEYS.map((categoryPageKey) => {
              const stepKey = toCategoryStep(categoryPageKey);
              const meta = CATEGORY_META[categoryPageKey] || {
                label: normalizeCategory(categoryPageKey),
                icon: "\uD83D\uDCE6",
              };
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
                        {loading ? "Loading..." : `${categoryItems.length} items`}
                      </p>
                    </header>
                    <div className="cv-public-flip-scroll">
                      <div className="cv-public-category-chip-row">
                        {QR_CATEGORY_PAGE_KEYS.map((chipKey) => {
                          const chipMeta = CATEGORY_META[chipKey] || {
                            label: normalizeCategory(chipKey),
                            icon: "\uD83D\uDCE6",
                          };
                          return (
                            <button
                              key={chipKey}
                              type="button"
                              onClick={() => goToStep(toCategoryStep(chipKey))}
                              className={`cv-public-cat-chip ${
                                chipKey === categoryPageKey ? "is-active" : ""
                              }`}
                            >
                              {chipMeta.icon} {chipMeta.label}
                            </button>
                          );
                        })}
                      </div>
                      {categoryItems.length === 0 && !loading ? (
                        <div className="cv-public-flip-note mt-3">
                          <h3>No items in {meta.label}</h3>
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
                                    <img src={item.image_url} alt={item.name} className="cv-public-menu-image" />
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
                                      >
                                        -
                                      </button>
                                      <span className="w-6 text-center text-sm font-black">{qty}</span>
                                      <button
                                        type="button"
                                        onClick={() => changeQty(item.id, 1)}
                                        className="cv-public-qty-btn"
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
                  </div>
                </div>
              );
            })}

            <div className="cv-public-flip-page cv-public-flip-page--cart">
              <div className="cv-public-flip-content">
                <header className="cv-public-flip-header">
                  <p className="cv-public-menu-kicker">Cart</p>
                  <h2 className="cv-public-flip-title">Your Order</h2>
                  <p className="cv-public-menu-subtitle">{cartCount} items</p>
                </header>
                <div className="cv-public-flip-scroll">
                  {cartLines.length === 0 ? (
                    <div className="cv-public-flip-note">
                      <h3>Your cart is empty</h3>
                      <p>Add items from Categories.</p>
                    </div>
                  ) : (
                    <div className="cv-public-cart-panel cv-public-cart-panel--flat">
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
                </div>
              </div>
            </div>

            <div className="cv-public-flip-page cv-public-flip-page--payment">
              <div className="cv-public-flip-content">
                <header className="cv-public-flip-header">
                  <p className="cv-public-menu-kicker">Payment</p>
                  <h2 className="cv-public-flip-title">Place Your Order</h2>
                  <p className="cv-public-menu-subtitle">DINE-IN only</p>
                </header>
                <div className="cv-public-flip-scroll">
                  <form
                    className="space-y-3"
                    onPointerDownCapture={stopFlipGesture}
                    onTouchStartCapture={stopFlipGesture}
                    onMouseDownCapture={stopFlipGesture}
                    onSubmit={(event) => {
                      event.preventDefault();
                      submitOrder();
                    }}
                  >
                    <label className="block">
                      <span className="mb-1 block text-xs font-bold uppercase text-slate-600">
                        Your name *
                      </span>
                      <input
                        type="text"
                        className="cv-public-input"
                        value={orderForm.customer_name}
                        onChange={(event) =>
                          setOrderForm((prev) => ({ ...prev, customer_name: event.target.value }))
                        }
                        placeholder="Customer name"
                        required
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-bold uppercase text-slate-600">
                        Phone number
                      </span>
                      <input
                        type="tel"
                        className="cv-public-input"
                        value={orderForm.customer_phone}
                        onChange={(event) => handlePhoneChange(normalizePhone(event.target.value))}
                        placeholder="07xxxxxxxx"
                      />
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
                      <input
                        type="email"
                        className="cv-public-input"
                        value={orderForm.customer_email}
                        onChange={(event) =>
                          setOrderForm((prev) => ({ ...prev, customer_email: event.target.value }))
                        }
                        placeholder="name@example.com"
                      />
                      <input
                        type="text"
                        className="cv-public-input"
                        value={orderForm.customer_address}
                        onChange={(event) =>
                          setOrderForm((prev) => ({ ...prev, customer_address: event.target.value }))
                        }
                        placeholder="Optional address"
                      />
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
                    />
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-semibold uppercase text-slate-500">Estimated Total</div>
                      <div className="mt-1 text-xl font-black text-slate-900">{toMoney(cartTotal)}</div>
                    </div>
                    <button type="submit" className="cv-public-submit-btn" disabled={!canPlaceOrder || submitting}>
                      {submitting ? "Placing..." : "Place Order"}
                    </button>
                  </form>
                </div>
              </div>
            </div>

            <div className="cv-public-flip-page cv-public-flip-page--thanks">
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
                      <p>Place order from Payment page.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </HTMLFlipBook>
        </div>

        <div className="cv-public-book-controls cv-public-book-controls--wide">
          <button
            type="button"
            onClick={() => goToStep("cover")}
            className={`cv-public-book-nav-btn ${activeStep === "cover" ? "is-active" : ""}`}
          >
            Cover
          </button>
          <button
            type="button"
            onClick={() => goToStep(FIRST_CATEGORY_STEP)}
            className={`cv-public-book-nav-btn ${isCategoryStep ? "is-active" : ""}`}
          >
            Categories
          </button>
          <button
            type="button"
            onClick={() => goToStep("cart")}
            className={`cv-public-book-nav-btn ${activeStep === "cart" ? "is-active" : ""}`}
          >
            Cart
          </button>
          <button
            type="button"
            onClick={() => goToStep("payment")}
            className={`cv-public-book-nav-btn ${
              activeStep === "payment" || activeStep === "thanks" ? "is-active" : ""
            }`}
          >
            Payment
          </button>
          <button
            type="button"
            onClick={goPrev}
            className="cv-public-book-nav-btn"
            disabled={activeStepIndex <= STEP_INDEX.cover}
          >
            Prev
          </button>
          <button
            type="button"
            onClick={goNext}
            className="cv-public-book-nav-btn"
            disabled={activeStepIndex >= maxStepIndex}
          >
            Next
          </button>
        </div>

        {message && (
          <div className="fixed bottom-4 right-4 rounded-lg bg-rose-600 px-4 py-2 text-sm text-white shadow-lg">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
