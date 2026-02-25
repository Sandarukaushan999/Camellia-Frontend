import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api.js";
import { getActiveBranchId, onActiveBranchChange } from "../utils/branchContext.js";
import { formatBusinessDateTime } from "../utils/timezone.js";
import { useAuth } from "../state/AuthContext.jsx";

function toMoney(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function toDateTime(value) {
  if (!value) {
    return "-";
  }
  return formatBusinessDateTime(value, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toInvoiceNumber(order) {
  const explicit = String(order?.invoice_number || "").trim();
  if (explicit) {
    return explicit;
  }
  const id = Number.parseInt(order?.id, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return "VOXO000000";
  }
  return `VOXO${String(id).padStart(6, "0")}`;
}

function safeItems(order) {
  if (!Array.isArray(order?.items)) {
    return [];
  }
  return order.items;
}

function orderTotal(order) {
  return safeItems(order).reduce((sum, item) => {
    const qty = Number(item?.qty || 0);
    const price = Number(item?.price || 0);
    return sum + qty * price;
  }, 0);
}

export default function Orders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeBranchId, setActiveBranchId] = useState(() => getActiveBranchId(null));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [qrOrders, setQrOrders] = useState([]);
  const [settleBusyId, setSettleBusyId] = useState(null);
  const [crmRequests, setCrmRequests] = useState([]);
  const [crmLoading, setCrmLoading] = useState(false);
  const [crmActionBusyId, setCrmActionBusyId] = useState(null);
  const isAdmin = String(user?.role || "").toUpperCase() === "ADMIN";

  useEffect(() => onActiveBranchChange((nextBranchId) => setActiveBranchId(nextBranchId)), []);

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 260);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const loadQrOrders = async () => {
    setLoading(true);
    setMessage("");
    try {
      const params = {
        limit: 300,
        branch_id: activeBranchId || undefined,
      };
      const { data } = await api.get("/orders/held", { params });
      const heldRows = Array.isArray(data) ? data : [];
      const qrRows = heldRows.filter(
        (row) => String(row?.source || row?.meta?.source || "").toUpperCase() === "QR_MENU"
      );
      setQrOrders(qrRows);
    } catch (err) {
      console.error("Failed to load QR orders:", err);
      setQrOrders([]);
      setMessage(err?.response?.data?.message || "Failed to load QR orders");
    } finally {
      setLoading(false);
    }
  };

  const loadCrmRequests = async () => {
    if (!isAdmin) {
      setCrmRequests([]);
      return;
    }
    setCrmLoading(true);
    try {
      const params = {
        status: "PENDING",
        limit: 150,
        branch_id: activeBranchId || undefined,
      };
      const { data } = await api.get("/admin/qr-customer-requests", { params });
      setCrmRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load CRM requests:", err);
      setCrmRequests([]);
      setMessage(err?.response?.data?.message || "Failed to load CRM request queue");
    } finally {
      setCrmLoading(false);
    }
  };

  useEffect(() => {
    loadQrOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBranchId]);

  useEffect(() => {
    loadCrmRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBranchId, isAdmin]);

  const settleOrderToPOS = async (orderId) => {
    const parsedId = Number.parseInt(orderId, 10);
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      setMessage("Invalid order id");
      return;
    }
    setSettleBusyId(parsedId);
    try {
      const { data } = await api.post(`/orders/held/${parsedId}/recall`);
      const heldOrder = data?.held_order;
      const heldItems = Array.isArray(heldOrder?.items) ? heldOrder.items : [];
      if (heldItems.length === 0) {
        setMessage("Selected order has no items");
        return;
      }
      sessionStorage.setItem("cv_pos_recall_held_order", JSON.stringify(heldOrder));
      setMessage(`Order ${toInvoiceNumber(heldOrder)} sent to POS for settlement`);
      await loadQrOrders();
      navigate("/pos");
    } catch (err) {
      setMessage(err?.response?.data?.message || "Failed to settle order");
    } finally {
      setSettleBusyId(null);
    }
  };

  const approveCrmRequest = async (requestId) => {
    const parsedId = Number.parseInt(requestId, 10);
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      setMessage("Invalid request id");
      return;
    }
    setCrmActionBusyId(`approve-${parsedId}`);
    try {
      await api.post(`/admin/qr-customer-requests/${parsedId}/approve`);
      setMessage(`CRM request #${parsedId} approved`);
      await Promise.all([loadCrmRequests(), loadQrOrders()]);
    } catch (err) {
      setMessage(err?.response?.data?.message || "Failed to approve CRM request");
    } finally {
      setCrmActionBusyId(null);
    }
  };

  const rejectCrmRequest = async (requestId) => {
    const parsedId = Number.parseInt(requestId, 10);
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      setMessage("Invalid request id");
      return;
    }
    const reason = window.prompt("Enter rejection reason");
    if (!reason || !String(reason).trim()) {
      return;
    }
    setCrmActionBusyId(`reject-${parsedId}`);
    try {
      await api.post(`/admin/qr-customer-requests/${parsedId}/reject`, {
        review_note: String(reason).trim(),
      });
      setMessage(`CRM request #${parsedId} rejected`);
      await Promise.all([loadCrmRequests(), loadQrOrders()]);
    } catch (err) {
      setMessage(err?.response?.data?.message || "Failed to reject CRM request");
    } finally {
      setCrmActionBusyId(null);
    }
  };

  const filteredOrders = useMemo(() => {
    if (!search) {
      return qrOrders;
    }
    return qrOrders.filter((order) => {
      const terms = [
        toInvoiceNumber(order),
        order.customer_name || "",
        order.customer_phone || "",
        order.table_number || "",
        order.note || order?.meta?.note || "",
        order.payment_method || order?.meta?.payment_method || "",
        ...safeItems(order).map((item) => item?.name || ""),
      ]
        .join(" ")
        .toLowerCase();
      return terms.includes(search);
    });
  }, [qrOrders, search]);

  const summary = useMemo(() => {
    return filteredOrders.reduce(
      (acc, order) => {
        acc.totalOrders += 1;
        acc.totalItems += safeItems(order).reduce((sum, item) => sum + Number(item?.qty || 0), 0);
        acc.totalValue += orderTotal(order);
        return acc;
      },
      { totalOrders: 0, totalItems: 0, totalValue: 0 }
    );
  }, [filteredOrders]);

  return (
    <div className="cv-page cv-page--orders p-4 md:p-6 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="cv-page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="cv-page-title text-2xl font-bold text-gray-900">Orders</h1>
            <p className="cv-page-subtitle text-sm text-gray-600 mt-1">
              QR customer orders from menu scanning with full customer and order details
            </p>
          </div>
          <button
            type="button"
            onClick={loadQrOrders}
            className="cv-acid-btn px-4 py-2 rounded-lg text-sm font-semibold"
          >
            Refresh Orders
          </button>
        </div>

        <div className="cv-orders-summary-grid grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="cv-order-summary-card cv-order-summary-card--count">
            <div className="cv-order-summary-label">Pending QR Orders</div>
            <div className="cv-order-summary-value">{summary.totalOrders}</div>
          </div>
          <div className="cv-order-summary-card cv-order-summary-card--items">
            <div className="cv-order-summary-label">Total Items</div>
            <div className="cv-order-summary-value">{summary.totalItems}</div>
          </div>
          <div className="cv-order-summary-card cv-order-summary-card--value">
            <div className="cv-order-summary-label">Estimated Value</div>
            <div className="cv-order-summary-value">{toMoney(summary.totalValue)}</div>
          </div>
        </div>

        <div className="cv-orders-search-card bg-white border border-gray-200 rounded-xl p-4">
          <label className="block text-xs font-semibold tracking-wide text-gray-600 uppercase mb-2">
            Search Order
          </label>
          <input
            type="text"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="w-full md:max-w-md px-3 py-2 rounded-lg border border-gray-300"
            placeholder="Invoice, customer, phone, table, note, or item"
          />
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
              Loading QR orders...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
              No QR orders found for current branch and filters
            </div>
          ) : (
            filteredOrders.map((order) => {
              const items = safeItems(order);
              const total = orderTotal(order);
              const paymentMethod =
                order.payment_method || order?.meta?.payment_method || "CASH";
              const note = order.note || order?.meta?.note || "-";
              const crmStatus = String(order?.meta?.crm_customer_status || "PENDING_APPROVAL")
                .trim()
                .toUpperCase();

              return (
                <article key={order.id} className="cv-order-card">
                  <div className="cv-order-card-head">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="cv-order-invoice-chip">{toInvoiceNumber(order)}</span>
                      <span className="cv-order-status-chip">PENDING QR</span>
                      <span className="cv-order-ref-chip">{order.reference || "QR_MENU"}</span>
                    </div>
                    <div className="text-xs font-semibold text-slate-600">
                      {toDateTime(order.created_at)}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
                    <div className="cv-order-meta-cell">
                      <div className="cv-order-meta-label">Customer</div>
                      <div className="cv-order-meta-value">{order.customer_name || "Walk-in"}</div>
                    </div>
                    <div className="cv-order-meta-cell">
                      <div className="cv-order-meta-label">Mobile</div>
                      <div className="cv-order-meta-value">{order.customer_phone || "-"}</div>
                    </div>
                    <div className="cv-order-meta-cell">
                      <div className="cv-order-meta-label">Table</div>
                      <div className="cv-order-meta-value">{order.table_number || "-"}</div>
                    </div>
                    <div className="cv-order-meta-cell">
                      <div className="cv-order-meta-label">Payment</div>
                      <div className="cv-order-meta-value">{paymentMethod}</div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-start">
                    <div className="cv-order-items-wrap">
                      <div className="cv-order-items-head">
                        <span>Order Items</span>
                        <span>{items.length} lines</span>
                      </div>
                      <div className="cv-order-items-list">
                        {items.length === 0 ? (
                          <div className="text-sm text-slate-500">No items</div>
                        ) : (
                          items.map((item, index) => {
                            const qty = Number(item?.qty || 0);
                            const price = Number(item?.price || 0);
                            const lineTotal = qty * price;
                            return (
                              <div key={`${order.id}-item-${index}`} className="cv-order-item-row">
                                <div className="cv-order-item-name">
                                  {item?.name || `Item ${item?.product_id || ""}`}
                                </div>
                                <div className="cv-order-item-meta">
                                  x{qty} | {toMoney(lineTotal)}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                    <div className="cv-order-total-box">
                      <div className="cv-order-meta-label">Estimated Total</div>
                      <div className="cv-order-total-value">{toMoney(total)}</div>
                    </div>
                  </div>

                  <div className="mt-3 cv-order-note-box">
                    <div className="cv-order-meta-label">Special Notice</div>
                    <div className="cv-order-note-value">{note || "-"}</div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-slate-600">
                      CRM Status:{" "}
                      <span className="cv-order-crm-chip">{crmStatus.replaceAll("_", " ")}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => settleOrderToPOS(order.id)}
                      disabled={settleBusyId === Number(order.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                        settleBusyId === Number(order.id)
                          ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                          : "cv-acid-btn"
                      }`}
                    >
                      {settleBusyId === Number(order.id) ? "Opening POS..." : "Settle In POS"}
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>

        {isAdmin && (
          <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">CRM Approval Queue</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  New QR customers must be approved before they are added to CRM
                </p>
              </div>
              <button
                type="button"
                onClick={loadCrmRequests}
                className="cv-acid-btn-soft px-3 py-1.5 rounded-lg text-xs font-semibold"
              >
                Refresh Queue
              </button>
            </div>

            {crmLoading ? (
              <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                Loading CRM request queue...
              </div>
            ) : crmRequests.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                No pending CRM requests
              </div>
            ) : (
              <div className="space-y-2">
                {crmRequests.map((request) => {
                  const approving = crmActionBusyId === `approve-${request.id}`;
                  const rejecting = crmActionBusyId === `reject-${request.id}`;
                  return (
                    <article key={request.id} className="cv-order-crm-request-card">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-bold text-slate-900">
                          {request.invoice_number || request?.meta?.invoice_number || "-"}
                        </div>
                        <div className="text-xs font-semibold text-slate-500">
                          {toDateTime(request.requested_at)}
                        </div>
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-800">
                        {request.customer_name || "-"} • {request.customer_phone || "-"}
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        {request.customer_email || "No email"} •{" "}
                        {request.customer_address || "No address"}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={Boolean(crmActionBusyId)}
                          onClick={() => approveCrmRequest(request.id)}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                            approving || Boolean(crmActionBusyId)
                              ? "bg-emerald-200 text-emerald-900 cursor-not-allowed"
                              : "bg-emerald-600 text-white hover:bg-emerald-700"
                          }`}
                        >
                          {approving ? "Approving..." : "Approve"}
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(crmActionBusyId)}
                          onClick={() => rejectCrmRequest(request.id)}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                            rejecting || Boolean(crmActionBusyId)
                              ? "bg-rose-200 text-rose-900 cursor-not-allowed"
                              : "bg-rose-600 text-white hover:bg-rose-700"
                          }`}
                        >
                          {rejecting ? "Rejecting..." : "Reject"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      {message && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg text-sm shadow-lg">
          {message}
        </div>
      )}
    </div>
  );
}
