import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../utils/api.js";
import Receipt from "../components/Receipt.jsx";
import ReceiptPreview from "../components/ReceiptPreview.jsx";
import { useAuth } from "../state/AuthContext.jsx";

const CATEGORY_ICONS = {
  ALL: "📦",
  Burger: "🍔",
  Kottu: "🍜",
  Submarine: "🥖",
  Café: "☕",
  Juice: "🥤",
  Rice: "🍚",
  Pizza: "🍕",
};

const DEFAULT_CATEGORIES = [
  "ALL",
  "Burger",
  "Kottu",
  "Submarine",
  "Café",
  "Juice",
  "Rice",
  "Pizza",
];


const DEFAULT_PRINTER_SETTINGS = {
  autoPrint: true,
  printMode: "ESC_POS_TCP",
  model: "XPrinter XP-K200L",
  host: "",
  port: 9100,
  paperSize: "80mm",
  charsPerLine: 48,
  timeoutMs: 4000,
};

function loadShopInfoFromStorage() {
  const fallback = {
    name: "Camellia Cafe & Restaurant",
    address: "",
    phone: "",
    email: "",
  };

  try {
    const saved = localStorage.getItem("cv_shop_info");
    if (saved) {
      return { ...fallback, ...JSON.parse(saved) };
    }
  } catch {
    // ignore parsing/storage errors
  }

  return fallback;
}

export default function POS() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [orderType, setOrderType] = useState("DINE-IN");
  const [tableNumber, setTableNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [cashGiven, setCashGiven] = useState("");
  const [orderId, setOrderId] = useState(null);
  const [heldOrders, setHeldOrders] = useState([]);
  const [showHeldOrdersModal, setShowHeldOrdersModal] = useState(false);
  const [heldOrdersLoading, setHeldOrdersLoading] = useState(false);
  const [heldActionBusyId, setHeldActionBusyId] = useState(null);
  const [message, setMessage] = useState("");
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [customerPhone, setCustomerPhone] = useState("");
  const [crmCustomerName, setCrmCustomerName] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerLookupStatus, setCustomerLookupStatus] = useState("idle"); // idle | loading | found | not-found | error
  const [customerLookupMessage, setCustomerLookupMessage] = useState("");
  const [loyaltyPreview, setLoyaltyPreview] = useState(null);
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState("");
  const [loyaltyPreviewLoading, setLoyaltyPreviewLoading] = useState(false);
  // Per-bill discount
  const [discountType, setDiscountType] = useState("NONE"); // NONE | PERCENT | AMOUNT
  const [discountValue, setDiscountValue] = useState("");
  // System preferences (sound, default order type, touch mode)
  const [systemPrefs, setSystemPrefs] = useState({
    defaultOrderType: "DINE-IN",
    openPOSOnStart: true,
    enableSound: true,
    touchMode: true,
  });
  const [printerSettings, setPrinterSettings] = useState({
    ...DEFAULT_PRINTER_SETTINGS,
  });

  const loadProducts = useCallback(async () => {
    try {
      const res = await api.get("/admin/products/pos");
      setProducts(res.data);
    } catch (err) {
      console.error("Failed to load products", err);
      setProducts([]);
    }
  }, []);

  const loadHeldOrders = useCallback(async () => {
    try {
      setHeldOrdersLoading(true);
      const { data } = await api.get("/orders/held", { params: { limit: 100 } });
      setHeldOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load held orders", err);
      setHeldOrders([]);
    } finally {
      setHeldOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();

    // Keep POS products in sync when Products page changes them (even across tabs)
    const onStorage = (e) => {
      if (e.key === "cv_products_updated_at") {
        loadProducts();
      }
    };

    // Also reload when user returns to this tab/window
    const onFocus = () => loadProducts();
    const onVisibility = () => {
      if (document.visibilityState === "visible") loadProducts();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadProducts]);

  useEffect(() => {
    if (!showHeldOrdersModal) {
      return;
    }
    loadHeldOrders();
  }, [showHeldOrdersModal, loadHeldOrders]);

  // Load system preferences (default order type, sound, touch mode)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cv_system_prefs");
      if (saved) {
        const parsed = JSON.parse(saved);
        setSystemPrefs((prev) => ({ ...prev, ...parsed }));
        if (parsed.defaultOrderType) {
          setOrderType(parsed.defaultOrderType);
        }
      }
    } catch {
      // ignore
    }

    const onStorage = (e) => {
      if (e.key === "cv_system_prefs_updated_at") {
        try {
          const latest = localStorage.getItem("cv_system_prefs");
          if (latest) {
            const parsed = JSON.parse(latest);
            setSystemPrefs((prev) => ({ ...prev, ...parsed }));
            if (parsed.defaultOrderType) {
              setOrderType(parsed.defaultOrderType);
            }
          }
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Load printer settings (direct ESC/POS printing)
  useEffect(() => {
    const loadPrinterSettings = () => {
      try {
        const saved = localStorage.getItem("cv_printer_settings");
        if (saved) {
          const parsed = JSON.parse(saved);
          setPrinterSettings((prev) => ({ ...prev, ...parsed }));
        }
      } catch {
        // ignore
      }
    };

    loadPrinterSettings();

    const onStorage = (e) => {
      if (e.key === "cv_printer_settings_updated_at") {
        loadPrinterSettings();
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const categories = useMemo(() => {
    const productCategories = Array.isArray(products)
      ? [...new Set(products.map((p) => String(p.category || "").trim()).filter(Boolean))]
      : [];
    const defaults = DEFAULT_CATEGORIES.filter((c) => c !== "ALL");
    const extras = productCategories.filter((c) => !defaults.includes(c));
    return ["ALL", ...defaults, ...extras];
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!Array.isArray(products)) {
      return [];
    }
    if (selectedCategory === "ALL") {
      return products;
    }
    return products.filter((product) => String(product.category || "").trim() === selectedCategory);
  }, [products, selectedCategory]);

  useEffect(() => {
    if (!categories.includes(selectedCategory)) {
      setSelectedCategory("ALL");
    }
  }, [categories, selectedCategory]);



  const playAddSound = () => {
    if (!systemPrefs.enableSound) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.1);
    } catch {
      // audio unsupported, ignore
    }
  };

  const normalizePhone = (phone) => String(phone || "").replace(/[^\d+]/g, "").trim();

  const clearSelectedCustomer = () => {
    setSelectedCustomer(null);
    setCustomerLookupStatus("idle");
    setCustomerLookupMessage("");
    setLoyaltyPreview(null);
    setLoyaltyPointsToRedeem("");
  };

  const lookupCustomerByPhone = async () => {
    const normalized = normalizePhone(customerPhone);
    if (!normalized) {
      setCustomerLookupStatus("error");
      setCustomerLookupMessage("Enter a valid phone number");
      return;
    }

    setCustomerLookupStatus("loading");
    setCustomerLookupMessage("");
    try {
      const { data } = await api.get("/crm/customers/lookup", {
        params: { phone: normalized },
      });
      if (data?.customer) {
        setSelectedCustomer(data.customer);
        setCrmCustomerName(data.customer.full_name || "");
        setLoyaltyPointsToRedeem("");
        setCustomerLookupStatus("found");
        setCustomerLookupMessage("Customer found");
      } else {
        setSelectedCustomer(null);
        setLoyaltyPreview(null);
        setLoyaltyPointsToRedeem("");
        setCustomerLookupStatus("not-found");
        setCustomerLookupMessage("No customer found for this phone");
      }
    } catch (err) {
      console.error("Customer lookup failed", err);
      setSelectedCustomer(null);
      setLoyaltyPreview(null);
      setLoyaltyPointsToRedeem("");
      setCustomerLookupStatus("error");
      setCustomerLookupMessage(err.response?.data?.message || "Lookup failed");
    }
  };

  const quickCreateCustomer = async () => {
    const normalized = normalizePhone(customerPhone);
    const name = String(crmCustomerName || customerName || "").trim();
    if (!normalized || !name) {
      setCustomerLookupStatus("error");
      setCustomerLookupMessage("Customer name and phone are required");
      return;
    }

    setCustomerLookupStatus("loading");
    setCustomerLookupMessage("");
    try {
      const { data } = await api.post("/crm/customers/quick-create", {
        full_name: name,
        phone: normalized,
      });
      if (data?.customer) {
        setSelectedCustomer(data.customer);
        setCrmCustomerName(data.customer.full_name || name);
        setLoyaltyPointsToRedeem("");
        setCustomerLookupStatus("found");
        setCustomerLookupMessage(data.created ? "Customer created" : "Existing customer selected");
      } else {
        setCustomerLookupStatus("error");
        setCustomerLookupMessage("Customer creation failed");
      }
    } catch (err) {
      console.error("Quick create customer failed", err);
      setCustomerLookupStatus("error");
      setCustomerLookupMessage(err.response?.data?.message || "Failed to create customer");
    }
  };

  const loadLoyaltyPreview = async (customerId, orderTotal) => {
    if (!customerId || !Number.isFinite(orderTotal) || orderTotal <= 0) {
      setLoyaltyPreview(null);
      return;
    }

    setLoyaltyPreviewLoading(true);
    try {
      const { data } = await api.get(`/crm/customers/${customerId}/loyalty/redeem-preview`, {
        params: { order_total: orderTotal.toFixed(2) },
      });
      setLoyaltyPreview(data || null);
    } catch (err) {
      console.error("Loyalty preview failed", err);
      setLoyaltyPreview(null);
    } finally {
      setLoyaltyPreviewLoading(false);
    }
  };

  // Add to cart or increase quantity
  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((p) => p.id === product.id);
      if (existing) {
        return prev.map((p) =>
          p.id === product.id ? { ...p, qty: p.qty + 1 } : p
        );
      }
      return [...prev, { ...product, qty: 1 }];
    });
    // Visual feedback
    setMessage(`${product.name} added`);
    setTimeout(() => setMessage(""), 1500);
    playAddSound();
  };

  // Update quantity
  const updateQty = (id, delta) => {
    setCart((prev) =>
      prev
        .map((p) => {
          if (p.id === id) {
            const newQty = Math.max(0, p.qty + delta);
            return { ...p, qty: newQty };
          }
          return p;
        })
        .filter((p) => p.qty > 0)
    );
  };

  // Remove item
  const removeItem = (id) => {
    setCart((prev) => prev.filter((p) => p.id !== id));
  };

  // Load tax & service settings from localStorage (saved in Settings)
  const [taxSettings, setTaxSettings] = useState({
    enableTax: true,
    taxPercentage: 2,
    enableService: true,
    serviceCharge: 5,
    roundTotal: false,
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("cv_tax_settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        setTaxSettings((prev) => ({
          ...prev,
          ...parsed,
        }));
      }
    } catch {
      // ignore parse errors and keep defaults
    }

    const onStorage = (e) => {
      if (e.key === "cv_tax_settings_updated_at") {
        try {
          const latest = localStorage.getItem("cv_tax_settings");
          if (latest) {
            const parsed = JSON.parse(latest);
            setTaxSettings((prev) => ({
              ...prev,
              ...parsed,
            }));
          }
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Calculate totals based on tax/service settings
  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + parseFloat(item.price) * item.qty, 0);

    const serviceCharge = taxSettings.enableService
      ? subtotal * (Number(taxSettings.serviceCharge) / 100 || 0)
      : 0;

    const tax = taxSettings.enableTax
      ? subtotal * (Number(taxSettings.taxPercentage) / 100 || 0)
      : 0;

    const beforeDiscount = subtotal + serviceCharge + tax;

    // Manual discount
    let manualDiscountAmount = 0;
    const valueNum = parseFloat(discountValue) || 0;
    if (discountType === "PERCENT" && valueNum > 0) {
      manualDiscountAmount = beforeDiscount * (valueNum / 100);
    } else if (discountType === "AMOUNT" && valueNum > 0) {
      manualDiscountAmount = valueNum;
    }
    // Do not allow discount to exceed total before discount
    if (manualDiscountAmount > beforeDiscount) {
      manualDiscountAmount = beforeDiscount;
    }

    let totalBeforeLoyalty = beforeDiscount - manualDiscountAmount;
    if (totalBeforeLoyalty < 0) {
      totalBeforeLoyalty = 0;
    }

    let loyaltyPointsRedeemed = 0;
    let loyaltyDiscountAmount = 0;
    if (selectedCustomer && loyaltyPreview) {
      const requestedPoints = parseInt(loyaltyPointsToRedeem, 10);
      const maxRedeemablePoints = Number(loyaltyPreview.max_redeemable_points || 0);
      const minRedeemPoints = Number(loyaltyPreview.min_redeem_points || 0);
      const pointValue = Number(loyaltyPreview.discount_per_point || 1);

      if (Number.isFinite(requestedPoints) && requestedPoints > 0 && requestedPoints >= minRedeemPoints) {
        loyaltyPointsRedeemed = Math.min(requestedPoints, maxRedeemablePoints);
        loyaltyDiscountAmount = loyaltyPointsRedeemed * pointValue;
      }
    }

    if (loyaltyDiscountAmount > totalBeforeLoyalty) {
      loyaltyDiscountAmount = totalBeforeLoyalty;
    }

    let total = totalBeforeLoyalty - loyaltyDiscountAmount;
    if (taxSettings.roundTotal) {
      total = Math.round(total);
    }

    const totalDiscount = manualDiscountAmount + loyaltyDiscountAmount;

    return {
      subtotal: subtotal.toFixed(2),
      serviceCharge: serviceCharge.toFixed(2),
      tax: tax.toFixed(2),
      discount: totalDiscount.toFixed(2),
      manualDiscount: manualDiscountAmount.toFixed(2),
      loyaltyDiscount: loyaltyDiscountAmount.toFixed(2),
      loyaltyPointsRedeemed,
      totalBeforeLoyalty: totalBeforeLoyalty.toFixed(2),
      // keep percent value for receipt (only meaningful when type is PERCENT)
      discountPercent: discountType === "PERCENT" ? valueNum : 0,
      total: total.toFixed(2),
    };
  }, [
    cart,
    taxSettings,
    discountType,
    discountValue,
    selectedCustomer,
    loyaltyPreview,
    loyaltyPointsToRedeem,
  ]);

  useEffect(() => {
    if (!showPaymentModal || !selectedCustomer?.id) {
      setLoyaltyPreview(null);
      setLoyaltyPointsToRedeem("");
      return;
    }

    const orderTotal = parseFloat(totals.totalBeforeLoyalty || 0);
    if (!Number.isFinite(orderTotal) || orderTotal <= 0) {
      setLoyaltyPreview(null);
      return;
    }

    const timeout = setTimeout(() => {
      loadLoyaltyPreview(selectedCustomer.id, orderTotal);
    }, 180);

    return () => clearTimeout(timeout);
  }, [showPaymentModal, selectedCustomer?.id, totals.totalBeforeLoyalty]);

  // Generate order ID
  const generateOrderId = () => {
    return Math.floor(1000 + Math.random() * 9000);
  };

  // Hold order
  const holdOrder = async () => {
    if (cart.length === 0) {
      setMessage("Cart is empty");
      setTimeout(() => setMessage(""), 2000);
      return;
    }
    try {
      const normalizedPhone = normalizePhone(customerPhone);
      const payload = {
        order_type: orderType,
        table_number: tableNumber || null,
        customer_name: String(crmCustomerName || customerName || "").trim() || null,
        customer_phone: normalizedPhone || null,
        items: cart.map((item) => ({
          product_id: item.id,
          name: item.name,
          qty: item.qty,
          price: item.price,
          category: item.category || null,
        })),
        meta: {
          payment_method: paymentMethod,
          discount_type: discountType,
          discount_value: discountValue || 0,
        },
      };

      const { data } = await api.post("/orders/held", payload);
      setMessage(`Order #${data.id} held`);
      setOrderId(null);
      setCart([]);
      setTableNumber("");
      setCustomerName("");
      setCustomerPhone("");
      setCrmCustomerName("");
      clearSelectedCustomer();

      if (showHeldOrdersModal) {
        loadHeldOrders();
      }
      setTimeout(() => setMessage(""), 2200);
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to hold order");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const heldOrderTotal = (heldOrder) => {
    if (!Array.isArray(heldOrder?.items)) {
      return 0;
    }
    return heldOrder.items.reduce((sum, item) => {
      const qty = parseFloat(item?.qty || 0);
      const price = parseFloat(item?.price || 0);
      if (!Number.isFinite(qty) || !Number.isFinite(price)) {
        return sum;
      }
      return sum + qty * price;
    }, 0);
  };

  const recallHeldOrder = async (heldId) => {
    setHeldActionBusyId(`recall-${heldId}`);
    try {
      const { data } = await api.post(`/orders/held/${heldId}/recall`);
      const heldOrder = data?.held_order;
      const heldItems = Array.isArray(heldOrder?.items) ? heldOrder.items : [];
      if (heldItems.length === 0) {
        setMessage("Held order has no items");
        setTimeout(() => setMessage(""), 2500);
        return;
      }

      clearSelectedCustomer();
      setCart(
        heldItems.map((item) => ({
          id: item.product_id,
          name: item.name,
          qty: parseFloat(item.qty) || 1,
          price: parseFloat(item.price) || 0,
          category: item.category || null,
        }))
      );
      setOrderType(heldOrder.order_type || "DINE-IN");
      setTableNumber(heldOrder.table_number || "");
      setCustomerName(heldOrder.customer_name || "");
      setCrmCustomerName(heldOrder.customer_name || "");
      setCustomerPhone(heldOrder.customer_phone || "");
      setOrderId(heldOrder.id || null);
      setShowHeldOrdersModal(false);
      setMessage(`Held order #${heldId} recalled`);
      setTimeout(() => setMessage(""), 2600);
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to recall held order");
      setTimeout(() => setMessage(""), 3000);
      await loadHeldOrders();
    } finally {
      setHeldActionBusyId(null);
    }
  };

  const deleteHeldOrder = async (heldId) => {
    if (!window.confirm(`Delete held order #${heldId}?`)) {
      return;
    }

    setHeldActionBusyId(`delete-${heldId}`);
    try {
      await api.delete(`/orders/held/${heldId}`);
      await loadHeldOrders();
      setMessage(`Held order #${heldId} deleted`);
      setTimeout(() => setMessage(""), 2300);
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to delete held order");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setHeldActionBusyId(null);
    }
  };

  // Open payment modal
  const handlePay = () => {
    if (cart.length === 0) {
      setMessage("Cart is empty");
      setTimeout(() => setMessage(""), 2000);
      return;
    }
    if (!crmCustomerName && customerName) {
      setCrmCustomerName(customerName);
    }
    setShowPaymentModal(true);
    setOrderId(generateOrderId());
  };

  // Process payment directly
  const processPayment = async (method) => {
    if (!method) {
      setMessage("Please select payment method");
      return;
    }

    if (cart.length === 0) {
      setMessage("Cart is empty");
      setTimeout(() => setMessage(""), 2000);
      return;
    }

    setPaymentMethod(method);
    if (method !== "CASH") {
      setCashGiven("");
    }
    if (!crmCustomerName && customerName) {
      setCrmCustomerName(customerName);
    }
    setShowPaymentModal(true);
  };

  // Execute payment
  const executePayment = async (method, cashAmount = 0) => {

    try {
      const normalizedPhone = normalizePhone(customerPhone);
      const resolvedCustomerName = String(
        selectedCustomer?.full_name ||
          crmCustomerName ||
          (orderType === "DELIVERY" ? customerName : "")
      ).trim();

      const payload = {
        total: totals.total,
        total_before_loyalty: totals.totalBeforeLoyalty,
        payment_method: method,
        customer_id: selectedCustomer?.id || null,
        customer_name: resolvedCustomerName || null,
        customer_phone: normalizedPhone || selectedCustomer?.phone || null,
        loyalty_points_redeemed: totals.loyaltyPointsRedeemed || 0,
        loyalty_discount_amount: totals.loyaltyDiscount || 0,
        order_type: orderType,
        channel: "POS",
        items: cart.map((item) => ({
          product_id: item.id,
          qty: item.qty,
          price: item.price,
        })),
      };

      const res = await api.post("/orders", payload);
      
      // Prepare receipt data
      const receiptInfo = {
        billNo: res.data.id,
        date: new Date().toISOString().split("T")[0],
        time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        orderType: orderType,
        tableNumber: orderType === "DINE-IN" ? (tableNumber || null) : null,
        customerName: resolvedCustomerName || (orderType === "DELIVERY" ? (customerName || tableNumber || null) : null),
        cashier: user?.username || "System",
        items: cart.map((item) => ({
          name: item.name,
          qty: item.qty,
          price: item.price,
        })),
        subtotal: parseFloat(totals.subtotal),
        serviceCharge: parseFloat(totals.serviceCharge),
        serviceChargePercent: Number(taxSettings.serviceCharge) || 0,
        tax: parseFloat(totals.tax),
        taxPercent: Number(taxSettings.taxPercentage) || 0,
        discount: parseFloat(totals.discount),
        manualDiscount: parseFloat(totals.manualDiscount || 0),
        loyaltyDiscount: parseFloat(totals.loyaltyDiscount || 0),
        loyaltyPointsRedeemed: parseInt(totals.loyaltyPointsRedeemed || 0, 10),
        discountPercent: totals.discountPercent || 0,
        total: parseFloat(totals.total),
        paymentMethod: method,
        cashGiven: method === "CASH" ? cashAmount : 0,
        balance: method === "CASH" ? (cashAmount - parseFloat(totals.total)) : 0,
      };

      setReceiptData(receiptInfo);
      setShowReceipt(true);
      setMessage(`Order #${res.data.id} paid successfully!`);

      // Auto print with direct ESC/POS when configured, fallback to browser print.
      if (printerSettings.autoPrint) {
        setTimeout(async () => {
          const printed = await printReceipt(receiptInfo, { silent: true });
          if (!printed) {
            window.print();
          }
        }, 250);
      }
      
      setTimeout(() => {
        setCart([]);
        setTableNumber("");
        setCustomerName("");
        setCustomerPhone("");
        setCrmCustomerName("");
        clearSelectedCustomer();
        setCashGiven("");
        setShowPaymentModal(false);
        setMessage("");
        setShowReceipt(false);
        setReceiptData(null);
      }, 5000);
    } catch (err) {
      setMessage("Payment failed. Please try again.");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  // Quick cash buttons
  const quickCashAmounts = [500, 1000, 2000, 5000];
  const setQuickCash = (amount) => {
    setCashGiven(amount.toString());
  };

  const formatCurrency = (amount) => {
    return `Rs. ${parseFloat(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const printReceipt = useCallback(
    async (orderData, { silent = false } = {}) => {
      if (!orderData) return false;

      const printMode = String(printerSettings.printMode || "BROWSER_PRINT").toUpperCase();
      if (printMode === "ESC_POS_TCP") {
        const host = String(printerSettings.host || "").trim();
        if (!host) {
          if (!silent) {
            setMessage("Printer host/IP not configured. Falling back to browser print.");
            setTimeout(() => setMessage(""), 3500);
          }
          window.print();
          return true;
        }

        try {
          await api.post("/printing/escpos", {
            printer: {
              host,
              port: Number(printerSettings.port) || 9100,
              paperSize: printerSettings.paperSize || "80mm",
              charsPerLine: Number(printerSettings.charsPerLine) || 48,
              timeoutMs: Number(printerSettings.timeoutMs) || 4000,
            },
            receipt: {
              ...orderData,
              shop: loadShopInfoFromStorage(),
            },
          });
          if (!silent) {
            setMessage("Receipt sent to ESC/POS printer");
            setTimeout(() => setMessage(""), 2500);
          }
          return true;
        } catch (error) {
          console.error("ESC/POS print failed", error);
          if (!silent) {
            setMessage(
              error?.response?.data?.message ||
                "Direct print failed. Falling back to browser print."
            );
            setTimeout(() => setMessage(""), 4000);
          }
          window.print();
          return true;
        }
      }

      window.print();
      return true;
    },
    [printerSettings]
  );

  const balance = useMemo(() => {
    if (!cashGiven || paymentMethod !== "CASH") return 0;
    return parseFloat(cashGiven) - parseFloat(totals.total);
  }, [cashGiven, totals.total, paymentMethod]);

  return (
    <div className="cv-page cv-page--pos h-full min-h-full flex flex-col">
      {/* Header - Order Type Selector */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3 flex-wrap">
              <div className={`flex gap-2 w-full sm:flex-1 ${systemPrefs.touchMode ? "space-x-2" : ""}`}>
            {["DINE-IN", "TAKEAWAY", "DELIVERY"].map((type) => (
                <button
                key={type}
                onClick={() => setOrderType(type)}
                  className={`flex-1 sm:flex-none px-4 ${systemPrefs.touchMode ? "py-3" : "py-2"} rounded-lg font-semibold text-sm transition-all ${
                  orderType === type
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {type.replace("-", " ")}
              </button>
            ))}
          </div>
          {orderType === "DINE-IN" && (
            <input
              type="text"
              placeholder="Table #"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className="w-full sm:w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
          {orderType === "DELIVERY" && (
            <input
              type="text"
              placeholder="Customer Name"
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value);
                if (!selectedCustomer && !crmCustomerName) {
                  setCrmCustomerName(e.target.value);
                }
              }}
              className="w-full sm:w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col xl:flex-row overflow-hidden min-h-0">
        {/* Left Side - Product Selection */}
        <div className="flex-1 min-h-0 flex flex-col bg-white xl:border-r border-gray-200">
          {/* Category Bar - Enhanced */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-300 px-4 py-3 overflow-x-auto shadow-sm">
            <div className="flex gap-3 min-w-max">
              {categories.map((cat) => {
                const icon = CATEGORY_ICONS[cat] || "📦";
                const isActive = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`flex flex-col items-center justify-center gap-1.5 px-5 py-3 rounded-xl font-semibold whitespace-nowrap transition-all duration-200 min-w-[90px] ${
                      isActive
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/50 transform scale-105"
                        : "bg-white text-gray-700 hover:bg-blue-50 hover:border-blue-200 border-2 border-transparent"
                    }`}
                  >
                    <span className="text-3xl leading-none">{icon}</span>
                    <span className="text-sm leading-tight">{cat}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 ${systemPrefs.touchMode ? "gap-4" : ""}`}>
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className={`bg-white border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 hover:shadow-lg transition-all transform hover:scale-105 active:scale-95 ${
                    systemPrefs.touchMode ? "p-4" : "p-3"
                  }`}
                >
                  <div className="text-center mb-2">
                    <div className="mb-2 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-20 object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-20 flex items-center justify-center text-3xl">
                          {CATEGORY_ICONS[product.category] || "📦"}
                        </div>
                      )}
                    </div>
                    <div className="font-semibold text-sm text-gray-900 mb-1 line-clamp-2">
                      {product.name}
                    </div>
                    <div className="text-base font-bold text-blue-600">
                      {formatCurrency(product.price)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {filteredProducts.length === 0 && (
              <div className="text-center text-gray-400 py-12">
                <div className="text-lg mb-2">No products found</div>
                <div className="text-sm">Select a different category</div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side - Bill Panel */}
        <div className="w-full xl:w-[24rem] xl:min-w-[24rem] bg-white flex flex-col border-t xl:border-t-0 xl:border-l border-gray-200">
          {/* Bill Header */}
          <div className="bg-blue-600 text-white px-4 py-3 border-b border-blue-700">
            <div className="font-bold text-lg">Current Bill</div>
            {orderId && (
              <div className="text-sm opacity-90">Order #{orderId}</div>
            )}
          </div>

          {/* Bill Preview - Receipt Template */}
          <div className="flex-1 overflow-y-auto p-3 min-h-[220px] max-h-[42vh] xl:max-h-none" style={{ minHeight: 0 }}>
            {cart.length === 0 ? (
              <div className="text-center text-gray-400 py-12">
                <div className="text-2xl mb-2">🛒</div>
                <div>Cart is empty</div>
                <div className="text-sm mt-1">Tap products to add</div>
              </div>
            ) : (
              <div key={cart.length}>
                <ReceiptPreview
                  orderData={{
                    items: cart.map((item) => ({
                      name: item.name,
                      qty: item.qty,
                      price: item.price,
                    })),
                    subtotal: parseFloat(totals.subtotal),
                    serviceCharge: parseFloat(totals.serviceCharge),
                    serviceChargePercent: Number(taxSettings.serviceCharge) || 0,
                    tax: parseFloat(totals.tax),
                    taxPercent: Number(taxSettings.taxPercentage) || 0,
                    discount: parseFloat(totals.discount),
                    manualDiscount: parseFloat(totals.manualDiscount || 0),
                    loyaltyDiscount: parseFloat(totals.loyaltyDiscount || 0),
                    loyaltyPointsRedeemed: parseInt(totals.loyaltyPointsRedeemed || 0, 10),
                    discountPercent: totals.discountPercent || 0,
                    total: parseFloat(totals.total),
                    orderType: orderType,
                    tableNumber: orderType === "DINE-IN" ? tableNumber : "",
                    customerName: orderType === "DELIVERY" ? customerName : "",
                  }}
                />
              </div>
            )}
          </div>

          {/* Discount + Payment Buttons */}
          {cart.length > 0 && (
            <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-3">
              {/* Discount Controls */}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Discount Type
                  </label>
                  <select
                    value={discountType}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDiscountType(val);
                      if (val === "NONE") setDiscountValue("");
                    }}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="NONE">No Discount</option>
                    <option value="PERCENT">% Percentage</option>
                    <option value="AMOUNT">Rs. Amount</option>
                  </select>
                </div>
                {discountType !== "NONE" && (
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      {discountType === "PERCENT" ? "Discount (%)" : "Discount (Rs.)"}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={discountType === "PERCENT" ? "e.g. 10" : "e.g. 150"}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  onClick={() => processPayment("CASH")}
                  className="flex-1 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors shadow-md text-sm"
                >
                  💵 CASH
                </button>
                <button
                  onClick={() => processPayment("CARD")}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-md text-sm"
                >
                  💳 CARD
                </button>
                <button
                  onClick={() => processPayment("QR")}
                  className="flex-1 py-3 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition-colors shadow-md text-sm"
                >
                  📱 QR
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={holdOrder}
                  className="w-full py-2 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors shadow-md text-sm"
                >
                  HOLD ORDER
                </button>
                <button
                  onClick={() => setShowHeldOrdersModal(true)}
                  className="w-full py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-md text-sm"
                >
                  RECALL HELD
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Held Orders Modal */}
      {showHeldOrdersModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Held Orders</h2>
              <button
                type="button"
                onClick={() => setShowHeldOrdersModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                Ã—
              </button>
            </div>

            <div className="p-4 overflow-y-auto">
              {heldOrdersLoading ? (
                <div className="py-10 text-center text-gray-500">Loading held orders...</div>
              ) : heldOrders.length === 0 ? (
                <div className="py-10 text-center text-gray-500">No held orders found</div>
              ) : (
                <div className="space-y-3">
                  {heldOrders.map((held) => {
                    const createdAt = held.created_at
                      ? new Date(held.created_at).toLocaleString()
                      : "-";
                    const itemCount = Array.isArray(held.items) ? held.items.length : 0;
                    const recalling = heldActionBusyId === `recall-${held.id}`;
                    const deleting = heldActionBusyId === `delete-${held.id}`;
                    return (
                      <div
                        key={held.id}
                        className="border border-gray-200 rounded-lg p-3 bg-gray-50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-semibold text-gray-900">
                              Held #{held.id} â€¢ {held.order_type || "DINE-IN"}
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              {held.table_number ? `Table ${held.table_number} â€¢ ` : ""}
                              {held.customer_name ? `${held.customer_name} â€¢ ` : ""}
                              {itemCount} items â€¢ {createdAt}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Total approx: {formatCurrency(heldOrderTotal(held))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={Boolean(heldActionBusyId)}
                              onClick={() => recallHeldOrder(held.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                                recalling || Boolean(heldActionBusyId)
                                  ? "bg-blue-300 text-white cursor-not-allowed"
                                  : "bg-blue-600 text-white hover:bg-blue-700"
                              }`}
                            >
                              {recalling ? "Recalling..." : "Recall"}
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(heldActionBusyId)}
                              onClick={() => deleteHeldOrder(held.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                                deleting || Boolean(heldActionBusyId)
                                  ? "bg-red-300 text-white cursor-not-allowed"
                                  : "bg-red-600 text-white hover:bg-red-700"
                              }`}
                            >
                              {deleting ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-between">
              <button
                type="button"
                onClick={loadHeldOrders}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => setShowHeldOrdersModal(false)}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-semibold hover:bg-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Payment</h2>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  Ã—
                </button>
              </div>

              <div className="mb-6">
                <div className="text-center mb-4">
                  <div className="text-sm text-gray-600 mb-1">Total Amount</div>
                  <div className="text-4xl font-bold text-blue-600">
                    {formatCurrency(totals.total)}
                  </div>
                </div>

                <div className="mb-4 border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="text-sm font-semibold text-gray-800 mb-2">Customer (CRM)</div>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={customerPhone}
                      onChange={(e) => {
                        setCustomerPhone(e.target.value);
                        if (customerLookupStatus !== "idle") {
                          setCustomerLookupStatus("idle");
                          setCustomerLookupMessage("");
                        }
                      }}
                      placeholder="Phone number"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={lookupCustomerByPhone}
                      disabled={customerLookupStatus === "loading"}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                        customerLookupStatus === "loading"
                          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      Lookup
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={crmCustomerName}
                      onChange={(e) => setCrmCustomerName(e.target.value)}
                      placeholder="Customer name"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {customerLookupStatus === "not-found" && (
                      <button
                        type="button"
                        onClick={quickCreateCustomer}
                        className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700"
                      >
                        Create
                      </button>
                    )}
                    {selectedCustomer && (
                      <button
                        type="button"
                        onClick={clearSelectedCustomer}
                        className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-300"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {customerLookupMessage && (
                    <div
                      className={`text-xs mt-2 ${
                        customerLookupStatus === "error"
                          ? "text-red-600"
                          : customerLookupStatus === "found"
                          ? "text-emerald-700"
                          : "text-gray-600"
                      }`}
                    >
                      {customerLookupMessage}
                    </div>
                  )}

                  {selectedCustomer && (
                    <div className="mt-2 p-2 bg-white border border-emerald-200 rounded-lg">
                      <div className="text-sm font-semibold text-gray-900">{selectedCustomer.full_name}</div>
                      <div className="text-xs text-gray-600">
                        {selectedCustomer.phone} | {selectedCustomer.total_orders || 0} orders |{" "}
                        {selectedCustomer.loyalty_points || 0} pts
                      </div>
                      <div className="mt-2 pt-2 border-t border-emerald-100">
                        {loyaltyPreviewLoading ? (
                          <div className="text-xs text-gray-500">Loading loyalty options...</div>
                        ) : loyaltyPreview ? (
                          <>
                            <div className="text-xs text-gray-600 mb-1">
                              Redeem up to {loyaltyPreview.max_redeemable_points || 0} points
                              {" "}({formatCurrency(loyaltyPreview.max_discount || 0)})
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                min="0"
                                value={loyaltyPointsToRedeem}
                                onChange={(e) => setLoyaltyPointsToRedeem(e.target.value)}
                                placeholder={`Min ${loyaltyPreview.min_redeem_points || 0}`}
                                className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setLoyaltyPointsToRedeem(
                                    String(loyaltyPreview.max_redeemable_points || 0)
                                  )
                                }
                                className="px-2 py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-semibold hover:bg-gray-200"
                              >
                                Max
                              </button>
                            </div>
                            <div className="text-xs text-blue-700 mt-1">
                              Loyalty discount: {formatCurrency(totals.loyaltyDiscount || 0)}
                            </div>
                            <div className="text-xs text-gray-600">
                              Total before loyalty: {formatCurrency(totals.totalBeforeLoyalty || 0)}
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-gray-500">Loyalty redemption not available.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Payment Method Selection */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {["CASH", "CARD", "QR"].map((method) => (
                    <button
                      key={method}
                      onClick={() => {
                        setPaymentMethod(method);
                        if (method !== "CASH") setCashGiven("");
                      }}
                      className={`py-3 rounded-lg font-semibold transition-all ${
                        paymentMethod === method
                          ? "bg-blue-600 text-white shadow-md"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>

                {/* Cash Input */}
                {paymentMethod === "CASH" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cash Given
                      </label>
                      <input
                        type="number"
                        value={cashGiven}
                        onChange={(e) => setCashGiven(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    {/* Quick Cash Buttons */}
                    <div className="grid grid-cols-4 gap-2">
                      {quickCashAmounts.map((amount) => (
                        <button
                          key={amount}
                          onClick={() => setQuickCash(amount)}
                          className="py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-sm transition-colors"
                        >
                          {amount}
                        </button>
                      ))}
                    </div>

                    {cashGiven && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-gray-700">Balance</span>
                          <span
                            className={`text-xl font-bold ${
                              balance >= 0 ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {formatCurrency(Math.abs(balance))}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Confirm Button */}
              <button
                onClick={() => {
                  if (paymentMethod === "CASH" && cashGiven) {
                    executePayment("CASH", parseFloat(cashGiven));
                  } else if (paymentMethod !== "CASH") {
                    executePayment(paymentMethod, 0);
                  }
                }}
                disabled={paymentMethod === "CASH" && (!cashGiven || balance < 0)}
                className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${
                  paymentMethod === "CASH" && (!cashGiven || balance < 0)
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-green-600 text-white hover:bg-green-700 shadow-lg"
                }`}
              >
                CONFIRM PAYMENT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Display/Print */}
      {showReceipt && receiptData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-auto p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Receipt</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => printReceipt(receiptData)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Print
                  </button>
                  <button
                    onClick={() => {
                      setShowReceipt(false);
                      setReceiptData(null);
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="max-h-[80vh] overflow-auto">
                <Receipt orderData={receiptData} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success/Error Message */}
      {message && (
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-xl z-50">
          {message}
        </div>
      )}
    </div>
  );
}

