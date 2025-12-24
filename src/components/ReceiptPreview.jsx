import React from "react";
import logo from "../assests/Clogo.jpeg";

export default function ReceiptPreview({ orderData }) {
  if (!orderData) {
    return null;
  }
  
  const {
    items = [],
    subtotal = 0,
    serviceCharge = 0,
    serviceChargePercent = 5,
    tax = 0,
    taxPercent = 2,
    discount = 0,
    discountPercent = 0,
    total = 0,
    orderType = "DINE-IN",
    tableNumber = "",
    customerName = "",
  } = orderData;

  // Load shop info saved from Settings (with safe defaults)
  let shop = {
    name: "Camellia Café & Restaurant",
  };
  try {
    const saved = localStorage.getItem("cv_shop_info");
    if (saved) {
      shop = { ...shop, ...JSON.parse(saved) };
    }
  } catch {
    // ignore
  }

  // If no items, show empty state
  if (!items || items.length === 0) {
    return (
      <div className="text-center text-gray-400 py-8">
        <div className="text-xl mb-2">🛒</div>
        <div className="text-sm">No items in cart</div>
      </div>
    );
  }

  const formatCurrency = (amount) => {
    return parseFloat(amount || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const truncateName = (name, maxLength = 18) => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength - 3) + "...";
  };

  return (
    <>
      <style>{`
        .receipt-preview-wrapper {
          font-family: 'Courier New', monospace;
          font-size: 11px;
          line-height: 1.4;
          color: #000;
          background: white;
          padding: 12px;
          border-radius: 8px;
          width: 100%;
          box-sizing: border-box;
          overflow: visible;
        }
        
        .receipt-preview-logo {
          text-align: center;
          margin-bottom: 8px;
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
        }
        
        .receipt-preview-logo img {
          max-width: 80px;
          height: auto;
          margin-bottom: 4px;
          display: block;
          margin-left: auto;
          margin-right: auto;
        }
        
        .receipt-preview-header {
          text-align: center;
          margin-bottom: 8px;
        }
        
        .receipt-preview-header h2 {
          font-size: 14px;
          font-weight: bold;
          margin: 0 0 2px 0;
          letter-spacing: 0.5px;
        }
        
        .receipt-preview-header p {
          font-size: 9px;
          margin: 1px 0;
          color: #333;
        }
        
        .receipt-preview-divider {
          border-top: 1px dashed #666;
          margin: 6px 0;
        }
        
        .receipt-preview-info {
          margin: 6px 0;
          font-size: 9px;
        }
        
        .receipt-preview-info-row {
          display: flex;
          justify-content: space-between;
          margin: 2px 0;
        }
        
        .receipt-preview-items {
          margin: 8px 0;
        }
        
        .receipt-preview-items-header {
          display: flex;
          justify-content: space-between;
          font-weight: bold;
          margin-bottom: 4px;
          padding-bottom: 2px;
          border-bottom: 1px solid #000;
          font-size: 9px;
        }
        
        .receipt-preview-item {
          display: flex;
          justify-content: space-between;
          margin: 3px 0;
          font-size: 9px;
        }
        
        .receipt-preview-item-name {
          flex: 1;
          margin-right: 6px;
        }
        
        .receipt-preview-item-qty {
          text-align: center;
          width: 25px;
          margin-right: 6px;
        }
        
        .receipt-preview-item-price {
          text-align: right;
          width: 60px;
          font-weight: bold;
        }
        
        .receipt-preview-totals {
          margin: 8px 0;
          font-size: 9px;
        }
        
        .receipt-preview-total-row {
          display: flex;
          justify-content: space-between;
          margin: 2px 0;
        }
        
        .receipt-preview-grand-total {
          border-top: 2px solid #000;
          border-bottom: 2px solid #000;
          padding: 6px 0;
          margin: 8px 0;
          font-size: 12px;
          font-weight: bold;
        }
        
        .receipt-preview-footer {
          margin-top: 10px;
          padding-top: 8px;
          border-top: 1px dashed #666;
          text-align: center;
          font-size: 8px;
          color: #555;
          line-height: 1.5;
        }
      `}</style>

      <div className="receipt-preview-wrapper">
        {/* Logo */}
        <div className="receipt-preview-logo">
          <img src={logo} alt="Camellia Logo" />
        </div>

        {/* Header */}
        <div className="receipt-preview-header">
          <h2>{shop.name || "Camellia Café & Restaurant"}</h2>
        </div>

        <div className="receipt-preview-divider"></div>

        {/* Order Info */}
        <div className="receipt-preview-info">
          <div className="receipt-preview-info-row">
            <span>Order Type</span>
            <span>: {orderType}</span>
          </div>
          {orderType === "DINE-IN" && tableNumber && (
            <div className="receipt-preview-info-row">
              <span>Table</span>
              <span>: {tableNumber}</span>
            </div>
          )}
          {orderType === "DELIVERY" && customerName && (
            <div className="receipt-preview-info-row">
              <span>Customer</span>
              <span>: {customerName}</span>
            </div>
          )}
        </div>

        <div className="receipt-preview-divider"></div>

        {/* Items */}
        <div className="receipt-preview-items">
          <div className="receipt-preview-items-header">
            <span style={{ flex: 1 }}>Item</span>
            <span style={{ width: 25, textAlign: "center" }}>Qty</span>
            <span style={{ width: 60, textAlign: "right" }}>Amount</span>
          </div>
          {items.map((item, idx) => {
            const itemTotal = parseFloat(item.price || 0) * (item.qty || 0);
            return (
              <div key={idx} className="receipt-preview-item">
                <span className="receipt-preview-item-name">{truncateName(item.name || "Item")}</span>
                <span className="receipt-preview-item-qty">{item.qty || 0}</span>
                <span className="receipt-preview-item-price">{formatCurrency(itemTotal)}</span>
              </div>
            );
          })}
        </div>

        <div className="receipt-preview-divider"></div>

        {/* Totals */}
        <div className="receipt-preview-totals">
          <div className="receipt-preview-total-row">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {serviceCharge > 0 && (
            <div className="receipt-preview-total-row">
              <span>Service ({serviceChargePercent}%)</span>
              <span>{formatCurrency(serviceCharge)}</span>
            </div>
          )}
          {tax > 0 && (
            <div className="receipt-preview-total-row">
              <span>Tax ({taxPercent}%)</span>
              <span>{formatCurrency(tax)}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="receipt-preview-total-row">
              <span>
                Discount{discountPercent > 0 ? ` (${discountPercent}%)` : ""}
              </span>
              <span>- {formatCurrency(discount)}</span>
            </div>
          )}
        </div>

        <div className="receipt-preview-grand-total">
          <div className="receipt-preview-total-row">
            <span>TOTAL (LKR)</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="receipt-preview-divider"></div>

        {/* Footer */}
        <div className="receipt-preview-footer">
          <div>© 2025 VOXOsolution</div>
          <div>voxosolution@gmail.com</div>
          <div>071 090 1871</div>
        </div>
      </div>
    </>
  );
}

