import React from "react";
import logo from "../assests/bill-logo.png";
import { formatBusinessDate, formatBusinessTime } from "../utils/timezone.js";

export default function Receipt({ orderData }) {
  if (!orderData) return null;

  const {
    billNo,
    invoiceNo,
    date,
    time,
    orderType,
    tableNumber,
    customerName,
    customerPhone,
    note,
    cashier,
    items = [],
    subtotal = 0,
    serviceCharge = 0,
    serviceChargePercent = 5,
    tax = 0,
    taxPercent = 2,
    discount = 0,
    manualDiscount = 0,
    loyaltyDiscount = 0,
    loyaltyPointsRedeemed = 0,
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
    if (!dateStr) return formatBusinessDate(new Date());
    return formatBusinessDate(dateStr);
  };

  const formatTime = (timeStr) => {
    if (!timeStr) {
      return formatBusinessTime(new Date(), { hour: "2-digit", minute: "2-digit" });
    }
    if (timeStr.includes(":")) return timeStr;
    return formatBusinessTime(`2000-01-01T${timeStr}`, {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Truncate item names for receipt (max 20 chars)
  const truncateName = (name, maxLength = 20) => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength - 3) + "...";
  };

  const resolvedInvoiceNumber =
    String(invoiceNo || "").trim() ||
    `VOXO${String(billNo || "0").replace(/[^\d]/g, "").padStart(6, "0").slice(-6)}`;

  // Load shop info saved from Settings (with safe defaults)
  let shop = {
    name: "Camellia Cafe & Restaurant",
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
    <div className="receipt-print-root" id="receipt-print">
      <style>{`
        @page {
          size: 80mm auto;
          margin: 0;
        }

        @media print {
          body {
            margin: 0;
            padding: 0;
          }
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

        .receipt-print-root {
          width: 80mm;
          max-width: 80mm;
          margin: 0 auto;
          background: white;
        }
        
        .receipt-container {
          width: 80mm;
          max-width: 80mm;
          margin: 0 auto;
          padding: 8px 8px 6px 8px;
          background: white;
          font-family: 'Courier New', monospace;
          font-size: 13px;
          line-height: 1.5;
          color: #000;
        }

        .receipt-container, .receipt-container * {
          font-weight: 700;
          color: #000;
        }
        
        .receipt-logo {
          text-align: center;
          margin-bottom: 6px;
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
        }
        
        .receipt-logo img {
          max-width: 150px;
          height: auto;
          margin-bottom: 2px;
          display: block;
          margin-left: auto;
          margin-right: auto;
        }
        
        .receipt-header {
          text-align: center;
          margin-bottom: 6px;
        }
        
        .receipt-header h1 {
          font-size: 20px;
          font-weight: bold;
          margin: 0 0 4px 0;
          letter-spacing: 1px;
        }
        
        .receipt-header p {
          font-size: 12px;
          margin: 2px 0;
          color: #000;
        }
        
        .receipt-divider {
          border-top: 1px dashed #000;
          margin: 6px 0;
        }
        
        .receipt-info {
          margin: 6px 0;
          font-size: 12px;
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
          margin: 8px 0;
        }
        
        .receipt-items-header {
          display: flex;
          justify-content: space-between;
          font-weight: bold;
          margin-bottom: 6px;
          padding-bottom: 4px;
          border-bottom: 1px solid #000;
          font-size: 12px;
        }
        
        .receipt-item {
          display: flex;
          justify-content: space-between;
          margin: 6px 0;
          font-size: 12px;
        }
        
        .receipt-item-name {
          flex: 1;
          margin-right: 8px;
        }
        
        .receipt-item-qty {
          text-align: center;
          width: 34px;
          margin-right: 8px;
        }
        
        .receipt-item-price {
          text-align: right;
          width: 78px;
          font-weight: bold;
        }
        
        .receipt-totals {
          margin: 8px 0;
          font-size: 12px;
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
          margin: 8px 0;
          font-size: 16px;
          font-weight: bold;
        }
        
        .receipt-payment {
          margin: 8px 0;
          font-size: 12px;
        }
        
        .receipt-footer {
          text-align: center;
          margin-top: 14px;
          padding-top: 8px;
          border-top: 1px dashed #000;
          font-size: 11px;
          color: #000;
          line-height: 1.4;
        }
        
        .receipt-footer-title {
          font-size: 12px;
          letter-spacing: 0.4px;
          margin-bottom: 2px;
        }

        .receipt-footer-domain {
          font-size: 12px;
          margin-bottom: 2px;
        }

        .receipt-footer-copy {
          margin-bottom: 4px;
          font-size: 11.5px;
        }

        .receipt-footer-services {
          margin: 2px 0;
          font-size: 11px;
        }

        .receipt-footer-contact-title {
          margin-top: 5px;
          margin-bottom: 2px;
          font-size: 11.5px;
        }

        .receipt-footer-thanks {
          margin-top: 5px;
          font-size: 12px;
        }
      `}</style>

      <div className="receipt-container">
        {/* Logo Section */}
        <div className="receipt-logo">
          <img src={logo} alt="Camellia Logo" />
        </div>

        {/* Header */}
        <div className="receipt-header">
          <h1>{shop.name || "Camellia Cafe & Restaurant"}</h1>
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
            <span className="receipt-info-label">Invoice No</span>
            <span>: {resolvedInvoiceNumber}</span>
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
          {customerName && (
            <div className="receipt-info-row">
              <span className="receipt-info-label">Customer</span>
              <span>: {customerName}</span>
            </div>
          )}
          {customerPhone && (
            <div className="receipt-info-row">
              <span className="receipt-info-label">Mobile</span>
              <span>: {customerPhone}</span>
            </div>
          )}
          {note && (
            <div className="receipt-info-row">
              <span className="receipt-info-label">Note</span>
              <span>: {note}</span>
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
            <span style={{ width: 34, textAlign: "center" }}>Qty</span>
            <span style={{ width: 78, textAlign: "right" }}>Amount</span>
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
          {manualDiscount > 0 && (
            <div className="receipt-total-row">
              <span className="receipt-total-label">
                Manual Discount{discountPercent > 0 ? ` (${discountPercent}%)` : ""}
              </span>
              <span className="receipt-total-amount">- {formatCurrency(manualDiscount)}</span>
            </div>
          )}
          {loyaltyDiscount > 0 && (
            <div className="receipt-total-row">
              <span className="receipt-total-label">
                Loyalty Redeem{loyaltyPointsRedeemed > 0 ? ` (${loyaltyPointsRedeemed} pts)` : ""}
              </span>
              <span className="receipt-total-amount">- {formatCurrency(loyaltyDiscount)}</span>
            </div>
          )}
          {discount > 0 && manualDiscount <= 0 && loyaltyDiscount <= 0 && (
            <div className="receipt-total-row">
              <span className="receipt-total-label">Discount</span>
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
          <div className="receipt-footer-title">System Design & Powered By</div>
          <div className="receipt-footer-domain">VOXOsolutions.com</div>
          <div className="receipt-footer-copy">(c) 2026 All rights reserved.</div>
          <div className="receipt-footer-services">ERP / POS / WEBSITE / SOFTWARE SOLUTIONS</div>
          <div className="receipt-footer-services">AI-ML Solutions / IoT Solutions</div>
          <div className="receipt-footer-contact-title">PLEASE contact WhatsApp or Call</div>
          <div>0710901871</div>
          <div>voxosolution@gmail.com</div>
          <div className="receipt-footer-thanks">Thank you for visiting!</div>
          <div className="receipt-footer-thanks">Thank you for visiting!</div>
          <div className="receipt-footer-thanks">Thank you for visiting!</div>
        </div>
      </div>
    </div>
  );
}


