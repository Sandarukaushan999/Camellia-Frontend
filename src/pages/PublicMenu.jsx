import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip";
import { useLocation, useParams } from "react-router-dom";
import publicApi from "../utils/publicApi.js";
import { formatBusinessDateTime } from "../utils/timezone.js";

const PAYMENT_METHOD_OPTIONS = ["CASH", "CARD", "QR", "ONLINE"];
const CUSTOMER_PROFILE_STORAGE_KEY = "cv_public_customer_profiles_v1";
const MAX_STORED_CUSTOMERS = 80;
const CATEGORY_ORDER = ["burger", "kottu", "submarine", "cafe", "juice", "rice", "pizza"];
const CATEGORY_META = {
  burger: { label: "Burger", icon: "\uD83C\uDF54" },
  kottu: { label: "Kottu", icon: "\uD83C\uDF5C" },
  submarine: { label: "Submarine", icon: "\uD83E\uDD56" },
  cafe: { label: "Cafe", icon: "\u2615" },
  juice: { label: "Juice", icon: "\uD83E\uDD64" },
  rice: { label: "Rice", icon: "\uD83C\uDF5A" },
  pizza: { label: "Pizza", icon: "\uD83C\uDF55" },
};

const DEFAULT_ORDER_FORM = {
  customer_name: "",
  customer_phone: "",
  table_number: "",
  payment_method: "CASH",
  note: "",
};

const BookPage = React.forwardRef(function BookPage({ className = "", children }, ref) {
  return (
    <div ref={ref} className={`cv-public-flip-page ${className}`}>
      {children}
    </div>
  );
});
BookPage.displayName = "BookPage";

function toMoney(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

function normalizePhone(value) {
  return String(value || "").replace(/[^\d+]/g, "").trim().slice(0, 24);
}

function getDetectedTable(search) {
  const params = new URLSearchParams(search);
  const raw =
    params.get("table") || params.get("table_no") || params.get("table_number") || "";
  return String(raw).trim().slice(0, 40);
}

function pageSize() {
  const width = typeof window === "undefined" ? 1200 : window.innerWidth;
  const height = typeof window === "undefined" ? 900 : window.innerHeight;
  if (width < 768) {
    return {
      w: Math.max(290, Math.min(width - 24, 430)),
      h: Math.max(560, Math.min(height - 118, 790)),
    };
  }
  return {
    w: Math.max(420, Math.min(Math.floor((width - 120) / 2), 560)),
    h: Math.max(640, Math.min(height - 95, 860)),
  };
}

function readStoredCustomerProfiles() {
  try {
    const raw = localStorage.getItem(CUSTOMER_PROFILE_STORAGE_KEY);
    if (!raw) {
      return {};
    }
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
  const bookRef = useRef(null);

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
  const [currentPage, setCurrentPage] = useState(0);
  const [size, setSize] = useState(() => pageSize());
  const [customerProfiles, setCustomerProfiles] = useState(() =>
    readStoredCustomerProfiles()
  );

  const detectedTable = useMemo(() => getDetectedTable(location.search), [location.search]);

  useEffect(() => {
    const tableValue = String(detectedTable || "").trim();
    if (!tableValue) {
      return;
    }
    setOrderForm((prev) => ({
      ...prev,
      table_number: tableValue,
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
        if (!mounted) {
          return;
        }
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
        if (mounted) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [location.search, routeBranchCode]);

  useEffect(() => {
    const onResize = () => setSize(pageSize());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const categories = useMemo(() => {
    const grouped = new Map();
    (menuData.items || []).forEach((item) => {
      const name = normalizeCategory(item.category);
      const key = categoryKey(name);
      if (!grouped.has(key)) {
        grouped.set(key, { key, name, items: [] });
      }
      grouped.get(key).items.push(item);
    });
    const rank = new Map(CATEGORY_ORDER.map((key, index) => [key, index]));
    return Array.from(grouped.values()).sort((a, b) => {
      const aRank = rank.has(a.key) ? rank.get(a.key) : 999;
      const bRank = rank.has(b.key) ? rank.get(b.key) : 999;
      if (aRank !== bRank) {
        return aRank - bRank;
      }
      return a.name.localeCompare(b.name);
    });
  }, [menuData.items]);

  const indexPage = 1;
  const categoryStart = 2;
  const cartPage = categoryStart + categories.length;
  const paymentPage = cartPage + 1;

  const categoryPages = useMemo(() => {
    const map = {};
    categories.forEach((category, index) => {
      map[category.key] = categoryStart + index;
    });
    return map;
  }, [categories]);

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
  const matchedProfile = useMemo(() => {
    const key = normalizePhone(orderForm.customer_phone);
    return key ? customerProfiles[key] || null : null;
  }, [customerProfiles, orderForm.customer_phone]);
  const canPlaceOrder =
    String(orderForm.customer_name || "").trim().length >= 2 && cartLines.length > 0;

  const goToPage = useCallback((index) => {
    const api = bookRef.current?.pageFlip?.();
    if (!api) {
      return;
    }
    api.turnToPage(Math.max(0, index));
  }, []);

  const changeQty = (productId, delta) => {
    const key = String(productId);
    setCart((prev) => {
      const nextQty = Math.max(0, Number(prev[key] || 0) + delta);
      const next = { ...prev };
      if (nextQty <= 0) {
        delete next[key];
      } else {
        next[key] = nextQty;
      }
      return next;
    });
  };

  const handlePhoneChange = (value) => {
    setOrderForm((prev) => ({ ...prev, customer_phone: value }));
    const key = normalizePhone(value);
    if (!key || !customerProfiles[key]) {
      return;
    }
    const profile = customerProfiles[key];
    setOrderForm((prev) => ({
      ...prev,
      customer_phone: value,
      customer_name: prev.customer_name || profile.customer_name || "",
      table_number: detectedTable || prev.table_number || profile.table_number || "",
      payment_method:
        prev.payment_method === "CASH" && profile.payment_method
          ? profile.payment_method
          : prev.payment_method,
      note: prev.note || profile.note || "",
    }));
  };

  const updateProfileFromOrder = () => {
    const key = normalizePhone(orderForm.customer_phone);
    if (!key) {
      return;
    }
    const profile = {
      customer_name: String(orderForm.customer_name || "").trim(),
      table_number: String(detectedTable || orderForm.table_number || "").trim(),
      payment_method: orderForm.payment_method,
      note: String(orderForm.note || "").trim(),
      updated_at: new Date().toISOString(),
    };
    setCustomerProfiles((prev) => trimCustomerProfiles({ ...prev, [key]: profile }));
  };

  const submitOrder = async () => {
    if (!canPlaceOrder) {
      setMessage("Enter customer name and add items first");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      const payload = {
        branch_id: menuData?.branch?.id || undefined,
        branch_code: menuData?.branch?.code || undefined,
        customer_name: orderForm.customer_name,
        customer_phone: orderForm.customer_phone || undefined,
        order_type: "DINE-IN",
        table_number: detectedTable || orderForm.table_number || undefined,
        payment_method: orderForm.payment_method,
        note: orderForm.note || undefined,
        items: cartLines.map((line) => ({ product_id: line.productId, qty: line.qty })),
      };
      const { data } = await publicApi.post("/public/orders", payload);
      setOrderSuccess(data || null);
      updateProfileFromOrder();
      setCart({});
    } catch (err) {
      console.error("Failed to submit menu order:", err);
      setMessage(err?.response?.data?.message || "Failed to submit order");
    } finally {
      setSubmitting(false);
    }
  };

  const startNewOrder = () => {
    setOrderSuccess(null);
    setCart({});
    goToPage(indexPage);
  };

  const inCategoryFlow =
    currentPage === indexPage || (currentPage >= categoryStart && currentPage < cartPage);

  const stopFlipPropagation = (event) => {
    event.stopPropagation();
  };

  const noFlipProps = {
    onPointerDown: stopFlipPropagation,
    onMouseDown: stopFlipPropagation,
    onTouchStart: stopFlipPropagation,
    onTouchMove: stopFlipPropagation,
  };

  return (
    <div className="cv-public-menu min-h-screen">
      <div className="cv-public-menu-bg" />
      <div className="relative mx-auto max-w-7xl p-3 md:p-5">
        <div className="cv-public-book-root">
          <HTMLFlipBook
            key={`menu-book-${categories.length}`}
            ref={bookRef}
            width={size.w}
            height={size.h}
            minWidth={290}
            maxWidth={580}
            minHeight={560}
            maxHeight={900}
            size="fixed"
            usePortrait
            autoSize
            showCover
            drawShadow
            maxShadowOpacity={0.56}
            flippingTime={1150}
            mobileScrollSupport
            disableFlipByClick
            useMouseEvents={currentPage !== paymentPage}
            swipeDistance={34}
            className="cv-public-flipbook"
            onFlip={(event) => setCurrentPage(Number(event?.data || 0))}
          >
            <BookPage className="cv-public-flip-page--cover">
              <article className="cv-public-cover-poster">
                <div className="cv-public-cover-accent" />
                <div className="cv-public-cover-headline">
                  <p className="cv-public-cover-kicker">Camellia Cafe</p>
                  <h1>
                    Taste the
                    <br />
                    Signature Menu
                  </h1>
                  <p>Flip category pages, then payment and place order at the end.</p>
                </div>
                <div className="cv-public-cover-price-tag">
                  <span>Live Menu</span>
                  <strong>Open</strong>
                </div>
                <div className="cv-public-cover-actions">
                  <button
                    type="button"
                    onClick={() => goToPage(indexPage)}
                    className="cv-public-submit-btn cv-public-cover-open-btn"
                  >
                    Open Menu Book
                  </button>
                  <p>Swipe or drag corners for realistic page turns</p>
                </div>
              </article>
            </BookPage>

            <BookPage className="cv-public-flip-page--intro">
              <div className="cv-public-flip-content">
                <header className="cv-public-flip-header">
                  <p className="cv-public-menu-kicker">Camellia Cafe & Restaurant</p>
                  <h2 className="cv-public-flip-title">Category Index</h2>
                  <p className="cv-public-menu-subtitle">
                    {menuData.branch
                      ? `${menuData.branch.code} - ${menuData.branch.name}`
                      : "Loading branch..."}
                  </p>
                </header>

                <div className="cv-public-flip-scroll">
                  <div className="cv-public-menu-hero-meta">
                    <span className="cv-public-chip">{"\uD83D\uDCE6"} ALL</span>
                    <span className="cv-public-chip">{cartCount} items in cart</span>
                    <span className="cv-public-chip">
                      {detectedTable ? `Table #${detectedTable}` : "DINE-IN only"}
                    </span>
                    <span className="cv-public-chip">
                      {menuData.generated_at
                        ? `Updated ${formatBusinessDateTime(menuData.generated_at, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                        : "Live menu"}
                    </span>
                  </div>

                  {loading ? (
                    <div className="mt-4 rounded-2xl border border-white/50 bg-white/70 p-8 text-center text-sm text-slate-600">
                      Loading categories...
                    </div>
                  ) : categories.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white/85 p-8 text-center text-sm text-slate-600">
                      No active menu items available.
                    </div>
                  ) : (
                    <div className="cv-public-category-grid mt-4">
                      {categories.map((category) => {
                        const meta = CATEGORY_META[category.key] || {
                          label: category.name,
                          icon: "\uD83D\uDCE6",
                        };
                        return (
                          <button
                            key={category.key}
                            type="button"
                            onClick={() => goToPage(categoryPages[category.key])}
                            className="cv-public-category-card"
                          >
                            <div className="cv-public-category-card-head">
                              <span className="cv-public-category-icon">{meta.icon}</span>
                              <span className="cv-public-category-name">{meta.label}</span>
                            </div>
                            <span className="cv-public-category-count">{category.items.length} items</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="cv-public-flip-footer">
                  <button
                    type="button"
                    onClick={() => {
                      if (categories.length > 0) {
                        goToPage(categoryPages[categories[0].key]);
                      }
                    }}
                    disabled={categories.length === 0}
                    className="cv-public-submit-btn cv-public-cover-open-btn"
                  >
                    Start First Category
                  </button>
                </div>
              </div>
            </BookPage>

            {categories.map((category) => {
              const meta = CATEGORY_META[category.key] || {
                label: category.name,
                icon: "\uD83D\uDCE6",
              };
              return (
                <BookPage key={`cat-${category.key}`} className="cv-public-flip-page--menu">
                  <div className="cv-public-flip-content">
                    <header className="cv-public-flip-header">
                      <p className="cv-public-menu-kicker">
                        {meta.icon} {meta.label}
                      </p>
                      <h2 className="cv-public-flip-title">{meta.label} Menu</h2>
                      <p className="cv-public-menu-subtitle">
                        {category.items.length} items available
                      </p>
                    </header>

                    <div className="cv-public-flip-scroll">
                      <div className="cv-public-category-chip-row">
                        {categories.map((group) => {
                          const groupMeta = CATEGORY_META[group.key] || {
                            label: group.name,
                            icon: "\uD83D\uDCE6",
                          };
                          return (
                            <button
                              key={`chip-${group.key}`}
                              type="button"
                              onClick={() => goToPage(categoryPages[group.key])}
                              className={`cv-public-cat-chip ${group.key === category.key ? "is-active" : ""}`}
                            >
                              {groupMeta.icon} {groupMeta.label}
                            </button>
                          );
                        })}
                      </div>

                      <div className="cv-public-category-items-grid mt-3">
                        {category.items.map((item) => {
                          const qty = Number(cart[String(item.id)] || 0);
                          return (
                            <article
                              key={item.id}
                              className="cv-public-menu-card cv-public-menu-card--category"
                            >
                              <div className="cv-public-menu-image-wrap">
                                {item.image_url ? (
                                  <img
                                    src={item.image_url}
                                    alt={item.name}
                                    className="cv-public-menu-image"
                                  />
                                ) : (
                                  <div className="cv-public-menu-image-placeholder">
                                    <i className="fi-rr-utensils" aria-hidden="true" />
                                  </div>
                                )}
                              </div>
                              <div className="p-3">
                                <h3 className="line-clamp-1 text-sm font-semibold text-slate-900">
                                  {item.name}
                                </h3>
                                <div className="mt-2 flex items-center justify-between">
                                  <span className="text-sm font-bold text-slate-900">
                                    {toMoney(item.price)}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => changeQty(item.id, -1)}
                                      className="cv-public-qty-btn"
                                      disabled={qty <= 0}
                                      {...noFlipProps}
                                    >
                                      -
                                    </button>
                                    <span className="w-6 text-center text-sm font-semibold text-slate-700">
                                      {qty}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => changeQty(item.id, 1)}
                                      className="cv-public-qty-btn"
                                      {...noFlipProps}
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
                    </div>

                    <div className="cv-public-flip-footer cv-public-flip-footer--split">
                      <button
                        type="button"
                        onClick={() => goToPage(cartPage)}
                        className="cv-public-submit-btn cv-public-cover-open-btn"
                      >
                        Go To Cart ({cartCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => goToPage(paymentPage)}
                        className="cv-public-soft-btn cv-public-secondary-btn"
                      >
                        Skip to Payment
                      </button>
                    </div>
                  </div>
                </BookPage>
              );
            })}

            <BookPage className="cv-public-flip-page--cart">
              <div className="cv-public-flip-content">
                <header className="cv-public-flip-header">
                  <p className="cv-public-menu-kicker">Cart Summary</p>
                  <h2 className="cv-public-flip-title">Your Order</h2>
                  <p className="cv-public-menu-subtitle">
                    {cartCount > 0
                      ? `${cartCount} items selected`
                      : "Add menu items to build your order"}
                  </p>
                </header>

                <div className="cv-public-flip-scroll" {...noFlipProps}>
                  {cartLines.length === 0 ? (
                    <div className="cv-public-flip-note">
                      <h3>Your cart is empty</h3>
                      <p>Go back to category pages and tap + to add items.</p>
                    </div>
                  ) : (
                    <div className="cv-public-cart-panel cv-public-cart-panel--flat">
                      <div className="cv-public-cart-header">
                        <h3 className="text-sm font-extrabold text-slate-900">Order Items</h3>
                        <span className="text-xs font-semibold text-slate-600">
                          {cartLines.length} lines
                        </span>
                      </div>
                      <div className="cv-public-cart-lines">
                        {cartLines.map((line) => (
                          <div key={`cart-${line.productId}`} className="cv-public-cart-line">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold text-slate-900">
                                {line.item?.name}
                              </div>
                              <div className="text-xs font-medium text-slate-500">
                                {line.item?.category || "Other"}
                              </div>
                              <div className="mt-1 text-xs font-semibold text-slate-700">
                                {toMoney(line.item?.price)} each
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => changeQty(line.productId, -1)}
                                  className="cv-public-qty-btn"
                                  {...noFlipProps}
                                >
                                  -
                                </button>
                                <span className="w-6 text-center text-sm font-bold text-slate-800">
                                  {line.qty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => changeQty(line.productId, 1)}
                                  className="cv-public-qty-btn"
                                  {...noFlipProps}
                                >
                                  +
                                </button>
                              </div>
                              <div className="mt-1 text-sm font-extrabold text-slate-900">
                                {toMoney(line.lineTotal)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <span>Estimated Total</span>
                          <span>{cartCount} items</span>
                        </div>
                        <div className="mt-1 text-lg font-extrabold text-slate-900">
                          {toMoney(cartTotal)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="cv-public-flip-footer cv-public-flip-footer--split">
                  <button
                    type="button"
                    onClick={() => goToPage(indexPage)}
                    className="cv-public-secondary-btn"
                  >
                    Back to Categories
                  </button>
                  <button
                    type="button"
                    onClick={() => goToPage(paymentPage)}
                    className="cv-public-submit-btn cv-public-cover-open-btn"
                    disabled={cartLines.length === 0}
                  >
                    Continue To Payment
                  </button>
                </div>
              </div>
            </BookPage>

            <BookPage className="cv-public-flip-page--payment">
              <div className="cv-public-flip-content">
                <header className="cv-public-flip-header">
                  <p className="cv-public-menu-kicker">Payment</p>
                  <h2 className="cv-public-flip-title">Place Your Order</h2>
                  <p className="cv-public-menu-subtitle">
                    DINE-IN only. Fill details and submit directly from this page.
                  </p>
                </header>

                <div className="cv-public-flip-scroll" {...noFlipProps}>
                  {orderSuccess ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <h3 className="text-base font-extrabold text-emerald-900">
                        Order placed successfully
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-emerald-800">
                        Reference:{" "}
                        <span className="rounded-md bg-white px-2 py-1 font-black text-emerald-900">
                          {orderSuccess.reference || "-"}
                        </span>
                      </p>
                      <p className="mt-2 text-xs font-semibold text-emerald-700">
                        Your order is now queued for staff confirmation.
                      </p>
                      <button
                        type="button"
                        onClick={startNewOrder}
                        className="cv-public-submit-btn mt-4"
                      >
                        Start New Order
                      </button>
                    </div>
                  ) : (
                    <form
                      className="space-y-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        submitOrder();
                      }}
                      {...noFlipProps}
                    >
                      <label className="block">
                        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600">
                          Your name *
                        </span>
                        <input
                          type="text"
                          className="cv-public-input"
                          value={orderForm.customer_name}
                          onChange={(event) =>
                            setOrderForm((prev) => ({
                              ...prev,
                              customer_name: event.target.value,
                            }))
                          }
                          placeholder="Customer name"
                          required
                          {...noFlipProps}
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600">
                          Phone number
                        </span>
                        <input
                          type="tel"
                          className="cv-public-input"
                          value={orderForm.customer_phone}
                          onChange={(event) => handlePhoneChange(normalizePhone(event.target.value))}
                          placeholder="07xxxxxxxx"
                          {...noFlipProps}
                        />
                      </label>
                      {matchedProfile && (
                        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">
                          Returning customer detected. Saved details were auto-filled.
                        </div>
                      )}

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block">
                          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600">
                            Order type
                          </span>
                          <div className="cv-public-order-type-fixed">DINE-IN</div>
                        </label>

                        <label className="block">
                          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600">
                            Payment
                          </span>
                          <select
                            className="cv-public-input"
                            value={orderForm.payment_method}
                            onChange={(event) =>
                              setOrderForm((prev) => ({
                                ...prev,
                                payment_method: event.target.value,
                              }))
                            }
                            {...noFlipProps}
                          >
                            {PAYMENT_METHOD_OPTIONS.map((method) => (
                              <option key={method} value={method}>
                                {method}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <label className="block">
                        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600">
                          Table number
                        </span>
                        <input
                          type="text"
                          className="cv-public-input"
                          value={detectedTable || orderForm.table_number}
                          onChange={(event) =>
                            setOrderForm((prev) => ({
                              ...prev,
                              table_number: event.target.value,
                            }))
                          }
                          placeholder="Table no"
                          readOnly={Boolean(detectedTable)}
                          {...noFlipProps}
                        />
                        {detectedTable && (
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            Auto-detected from QR code
                          </p>
                        )}
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600">
                          Special notes
                        </span>
                        <textarea
                          className="cv-public-input min-h-[84px] resize-y"
                          value={orderForm.note}
                          onChange={(event) =>
                            setOrderForm((prev) => ({
                              ...prev,
                              note: event.target.value,
                            }))
                          }
                          placeholder="Any preferences..."
                          {...noFlipProps}
                        />
                      </label>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <span>Estimated total</span>
                          <span>{cartCount} items</span>
                        </div>
                        <div className="mt-1 text-xl font-black text-slate-900">
                          {toMoney(cartTotal)}
                        </div>
                      </div>

                    </form>
                  )}
                </div>

                <div className="cv-public-flip-footer cv-public-flip-footer--split">
                  <button
                    type="button"
                    onClick={() => goToPage(cartPage)}
                    className="cv-public-secondary-btn"
                  >
                    Back to Cart
                  </button>
                  {!orderSuccess && (
                    <button
                      type="button"
                      onClick={submitOrder}
                      className="cv-public-submit-btn cv-public-cover-open-btn"
                      disabled={!canPlaceOrder || submitting}
                    >
                      {submitting ? "Placing..." : "Place Order"}
                    </button>
                  )}
                </div>
              </div>
            </BookPage>
          </HTMLFlipBook>
        </div>

        <div className="cv-public-book-controls cv-public-book-controls--wide">
          <button
            type="button"
            onClick={() => goToPage(0)}
            className={`cv-public-book-nav-btn ${currentPage === 0 ? "is-active" : ""}`}
          >
            Cover
          </button>
          <button
            type="button"
            onClick={() => goToPage(indexPage)}
            className={`cv-public-book-nav-btn ${inCategoryFlow ? "is-active" : ""}`}
          >
            Categories
          </button>
          <button
            type="button"
            onClick={() => goToPage(cartPage)}
            className={`cv-public-book-nav-btn ${currentPage === cartPage ? "is-active" : ""}`}
          >
            Cart
          </button>
          <button
            type="button"
            onClick={() => goToPage(paymentPage)}
            className={`cv-public-book-nav-btn ${currentPage === paymentPage ? "is-active" : ""}`}
          >
            Payment
          </button>
          <button
            type="button"
            onClick={() => bookRef.current?.pageFlip?.()?.flipPrev()}
            className="cv-public-book-nav-btn"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => bookRef.current?.pageFlip?.()?.flipNext()}
            className="cv-public-book-nav-btn"
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
