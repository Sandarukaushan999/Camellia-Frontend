import React from "react";
import logo from "../assests/Clogo.jpeg";

export default function Receipt({ orderData }) {
  if (!orderData) return null;

  const {
    billNo,
    date,
    time,
    orderType,
    tableNumber,
    customerName,
    cashier,
    items = [],
    subtotal = 0,
    serviceCharge = 0,
    serviceChargePercent = 5,
    tax = 0,
    taxPercent = 2,
    discount = 0,
    discountPercent = 0,
    total = 0,
    paymentMethod = "CASH",
    cashGiven = 0,
    balance = 0,
  } = orderData;

  const formatCurrency = (amount) => {
    return parseFloat(amount || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return new Date().toLocaleDateString("en-US");
    return new Date(dateStr).toLocaleDateString("en-US");
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    if (timeStr.includes(":")) return timeStr;
    return new Date(`2000-01-01T${timeStr}`).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  // Truncate item names for receipt (max 20 chars)
  const truncateName = (name, maxLength = 20) => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength - 3) + "...";
  };

  // Load shop info saved from Settings (with safe defaults)
  let shop = {
    name: "Camellia Café & Restaurant",
    address: "",
    phone: "",
    email: "",
  };
  try {
    const saved = localStorage.getItem("cv_shop_info");
    if (saved) {
      shop = { ...shop, ...JSON.parse(saved) };
    }
  } catch {
    // ignore
  }

  return (
    <div className="receipt-container" id="receipt-print">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #receipt-print, #receipt-print * {
            visibility: visible;
          }
          #receipt-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            max-width: 80mm;
          }
        }
        
        .receipt-container {
          width: 80mm;
          max-width: 80mm;
          margin: 0 auto;
          padding: 20px 10px 10px 10px;
          background: white;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          line-height: 1.4;
          color: #000;
        }
        
        .receipt-logo {
          text-align: center;
          margin-bottom: 15px;
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
        }
        
        .receipt-logo img {
          max-width: 120px;
          height: auto;
          margin-bottom: 8px;
          display: block;
          margin-left: auto;
          margin-right: auto;
        }
        
        .receipt-header {
          text-align: center;
          margin-bottom: 12px;
        }
        
        .receipt-header h1 {
          font-size: 18px;
          font-weight: bold;
          margin: 0 0 4px 0;
          letter-spacing: 1px;
        }
        
        .receipt-header p {
          font-size: 11px;
          margin: 2px 0;
          color: #333;
        }
        
        .receipt-divider {
          border-top: 1px dashed #000;
          margin: 10px 0;
        }
        
        .receipt-info {
          margin: 10px 0;
          font-size: 11px;
        }
        
        .receipt-info-row {
          display: flex;
          justify-content: space-between;
          margin: 3px 0;
        }
        
        .receipt-info-label {
          font-weight: bold;
        }
        
        .receipt-items {
          margin: 12px 0;
        }
        
        .receipt-items-header {
          display: flex;
          justify-content: space-between;
          font-weight: bold;
          margin-bottom: 6px;
          padding-bottom: 4px;
          border-bottom: 1px solid #000;
          font-size: 11px;
        }
        
        .receipt-item {
          display: flex;
          justify-content: space-between;
          margin: 6px 0;
          font-size: 11px;
        }
        
        .receipt-item-name {
          flex: 1;
          margin-right: 8px;
        }
        
        .receipt-item-qty {
          text-align: center;
          width: 30px;
          margin-right: 8px;
        }
        
        .receipt-item-price {
          text-align: right;
          width: 70px;
          font-weight: bold;
        }
        
        .receipt-totals {
          margin: 12px 0;
          font-size: 11px;
        }
        
        .receipt-total-row {
          display: flex;
          justify-content: space-between;
          margin: 4px 0;
        }
        
        .receipt-total-label {
          font-weight: bold;
        }
        
        .receipt-total-amount {
          font-weight: bold;
          text-align: right;
        }
        
        .receipt-grand-total {
          border-top: 2px solid #000;
          border-bottom: 2px solid #000;
          padding: 8px 0;
          margin: 10px 0;
          font-size: 14px;
          font-weight: bold;
        }
        
        .receipt-payment {
          margin: 12px 0;
          font-size: 11px;
        }
        
        .receipt-footer {
          text-align: center;
          margin-top: 20px;
          padding-top: 15px;
          border-top: 1px dashed #000;
          font-size: 9px;
          color: #555;
          line-height: 1.6;
        }
        
        .receipt-footer-copyright {
          font-weight: bold;
          margin-top: 8px;
        }
      `}</style>

      <div className="receipt-container">
        {/* Logo Section */}
        <div className="receipt-logo">
          <img src={logo} alt="Camellia Logo" />
        </div>

        {/* Header */}
        <div className="receipt-header">
          <h1>{shop.name || "Camellia Café & Restaurant"}</h1>
          {shop.address && <p>{shop.address}</p>}
          {(shop.phone || shop.email) && (
            <p>
              {shop.phone && `Tel: ${shop.phone}`}
              {shop.phone && shop.email && " | "}
              {shop.email && shop.email}
            </p>
          )}
        </div>

        <div className="receipt-divider"></div>

        {/* Bill Information */}
        <div className="receipt-info">
          <div className="receipt-info-row">
            <span className="receipt-info-label">Bill No</span>
            <span>: CM-{String(billNo || "0000000").padStart(7, "0")}</span>
          </div>
          <div className="receipt-info-row">
            <span className="receipt-info-label">Date</span>
            <span>: {formatDate(date)}</span>
          </div>
          <div className="receipt-info-row">
            <span className="receipt-info-label">Time</span>
            <span>: {formatTime(time)}</span>
          </div>
          <div className="receipt-info-row">
            <span className="receipt-info-label">Order Type</span>
            <span>: {orderType || "DINE-IN"}</span>
          </div>
          {(orderType === "DINE-IN" && tableNumber) && (
            <div className="receipt-info-row">
              <span className="receipt-info-label">Table / Room</span>
              <span>: {tableNumber}</span>
            </div>
          )}
          {(orderType === "DELIVERY" && customerName) && (
            <div className="receipt-info-row">
              <span className="receipt-info-label">Customer</span>
              <span>: {customerName}</span>
            </div>
          )}
          <div className="receipt-info-row">
            <span className="receipt-info-label">Cashier</span>
            <span>: {cashier || "System"}</span>
          </div>
        </div>

        <div className="receipt-divider"></div>

        {/* Items */}
        <div className="receipt-items">
          <div className="receipt-items-header">
            <span style={{ flex: 1 }}>Item</span>
            <span style={{ width: 30, textAlign: "center" }}>Qty</span>
            <span style={{ width: 70, textAlign: "right" }}>Amount</span>
          </div>
          {items.map((item, idx) => {
            const itemTotal = parseFloat(item.price || 0) * (item.qty || 0);
            return (
              <div key={idx} className="receipt-item">
                <span className="receipt-item-name">{truncateName(item.name || "Item")}</span>
                <span className="receipt-item-qty">{item.qty || 0}</span>
                <span className="receipt-item-price">{formatCurrency(itemTotal)}</span>
              </div>
            );
          })}
        </div>

        <div className="receipt-divider"></div>

        {/* Totals */}
        <div className="receipt-totals">
          <div className="receipt-total-row">
            <span className="receipt-total-label">Subtotal</span>
            <span className="receipt-total-amount">{formatCurrency(subtotal)}</span>
          </div>
          {serviceCharge > 0 && (
            <div className="receipt-total-row">
              <span className="receipt-total-label">Service Charge ({serviceChargePercent}%)</span>
              <span className="receipt-total-amount">{formatCurrency(serviceCharge)}</span>
            </div>
          )}
          {tax > 0 && (
            <div className="receipt-total-row">
              <span className="receipt-total-label">Tax ({taxPercent}%)</span>
              <span className="receipt-total-amount">{formatCurrency(tax)}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="receipt-total-row">
              <span className="receipt-total-label">
                Discount{discountPercent > 0 ? ` (${discountPercent}%)` : ""}
              </span>
              <span className="receipt-total-amount">- {formatCurrency(discount)}</span>
            </div>
          )}
        </div>

        <div className="receipt-grand-total">
          <div className="receipt-total-row">
            <span>TOTAL (LKR)</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="receipt-divider"></div>

        {/* Payment Information */}
        <div className="receipt-payment">
          <div className="receipt-info-row">
            <span className="receipt-info-label">Payment Method</span>
            <span>: {paymentMethod || "CASH"}</span>
          </div>
          {paymentMethod === "CASH" && cashGiven > 0 && (
            <>
              <div className="receipt-info-row">
                <span className="receipt-info-label">Cash Given</span>
                <span>: {formatCurrency(cashGiven)}</span>
              </div>
              <div className="receipt-info-row">
                <span className="receipt-info-label">Balance</span>
                <span>: {formatCurrency(balance)}</span>
              </div>
            </>
          )}
        </div>

        <div className="receipt-divider"></div>

        {/* Footer */}
        <div className="receipt-footer">
          <div>© 2025 VOXOsolution</div>
          <div>voxosolution@gmail.com</div>
          <div>071 090 1871</div>
        </div>

        <div style={{ textAlign: "center", marginTop: "10px", fontSize: "10px", color: "#999" }}>
          Thank you for visiting!
        </div>
      </div>
    </div>
  );
}


