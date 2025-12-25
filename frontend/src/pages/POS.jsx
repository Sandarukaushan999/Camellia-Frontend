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
  Rice: "🍚",
  Pizza: "🍕",
};

// Default categories to always show
const DEFAULT_CATEGORIES = [
  "ALL",
  "Burger",
  "Kottu",
  "Submarine",
  "Café",
  "Rice",
  "Pizza",
];

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
  const [message, setMessage] = useState("");
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [showBillPanel, setShowBillPanel] = useState(false);
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

  const loadProducts = useCallback(async () => {
    try {
      const res = await api.get("/admin/products/pos");
      setProducts(res.data);
    } catch (err) {
      console.error("Failed to load products", err);
      setProducts([]);
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

  // Only show these specific categories - no dynamic categories from products
  const categories = useMemo(() => {
    return DEFAULT_CATEGORIES;
  }, []);

  // Filter products by category - only show products in allowed categories
  const allowedCategories = ["Burger", "Kottu", "Submarine", "Café", "Rice", "Pizza"];
  const filteredProducts = useMemo(() => {
    // First, filter to only show products in allowed categories
    const allowedProducts = products.filter(
      (p) => p.category && allowedCategories.includes(p.category)
    );
    
    if (selectedCategory === "ALL") {
      return allowedProducts;
    }
    return allowedProducts.filter((p) => p.category === selectedCategory);
  }, [products, selectedCategory]);

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

    // Discount
    let discountAmount = 0;
    const valueNum = parseFloat(discountValue) || 0;
    if (discountType === "PERCENT" && valueNum > 0) {
      discountAmount = beforeDiscount * (valueNum / 100);
    } else if (discountType === "AMOUNT" && valueNum > 0) {
      discountAmount = valueNum;
    }
    // Do not allow discount to exceed total before discount
    if (discountAmount > beforeDiscount) {
      discountAmount = beforeDiscount;
    }

    let total = beforeDiscount - discountAmount;
    if (taxSettings.roundTotal) {
      total = Math.round(total);
    }

    return {
      subtotal: subtotal.toFixed(2),
      serviceCharge: serviceCharge.toFixed(2),
      tax: tax.toFixed(2),
      discount: discountAmount.toFixed(2),
      // keep percent value for receipt (only meaningful when type is PERCENT)
      discountPercent: discountType === "PERCENT" ? valueNum : 0,
      total: total.toFixed(2),
    };
  }, [cart, taxSettings, discountType, discountValue]);

  // Generate order ID
  const generateOrderId = () => {
    return Math.floor(1000 + Math.random() * 9000);
  };

  // Hold order
  const holdOrder = () => {
    if (cart.length === 0) {
      setMessage("Cart is empty");
      setTimeout(() => setMessage(""), 2000);
      return;
    }
    // In a real system, save to localStorage or backend
    const heldOrder = {
      id: generateOrderId(),
      orderType,
      tableNumber,
      items: cart,
      totals,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(`held_order_${heldOrder.id}`, JSON.stringify(heldOrder));
    setMessage(`Order #${heldOrder.id} held`);
    setTimeout(() => {
      setMessage("");
      setCart([]);
      setTableNumber("");
    }, 2000);
  };

  // Open payment modal
  const handlePay = () => {
    if (cart.length === 0) {
      setMessage("Cart is empty");
      setTimeout(() => setMessage(""), 2000);
      return;
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

    // For CASH, show quick cash input modal
    if (method === "CASH") {
      setPaymentMethod("CASH");
      setShowPaymentModal(true);
      return;
    }

    // For CARD and QR, process directly
    await executePayment(method, 0);
  };

  // Execute payment
  const executePayment = async (method, cashAmount = 0) => {

    try {
      const payload = {
        total: totals.total,
        payment_method: method,
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
        customerName: orderType === "DELIVERY" ? (customerName || tableNumber || null) : null,
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
        discountPercent: totals.discountPercent || 0,
        total: parseFloat(totals.total),
        paymentMethod: method,
        cashGiven: method === "CASH" ? cashAmount : 0,
        balance: method === "CASH" ? (cashAmount - parseFloat(totals.total)) : 0,
      };

      setReceiptData(receiptInfo);
      setShowReceipt(true);
      setMessage(`Order #${res.data.id} paid successfully!`);
      
      // Auto print if enabled (can be controlled by settings)
      setTimeout(() => {
        window.print();
      }, 500);
      
      setTimeout(() => {
        setCart([]);
        setTableNumber("");
        setCustomerName("");
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

  const balance = useMemo(() => {
    if (!cashGiven || paymentMethod !== "CASH") return 0;
    return parseFloat(cashGiven) - parseFloat(totals.total);
  }, [cashGiven, totals.total, paymentMethod]);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header - Order Type Selector */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className={`flex gap-2 flex-1 ${systemPrefs.touchMode ? "space-x-2" : ""}`}>
            {["DINE-IN", "TAKEAWAY", "DELIVERY"].map((type) => (
                <button
                key={type}
                onClick={() => setOrderType(type)}
                  className={`px-3 lg:px-4 ${systemPrefs.touchMode ? "py-3" : "py-2"} rounded-lg font-semibold text-sm transition-all ${
                  orderType === type
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {type.replace("-", " ")}
              </button>
            ))}
          </div>
          
          {/* Mobile Bill Panel Toggle */}
          <button
            onClick={() => setShowBillPanel(true)}
            className="lg:hidden ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold shadow-md hover:bg-blue-700 transition-colors"
          >
            View Bill ({cart.length})
          </button>
          
          <div className="flex items-center gap-3 ml-4">
            {orderType === "DINE-IN" && (
              <input
                type="text"
                placeholder="Table #"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className="w-20 lg:w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
            {orderType === "DELIVERY" && (
              <input
                type="text"
                placeholder="Customer Name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-28 lg:w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side - Product Selection */}
        <div className="flex-1 flex flex-col bg-white lg:border-r border-gray-200">
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
                    className={`flex flex-col items-center justify-center gap-1.5 px-3 lg:px-5 py-2 lg:py-3 rounded-xl font-semibold whitespace-nowrap transition-all duration-200 min-w-[80px] lg:min-w-[90px] ${
                      isActive
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/50 transform scale-105"
                        : "bg-white text-gray-700 hover:bg-blue-50 hover:border-blue-200 border-2 border-transparent"
                    }`}
                  >
                    <span className="text-2xl lg:text-3xl leading-none">{icon}</span>
                    <span className="text-xs lg:text-sm leading-tight">{cat}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 lg:gap-3 ${systemPrefs.touchMode ? "gap-4" : ""}`}>
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className={`bg-white border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 hover:shadow-lg transition-all transform hover:scale-105 active:scale-95 ${
                    systemPrefs.touchMode ? "p-3 lg:p-4" : "p-2 lg:p-3"
                  }`}
                >
                  <div className="text-center mb-2">
                    <div className="text-2xl lg:text-3xl mb-2">
                      {CATEGORY_ICONS[product.category] || "📦"}
                    </div>
                    <div className="font-semibold text-xs lg:text-sm text-gray-900 mb-1 line-clamp-2">
                      {product.name}
                    </div>
                    <div className="text-sm lg:text-base font-bold text-blue-600">
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
        <div className={`w-full lg:w-96 bg-white flex flex-col lg:border-l border-gray-200 ${
          showBillPanel ? 'fixed inset-0 z-50 lg:static lg:z-auto' : 'hidden lg:flex'
        }`}>
          {/* Mobile Backdrop */}
          {showBillPanel && (
            <div 
              className="lg:hidden fixed inset-0 bg-black bg-opacity-50 -z-10"
              onClick={() => setShowBillPanel(false)}
            />
          )}
          
          {/* Bill Header */}
          <div className="bg-blue-600 text-white px-4 py-3 border-b border-blue-700">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-bold text-lg">Current Bill</div>
                {orderId && (
                  <div className="text-sm opacity-90">Order #{orderId}</div>
                )}
              </div>
              {/* Mobile Close Button */}
              <button
                onClick={() => setShowBillPanel(false)}
                className="lg:hidden p-2 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Bill Preview - Receipt Template */}
          <div className="flex-1 overflow-y-auto p-3" style={{ minHeight: 0 }}>
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

              <div className="flex gap-2 pt-1">
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
              <button
                onClick={holdOrder}
                className="w-full py-2 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors shadow-md text-sm"
              >
                HOLD ORDER
              </button>
            </div>
          )}
        </div>
      </div>

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
                  ×
                </button>
              </div>

              <div className="mb-6">
                <div className="text-center mb-4">
                  <div className="text-sm text-gray-600 mb-1">Total Amount</div>
                  <div className="text-4xl font-bold text-blue-600">
                    {formatCurrency(totals.total)}
                  </div>
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
                    onClick={() => window.print()}
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
