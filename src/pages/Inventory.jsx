import React, { useEffect, useState } from "react";
import api from "../utils/api.js";
import { getActiveBranchId, onActiveBranchChange } from "../utils/branchContext.js";

export default function Inventory() {
  const [activeBranchId, setActiveBranchId] = useState(() => getActiveBranchId(null));
  const [inventoryItems, setInventoryItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showProductLinksModal, setShowProductLinksModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [linkingItem, setLinkingItem] = useState(null);
  const [productLinks, setProductLinks] = useState([]);
  const [reorderSuggestions, setReorderSuggestions] = useState([]);
  const [requisitions, setRequisitions] = useState([]);
  const [loadingSupplyOps, setLoadingSupplyOps] = useState(false);
  const [creatingRequisition, setCreatingRequisition] = useState(false);
  const [requisitionActionBusyId, setRequisitionActionBusyId] = useState(null);
  const [loadingProductLinks, setLoadingProductLinks] = useState(false);
  const [savingProductLinks, setSavingProductLinks] = useState(false);
  const [form, setForm] = useState({
    name: "",
    unit: "g",
    current_stock: 0,
    min_stock: 0,
    expiry_date: "",
    category: "",
  });

  const load = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/inventory/items");
      setInventoryItems(data);
    } catch (err) {
      console.error("Failed to load inventory items", err);
      setInventoryItems([]);
      setMessage("Failed to load inventory items");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const params = activeBranchId ? { branch_id: activeBranchId } : {};
      const { data } = await api.get("/admin/products", { params });
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load products for ingredient mapping", err);
      setProducts([]);
    }
  };

  const loadSupplyOps = async () => {
    try {
      setLoadingSupplyOps(true);
      const params = activeBranchId ? { branch_id: activeBranchId, limit: 20 } : { limit: 20 };
      const [reorderRes, reqRes] = await Promise.all([
        api.get("/supply/reorder-suggestions", { params }),
        api.get("/supply/requisitions", { params }),
      ]);
      setReorderSuggestions(Array.isArray(reorderRes.data) ? reorderRes.data : []);
      setRequisitions(Array.isArray(reqRes.data) ? reqRes.data : []);
    } catch (err) {
      console.error("Failed to load supply operations", err);
      setReorderSuggestions([]);
      setRequisitions([]);
    } finally {
      setLoadingSupplyOps(false);
    }
  };

  const createAutoRequisition = async () => {
    if (!Array.isArray(reorderSuggestions) || reorderSuggestions.length === 0) {
      setMessage("No low-stock suggestions available for requisition");
      setTimeout(() => setMessage(""), 2600);
      return;
    }
    try {
      setCreatingRequisition(true);
      const payload = activeBranchId ? { branch_id: activeBranchId } : {};
      await api.post("/supply/requisitions", payload);
      await loadSupplyOps();
      setMessage("Auto requisition created from reorder suggestions");
      setTimeout(() => setMessage(""), 2600);
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to create requisition");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setCreatingRequisition(false);
    }
  };

  const updateRequisitionStatus = async (requisitionId, action) => {
    const normalizedAction = String(action || "").trim().toLowerCase();
    if (!requisitionId || !normalizedAction) {
      return;
    }
    const endpointMap = {
      submit: "submit",
      approve: "approve",
      reject: "reject",
    };
    const endpoint = endpointMap[normalizedAction];
    if (!endpoint) {
      return;
    }

    setRequisitionActionBusyId(`${normalizedAction}-${requisitionId}`);
    try {
      await api.post(`/supply/requisitions/${requisitionId}/${endpoint}`);
      await loadSupplyOps();
      setMessage(`Requisition #${requisitionId} ${normalizedAction}ed`);
      setTimeout(() => setMessage(""), 2600);
    } catch (err) {
      setMessage(err.response?.data?.message || `Failed to ${normalizedAction} requisition`);
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setRequisitionActionBusyId(null);
    }
  };

  const convertRequisitionToPO = async (requisitionId) => {
    if (!requisitionId) {
      return;
    }

    setRequisitionActionBusyId(`convert-${requisitionId}`);
    try {
      const { data } = await api.post(`/supply/requisitions/${requisitionId}/convert-to-po`);
      await loadSupplyOps();
      const poId = Number(data?.purchase_order_id || 0);
      setMessage(
        poId > 0
          ? `Requisition #${requisitionId} converted to PO #${poId}`
          : `Requisition #${requisitionId} converted to purchase order`
      );
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setMessage(
        err.response?.data?.message || `Failed to convert requisition #${requisitionId} to PO`
      );
      setTimeout(() => setMessage(""), 3200);
    } finally {
      setRequisitionActionBusyId(null);
    }
  };

  useEffect(() => {
    load();
    loadProducts();
    loadSupplyOps();
  }, [activeBranchId]);

  useEffect(() => onActiveBranchChange((nextBranchId) => setActiveBranchId(nextBranchId)), []);

  const openAddModal = () => {
    setEditingItem(null);
    setForm({
      name: "",
      unit: "g",
      current_stock: 0,
      min_stock: 0,
      expiry_date: "",
      category: "",
    });
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setForm({
      name: item.name || "",
      unit: item.unit || "g",
      current_stock: item.current_stock || 0,
      min_stock: item.min_stock || 0,
      expiry_date: item.expiry_date ? item.expiry_date.split("T")[0] : "",
      category: item.category || "",
    });
    setShowModal(true);
  };

  const openProductLinksModal = async (item) => {
    setLinkingItem(item);
    setShowProductLinksModal(true);
    setLoadingProductLinks(true);
    setProductLinks(
      products.map((product) => ({
        id: product.id,
        name: product.name,
        category: product.category,
        is_active: product.is_active,
        quantity: 0,
      }))
    );

    try {
      const { data } = await api.get(`/inventory/items/${item.id}/product-links`);
      setProductLinks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load product links for inventory item", err);
      setMessage("Failed to load product links");
      setProductLinks([]);
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setLoadingProductLinks(false);
    }
  };

  const closeProductLinksModal = () => {
    setShowProductLinksModal(false);
    setLinkingItem(null);
    setProductLinks([]);
    setLoadingProductLinks(false);
    setSavingProductLinks(false);
  };

  const updateProductLinkQuantity = (productId, value) => {
    const quantity = value === "" ? "" : parseFloat(value);
    setProductLinks((prev) =>
      prev.map((link) =>
        link.id === productId
          ? { ...link, quantity: Number.isFinite(quantity) || value === "" ? value : link.quantity }
          : link
      )
    );
  };

  const saveProductLinks = async (e) => {
    e.preventDefault();
    if (!linkingItem) {
      return;
    }

    setSavingProductLinks(true);
    try {
      const linksPayload = productLinks
        .map((link) => ({
          product_id: String(link.id),
          quantity: parseFloat(link.quantity),
        }))
        .filter(
          (link) => link.product_id.length > 0 && Number.isFinite(link.quantity) && link.quantity > 0
        );

      await api.post(`/inventory/items/${linkingItem.id}/product-links`, {
        links: linksPayload,
      });

      setMessage(`Product usage updated for ${linkingItem.name}`);
      closeProductLinksModal();
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      console.error("Failed to save product links", err);
      setMessage(err.response?.data?.message || "Failed to save product links");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setSavingProductLinks(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!form.name) {
      setMessage("Name is required");
      return;
    }

    try {
      if (editingItem) {
        await api.put(`/inventory/items/${editingItem.id}`, form);
        setMessage("Inventory item updated successfully");
      } else {
        await api.post("/inventory/items", form);
        setMessage("Inventory item created successfully");
      }
      setShowModal(false);
      load();
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to save inventory item");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const updateStock = async (item, newStock) => {
    const value = parseFloat(newStock);
    if (isNaN(value) || value < 0) return;
    try {
      await api.put(`/inventory/items/${item.id}`, {
        ...item,
        current_stock: value,
      });
      setInventoryItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, current_stock: value } : i))
      );
      setMessage("Stock updated");
      setTimeout(() => setMessage(""), 2000);
    } catch (err) {
      console.error("Failed to update stock", err);
      setMessage("Failed to update stock");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const deleteItem = async (id) => {
    if (!window.confirm("Are you sure you want to delete this inventory item?")) return;

    try {
      await api.delete(`/inventory/items/${id}`);
      setMessage("Inventory item deleted");
      load();
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setMessage("Failed to delete inventory item");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const getStockStatus = (item) => {
    if (item.current_stock <= 0) return { label: "Out of Stock", color: "red" };
    if (item.current_stock <= item.min_stock) return { label: "Low Stock", color: "yellow" };
    return { label: "In Stock", color: "green" };
  };

  const getExpiryStatus = (item) => {
    if (!item.expiry_date) return null;
    const expiry = new Date(item.expiry_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { label: "Expired", color: "red" };
    if (diffDays <= 3) return { label: "Expires Soon", color: "orange" };
    return null;
  };

  const productsForLinking =
    productLinks.length > 0
      ? productLinks
      : products.map((product) => ({
          id: product.id,
          name: product.name,
          category: product.category,
          is_active: product.is_active,
          quantity: 0,
        }));

  return (
    <div className="cv-page cv-page--inventory p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="cv-page-header flex items-center justify-between mb-6">
          <div>
            <h1 className="cv-page-title text-3xl font-bold text-gray-900">Inventory Management</h1>
            <p className="cv-page-subtitle text-sm text-gray-600 mt-1">
              Manage inventory items (ingredients) and track stock levels
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-md flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Inventory Item
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Item Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Unit</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase">Current Stock</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase">Min Stock</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold uppercase">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold uppercase">Expiry</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-400">
                      Loading inventory items...
                    </td>
                  </tr>
                ) : inventoryItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-400">
                      No inventory items found. Add your first item to get started.
                    </td>
                  </tr>
                ) : (
                  inventoryItems.map((item) => {
                    const stockStatus = getStockStatus(item);
                    const expiryStatus = getExpiryStatus(item);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
                        <td className="px-6 py-4 text-gray-700">
                          {item.category ? (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                              {item.category}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-700">{item.unit}</td>
                        <td className="px-6 py-4 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.current_stock || 0}
                            onChange={(e) => updateStock(item, e.target.value)}
                            className="w-24 px-2 py-1 border border-gray-300 rounded-lg text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-6 py-4 text-right text-gray-700">
                          {item.min_stock || 0} {item.unit}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              stockStatus.color === "red"
                                ? "bg-red-100 text-red-800"
                                : stockStatus.color === "yellow"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {stockStatus.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {expiryStatus ? (
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                expiryStatus.color === "red"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-orange-100 text-orange-800"
                              }`}
                            >
                              {expiryStatus.label}
                            </span>
                          ) : item.expiry_date ? (
                            <span className="text-xs text-gray-500">
                              {new Date(item.expiry_date).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openProductLinksModal(item)}
                              className="px-2.5 py-2 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors text-xs font-semibold border border-emerald-100"
                              title="Assign to products"
                            >
                              Use In Products
                            </button>
                            <button
                              onClick={() => openEditModal(item)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteItem(item.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Total Items</div>
            <div className="text-2xl font-bold text-gray-900">{inventoryItems.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Low Stock</div>
            <div className="text-2xl font-bold text-yellow-600">
              {inventoryItems.filter((i) => i.current_stock > 0 && i.current_stock <= i.min_stock).length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Out of Stock</div>
            <div className="text-2xl font-bold text-red-600">
              {inventoryItems.filter((i) => i.current_stock <= 0).length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Expiring Soon</div>
            <div className="text-2xl font-bold text-orange-600">
              {inventoryItems.filter((i) => {
                if (!i.expiry_date) return false;
                const expiry = new Date(i.expiry_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
                return diffDays >= 0 && diffDays <= 3;
              }).length}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="cv-inventory-supply-card bg-white rounded-xl shadow-md border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">Reorder Suggestions</h3>
                <p className="text-xs text-gray-500 mt-1">Based on current stock vs minimum stock</p>
              </div>
              <button
                type="button"
                onClick={createAutoRequisition}
                disabled={creatingRequisition || reorderSuggestions.length === 0}
                className={`px-3 py-2 rounded-lg text-xs font-semibold ${
                  creatingRequisition || reorderSuggestions.length === 0
                    ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {creatingRequisition ? "Creating..." : "Create Requisition"}
              </button>
            </div>
            {loadingSupplyOps ? (
              <div className="py-8 text-sm text-gray-500 text-center">Loading suggestions...</div>
            ) : reorderSuggestions.length === 0 ? (
              <div className="py-8 text-sm text-gray-500 text-center">No reorder suggestions</div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {reorderSuggestions.slice(0, 15).map((item) => (
                  <div key={item.inventory_item_id} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="font-semibold text-gray-900">{item.name}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Stock {item.current_stock} {item.unit || ""}  -  Min {item.min_stock}  -  Reorder {item.reorder_qty}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="cv-inventory-supply-card bg-white rounded-xl shadow-md border border-gray-200 p-4">
            <div className="mb-3">
              <h3 className="text-base font-bold text-gray-900">Recent Requisitions</h3>
              <p className="text-xs text-gray-500 mt-1">Procurement workflow</p>
            </div>
            {loadingSupplyOps ? (
              <div className="py-8 text-sm text-gray-500 text-center">Loading requisitions...</div>
            ) : requisitions.length === 0 ? (
              <div className="py-8 text-sm text-gray-500 text-center">No requisitions yet</div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {requisitions.slice(0, 12).map((req) => (
                  <div key={req.id} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-gray-900">REQ #{req.id}</div>
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                        {req.status}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {String(req.status || "").toUpperCase() === "DRAFT" && (
                        <button
                          type="button"
                          disabled={Boolean(requisitionActionBusyId)}
                          onClick={() => updateRequisitionStatus(req.id, "submit")}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
                            requisitionActionBusyId
                              ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                              : "bg-blue-600 text-white hover:bg-blue-700"
                          }`}
                        >
                          Submit
                        </button>
                      )}
                      {(String(req.status || "").toUpperCase() === "SUBMITTED" ||
                        String(req.status || "").toUpperCase() === "DRAFT") && (
                        <button
                          type="button"
                          disabled={Boolean(requisitionActionBusyId)}
                          onClick={() => updateRequisitionStatus(req.id, "approve")}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
                            requisitionActionBusyId
                              ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                              : "bg-emerald-600 text-white hover:bg-emerald-700"
                          }`}
                        >
                          Approve
                        </button>
                      )}
                      {(String(req.status || "").toUpperCase() === "SUBMITTED" ||
                        String(req.status || "").toUpperCase() === "DRAFT") && (
                        <button
                          type="button"
                          disabled={Boolean(requisitionActionBusyId)}
                          onClick={() => updateRequisitionStatus(req.id, "reject")}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
                            requisitionActionBusyId
                              ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                              : "bg-gray-700 text-white hover:bg-gray-800"
                          }`}
                        >
                          Reject
                        </button>
                      )}
                      {String(req.status || "").toUpperCase() === "APPROVED" &&
                        !req.purchase_order_id && (
                          <button
                            type="button"
                            disabled={Boolean(requisitionActionBusyId)}
                            onClick={() => convertRequisitionToPO(req.id)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
                              requisitionActionBusyId
                                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                                : "bg-indigo-600 text-white hover:bg-indigo-700"
                            }`}
                          >
                            {requisitionActionBusyId === `convert-${req.id}`
                              ? "Converting..."
                              : "Convert to PO"}
                          </button>
                        )}
                      {req.purchase_order_id && (
                        <span className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-800">
                          PO #{req.purchase_order_id}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {(req.items || []).length} items  -  {new Date(req.created_at).toLocaleString()}
                    </div>
                    {req.purchase_order_id && (
                      <div className="text-xs text-gray-500 mt-1">
                        Linked PO #{req.purchase_order_id}
                        {req.purchase_order_status ? ` (${req.purchase_order_status})` : ""}
                        {req.supplier_name ? `  -  ${req.supplier_name}` : ""}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingItem ? "Edit Inventory Item" : "Add New Inventory Item"}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  x
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Item Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g., Chicken, Cheese, Onion"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Unit</label>
                    <select
                      value={form.unit}
                      onChange={(e) => setForm({ ...form, unit: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="g">Grams (g)</option>
                      <option value="kg">Kilograms (kg)</option>
                      <option value="ml">Milliliters (ml)</option>
                      <option value="L">Liters (L)</option>
                      <option value="pcs">Pieces</option>
                      <option value="units">Units</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                    <input
                      type="text"
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      placeholder="e.g., Meat, Dairy, Vegetables"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Current Stock</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.current_stock}
                      onChange={(e) => setForm({ ...form, current_stock: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Stock (Alert Threshold)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.min_stock}
                      onChange={(e) => setForm({ ...form, min_stock: parseFloat(e.target.value) || 0 })}
                      placeholder="e.g., 300"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Alert when stock goes below this amount</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Expiry Date (Optional)</label>
                  <input
                    type="date"
                    value={form.expiry_date}
                    onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-md"
                  >
                    {editingItem ? "Update Item" : "Create Item"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Product Usage Modal */}
      {showProductLinksModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Use Ingredient In Products</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {linkingItem ? `${linkingItem.name} (${linkingItem.unit})` : "Inventory item"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeProductLinksModal}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  x
                </button>
              </div>

              {loadingProductLinks ? (
                <div className="py-12 text-center text-gray-500">Loading products...</div>
              ) : (
                <form onSubmit={saveProductLinks}>
                  <p className="text-xs text-gray-500 mb-4">
                    Enter how much of this ingredient is used for one unit of each product. Leave blank or 0 for products that do not use this ingredient.
                  </p>

                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                            Product
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                            Category
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                            Quantity ({linkingItem?.unit || "unit"})
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {productsForLinking.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                              No products found.
                            </td>
                          </tr>
                        ) : (
                          productsForLinking.map((product) => (
                            <tr key={product.id}>
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900">{product.name}</div>
                                <div className="text-xs text-gray-500">ID: {product.id}</div>
                              </td>
                              <td className="px-4 py-3 text-gray-700">{product.category || "-"}</td>
                              <td className="px-4 py-3 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={product.quantity ?? ""}
                                  onChange={(e) =>
                                    updateProductLinkQuantity(product.id, e.target.value)
                                  }
                                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="0.00"
                                />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-gray-200 mt-4">
                    <button
                      type="button"
                      onClick={closeProductLinksModal}
                      className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingProductLinks}
                      className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-colors shadow-md ${
                        savingProductLinks
                          ? "bg-blue-300 text-white cursor-not-allowed"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      {savingProductLinks ? "Saving..." : "Save Product Usage"}
                    </button>
                  </div>
                </form>
              )}
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

