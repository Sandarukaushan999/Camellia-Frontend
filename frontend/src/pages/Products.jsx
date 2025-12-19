import React, { useEffect, useMemo, useState } from "react";
import api from "../utils/api.js";

const CATEGORIES = [
  "Rice",
  "Kottu",
  "Burger",
  "Submarine",
  "Juice",
  "Café",
  "Pizza",
];

const CATEGORY_ICONS = {
  Rice: "🍚",
  Kottu: "🍜",
  Burger: "🍔",
  Submarine: "🥖",
  Juice: "🥤",
  Café: "☕",
  Pizza: "🍕",
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState({
    name: "",
    category: "",
    type: "simple",
    price: "",
    variants: [{ name: "", price: "" }],
    is_active: true,
  });
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  const markProductsUpdated = () => {
    try {
      localStorage.setItem("cv_products_updated_at", String(Date.now()));
    } catch {
      // ignore
    }
  };

  const loadProducts = async () => {
    try {
      const { data } = await api.get("/admin/products");
      setProducts(data);
    } catch (err) {
      console.error("Failed to load products", err);
      setProducts([]);
    }
  };

  // Filter products
  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Category filter
    if (selectedCategory !== "ALL") {
      filtered = filtered.filter((p) => p.category === selectedCategory);
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          (p.category && p.category.toLowerCase().includes(term))
      );
    }

    return filtered;
  }, [products, selectedCategory, searchTerm]);

  // Open modal for new product
  const openAddModal = () => {
    setEditingProduct(null);
    setForm({
      name: "",
      category: "",
      type: "simple",
      price: "",
      variants: [{ name: "", price: "" }],
      is_active: true,
    });
    setShowModal(true);
  };

  // Open modal for editing
  const openEditModal = (product) => {
    setEditingProduct(product);
    setForm({
      name: product.name || "",
      category: product.category || "",
      type: "simple", // For now, we'll support simple only
      price: product.price || "",
      variants: [{ name: "", price: "" }],
      is_active: product.is_active !== false,
    });
    setShowModal(true);
  };

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!form.name || !form.category) {
      setMessage("Name and category are required");
      return;
    }

    if (form.type === "simple" && !form.price) {
      setMessage("Price is required for simple products");
      return;
    }

    try {
      const payload = {
        name: form.name,
        category: form.category,
        price: form.type === "simple" ? parseFloat(form.price) : null,
        is_active: form.is_active,
      };

      if (editingProduct) {
        // Update product
        await api.put(`/admin/products/${editingProduct.id}`, payload);
        setMessage("Product updated successfully");
      } else {
        // Create product
        await api.post("/admin/products", payload);
        setMessage("Product created successfully");
      }

      setShowModal(false);
      loadProducts();
      markProductsUpdated();
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to save product");
    }
  };

  // Toggle product status
  const toggleStatus = async (product) => {
    try {
      await api.put(`/admin/products/${product.id}`, {
        ...product,
        is_active: !product.is_active,
      });
      loadProducts();
      markProductsUpdated();
    } catch (err) {
      setMessage("Failed to update status");
    }
  };

  // Delete product
  const deleteProduct = async (id) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;

    try {
      await api.delete(`/admin/products/${id}`);
      setMessage("Product deleted");
      loadProducts();
      markProductsUpdated();
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setMessage("Failed to delete product");
    }
  };

  const formatCurrency = (amount) => {
    return `Rs. ${parseFloat(amount).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Products (Menu)</h1>
            <p className="text-gray-600 mt-1">Manage your menu items and pricing</p>
          </div>
          <button
            onClick={openAddModal}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-md flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Product
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6 border border-gray-200">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="md:w-64">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ALL">All Categories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-gray-400">
                      <div className="text-lg mb-2">No products found</div>
                      <div className="text-sm">
                        {searchTerm || selectedCategory !== "ALL"
                          ? "Try adjusting your filters"
                          : "Add your first product to get started"}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="text-2xl">
                            {CATEGORY_ICONS[product.category] || "📦"}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{product.name}</div>
                            <div className="text-xs text-gray-500">ID: {product.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                          {product.category || "Uncategorized"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(product.price)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => toggleStatus(product)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            product.is_active
                              ? "bg-green-100 text-green-800 hover:bg-green-200"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {product.is_active ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(product)}
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
                            onClick={() => deleteProduct(product.id)}
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Total Products</div>
            <div className="text-2xl font-bold text-gray-900">{products.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Active Products</div>
            <div className="text-2xl font-bold text-green-600">
              {products.filter((p) => p.is_active).length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Categories</div>
            <div className="text-2xl font-bold text-blue-600">
              {new Set(products.map((p) => p.category).filter(Boolean)).size}
            </div>
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
                  {editingProduct ? "Edit Product" : "Add New Product"}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                    Basic Information
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g., Chicken Burger"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category *
                    </label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="">Select Category</option>
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {CATEGORY_ICONS[cat]} {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Product Type
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="simple"
                          checked={form.type === "simple"}
                          onChange={(e) => setForm({ ...form, type: e.target.value })}
                          className="mr-2"
                        />
                        <span>Simple Item</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="variant"
                          checked={form.type === "variant"}
                          onChange={(e) => setForm({ ...form, type: e.target.value })}
                          className="mr-2"
                          disabled
                        />
                        <span className="text-gray-400">Variant Item (Coming Soon)</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          checked={form.is_active}
                          onChange={() => setForm({ ...form, is_active: true })}
                          className="mr-2"
                        />
                        <span>Active</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          checked={!form.is_active}
                          onChange={() => setForm({ ...form, is_active: false })}
                          className="mr-2"
                        />
                        <span>Inactive</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Pricing */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                    Pricing
                  </h3>

                  {form.type === "simple" ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Price (Rs.) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.price}
                        onChange={(e) => setForm({ ...form, price: e.target.value })}
                        placeholder="850.00"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required={form.type === "simple"}
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-sm text-gray-600 mb-3">Variant pricing (Coming Soon)</div>
                    </div>
                  )}
                </div>

                {/* Actions */}
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
                    {editingProduct ? "Update Product" : "Create Product"}
                  </button>
                </div>
              </form>
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
