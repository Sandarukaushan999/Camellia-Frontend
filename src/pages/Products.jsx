import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../utils/api.js";

const CATEGORIES = [
  "Rice",
  "Kottu",
  "Burger",
  "Submarine",
  "Juice",
  "Caf\u00E9",
  "Pizza",
];

const CATEGORY_ICONS = {
  Rice: "\u{1F35A}",
  Kottu: "\u{1F35C}",
  Burger: "\u{1F354}",
  Submarine: "\u{1F956}",
  Juice: "\u{1F964}",
  "Caf\u00E9": "\u2615",
  Pizza: "\u{1F355}",
};

const MAX_UPLOAD_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_DATA_URL_LENGTH = 750_000;

function optimizeImageToDataUrl(file, options = {}) {
  const maxWidth = Number(options.maxWidth || 720);
  const maxHeight = Number(options.maxHeight || 720);
  const quality = Number(options.quality || 0.84);
  const outputType = String(options.outputType || "image/jpeg");

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      try {
        const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
        const targetWidth = Math.max(1, Math.round(image.width * scale));
        const targetHeight = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("Canvas not supported");
        }

        context.drawImage(image, 0, 0, targetWidth, targetHeight);
        const dataUrl = canvas.toDataURL(outputType, quality);
        resolve(dataUrl);
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Invalid image file"));
    };

    image.src = objectUrl;
  });
}

export default function Products() {
  const imageInputRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [showModal, setShowModal] = useState(false);
  const [showIngredientsModal, setShowIngredientsModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [ingredientsProduct, setIngredientsProduct] = useState(null);
  const [form, setForm] = useState({
    name: "",
    category: "",
    type: "simple",
    price: "",
    variants: [{ name: "", price: "" }],
    is_active: true,
    image_url: "",
  });
  const [ingredients, setIngredients] = useState([{ inventory_item_id: "", quantity: "" }]);
  const [ingredientsForm, setIngredientsForm] = useState([{ inventory_item_id: "", quantity: "" }]);
  const [loadingIngredientsForm, setLoadingIngredientsForm] = useState(false);
  const [savingIngredientsForm, setSavingIngredientsForm] = useState(false);
  const [imageUploadBusy, setImageUploadBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadProducts();
    loadInventoryItems();
  }, []);

  const loadInventoryItems = async () => {
    try {
      const { data } = await api.get("/inventory/items");
      setInventoryItems(data.filter(item => item.isActive !== false));
    } catch (err) {
      console.error("Failed to load inventory items", err);
    }
  };

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
  const openAddModal = async () => {
    setEditingProduct(null);
    setForm({
      name: "",
      category: "",
      type: "simple",
      price: "",
      variants: [{ name: "", price: "" }],
      is_active: true,
      image_url: "",
    });
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
    setIngredients([{ inventory_item_id: "", quantity: "" }]);
    await loadInventoryItems();
    setShowModal(true);
  };

  // Open modal for editing
  const openEditModal = async (product) => {
    setEditingProduct(product);
    setForm({
      name: product.name || "",
      category: product.category || "",
      type: "simple",
      price: product.price || "",
      variants: [{ name: "", price: "" }],
      is_active: product.is_active !== false,
      image_url: String(product.image_url || ""),
    });
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
    
    // Load product ingredients
    try {
      await loadInventoryItems();
      const { data } = await api.get(`/inventory/products/${product.id}/ingredients`);
      if (data && data.length > 0) {
        setIngredients(data.map(ing => ({
          inventory_item_id: ing.inventory_item_id,
          quantity: ing.quantity
        })));
      } else {
        setIngredients([{ inventory_item_id: "", quantity: "" }]);
      }
    } catch (err) {
      console.error("Failed to load product ingredients", err);
      setIngredients([{ inventory_item_id: "", quantity: "" }]);
    }
    
    setShowModal(true);
  };

  const clearProductImage = () => {
    setForm((prev) => ({ ...prev, image_url: "" }));
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  const handleImageSelection = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!String(file.type || "").startsWith("image/")) {
      setMessage("Please select a valid image file");
      setTimeout(() => setMessage(""), 3000);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
      return;
    }

    if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
      setMessage("Image is too large. Max file size is 5MB.");
      setTimeout(() => setMessage(""), 3000);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
      return;
    }

    setImageUploadBusy(true);
    try {
      const outputType =
        file.type === "image/png" || file.type === "image/webp"
          ? file.type
          : "image/jpeg";
      const optimizedDataUrl = await optimizeImageToDataUrl(file, {
        maxWidth: 720,
        maxHeight: 720,
        quality: 0.84,
        outputType,
      });

      if (optimizedDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
        setMessage("Image is still too large after optimization. Please choose a smaller image.");
        setTimeout(() => setMessage(""), 3500);
        return;
      }

      setForm((prev) => ({ ...prev, image_url: optimizedDataUrl }));
    } catch (error) {
      console.error("Image processing failed", error);
      setMessage("Failed to process image. Please try another file.");
      setTimeout(() => setMessage(""), 3500);
    } finally {
      setImageUploadBusy(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    }
  };

  const openIngredientsModal = async (product) => {
    setIngredientsProduct(product);
    setLoadingIngredientsForm(true);
    setShowIngredientsModal(true);

    try {
      await loadInventoryItems();
      const { data } = await api.get(`/inventory/products/${product.id}/ingredients`);
      if (Array.isArray(data) && data.length > 0) {
        setIngredientsForm(
          data.map((ing) => ({
            inventory_item_id: String(ing.inventory_item_id),
            quantity: String(ing.quantity),
          }))
        );
      } else {
        setIngredientsForm([{ inventory_item_id: "", quantity: "" }]);
      }
    } catch (err) {
      console.error("Failed to load product ingredients", err);
      setIngredientsForm([{ inventory_item_id: "", quantity: "" }]);
      setMessage("Failed to load ingredients");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setLoadingIngredientsForm(false);
    }
  };

  const closeIngredientsModal = () => {
    setShowIngredientsModal(false);
    setIngredientsProduct(null);
    setIngredientsForm([{ inventory_item_id: "", quantity: "" }]);
    setLoadingIngredientsForm(false);
    setSavingIngredientsForm(false);
  };

  const addIngredientsFormRow = () => {
    setIngredientsForm((prev) => [...prev, { inventory_item_id: "", quantity: "" }]);
  };

  const removeIngredientsFormRow = (index) => {
    setIngredientsForm((prev) => prev.filter((_, i) => i !== index));
  };

  const updateIngredientsFormRow = (index, field, value) => {
    setIngredientsForm((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const saveIngredientsForProduct = async (e) => {
    e.preventDefault();
    if (!ingredientsProduct) {
      return;
    }

    setSavingIngredientsForm(true);
    try {
      const validIngredients = ingredientsForm
        .map((row) => ({
          inventory_item_id: parseInt(row.inventory_item_id, 10),
          quantity: parseFloat(row.quantity),
        }))
        .filter(
          (row) =>
            Number.isFinite(row.inventory_item_id) &&
            Number.isFinite(row.quantity) &&
            row.quantity > 0
        );

      await api.post(`/inventory/products/${ingredientsProduct.id}/ingredients`, {
        ingredients: validIngredients,
      });

      setMessage(`Ingredients updated for ${ingredientsProduct.name}`);
      closeIngredientsModal();
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      console.error("Failed to save product ingredients", err);
      setMessage(err.response?.data?.message || "Failed to save ingredients");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setSavingIngredientsForm(false);
    }
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
        name: String(form.name || "").trim(),
        category: form.category,
        price: form.type === "simple" ? parseFloat(form.price) : null,
        is_active: form.is_active,
        image_url: form.image_url || null,
      };

      let productId;
      if (editingProduct) {
        // Update product
        const res = await api.put(`/admin/products/${editingProduct.id}`, payload);
        productId = editingProduct.id;
        setMessage("Product updated successfully");
      } else {
        // Create product
        const res = await api.post("/admin/products", payload);
        productId = res.data.id;
        setMessage("Product created successfully");
      }

      // Save ingredients
      const validIngredients = ingredients.filter(
        ing => ing.inventory_item_id && ing.quantity && parseFloat(ing.quantity) > 0
      );
      
      if (validIngredients.length > 0) {
        await api.post(`/inventory/products/${productId}/ingredients`, {
          ingredients: validIngredients.map(ing => ({
            inventory_item_id: parseInt(ing.inventory_item_id),
            quantity: parseFloat(ing.quantity)
          }))
        });
      }

      setShowModal(false);
      loadProducts();
      markProductsUpdated();
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to save product");
    }
  };

  const addIngredientRow = () => {
    setIngredients([...ingredients, { inventory_item_id: "", quantity: "" }]);
  };

  const removeIngredientRow = (index) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index, field, value) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
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
    <div className="cv-page cv-page--products p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="cv-page-header flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="cv-page-title text-3xl font-bold text-gray-900">Products (Menu)</h1>
            <p className="cv-page-subtitle text-gray-600 mt-1">Manage your menu items and pricing</p>
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
                          <div className="h-12 w-12 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-2xl">
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              CATEGORY_ICONS[product.category] || "\u{1F4E6}"
                            )}
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
                            onClick={() => openIngredientsModal(product)}
                            className="px-2.5 py-2 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors text-xs font-semibold border border-emerald-100"
                            title="Manage Ingredients"
                          >
                            Ingredients
                          </button>
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
                  {"\u00D7"}
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
                      Product Image
                    </label>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="h-24 w-24 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center text-3xl">
                        {form.image_url ? (
                          <img
                            src={form.image_url}
                            alt={form.name || "Product preview"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          CATEGORY_ICONS[form.category] || "\u{1F4E6}"
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <input
                          ref={imageInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageSelection}
                          className="block w-full text-sm text-gray-600 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                        <p className="text-xs text-gray-500">
                          Upload JPG, PNG, WEBP, or GIF. We auto-optimize for POS performance.
                        </p>
                        <div className="flex gap-2">
                          {form.image_url && (
                            <button
                              type="button"
                              onClick={clearProductImage}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                            >
                              Remove Image
                            </button>
                          )}
                          {imageUploadBusy && (
                            <span className="text-xs text-blue-600 font-medium">
                              Processing image...
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
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

                {/* Ingredients */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                    <h3 className="text-lg font-semibold text-gray-900">Ingredients / Recipe</h3>
                    <button
                      type="button"
                      onClick={addIngredientRow}
                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Ingredient
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Assign inventory items (ingredients) to this product. Stock will be automatically deducted when orders are placed.
                  </p>
                  
                  <div className="space-y-3">
                    {ingredients.map((ing, index) => (
                      <div key={index} className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Inventory Item</label>
                          <select
                            value={ing.inventory_item_id}
                            onChange={(e) => updateIngredient(index, "inventory_item_id", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select Item</option>
                            {inventoryItems.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name} ({item.unit})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="w-32">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Quantity</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={ing.quantity}
                            onChange={(e) => updateIngredient(index, "quantity", e.target.value)}
                            placeholder="e.g., 100"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        {ingredients.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeIngredientRow(index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {ingredients.length === 0 && (
                    <button
                      type="button"
                      onClick={addIngredientRow}
                      className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
                    >
                      + Add First Ingredient
                    </button>
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
                    disabled={imageUploadBusy}
                    className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-colors shadow-md ${
                      imageUploadBusy
                        ? "bg-blue-300 text-white cursor-not-allowed"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {imageUploadBusy
                      ? "Processing Image..."
                      : editingProduct
                      ? "Update Product"
                      : "Create Product"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Ingredients Modal */}
      {showIngredientsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Manage Ingredients</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {ingredientsProduct ? ingredientsProduct.name : "Product"}
                  </p>
                </div>
                <button
                  onClick={closeIngredientsModal}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                  type="button"
                >
                  {"\u00D7"}
                </button>
              </div>

              {loadingIngredientsForm ? (
                <div className="py-12 text-center text-gray-500">Loading ingredients...</div>
              ) : (
                <form onSubmit={saveIngredientsForProduct} className="space-y-4">
                  <p className="text-xs text-gray-500">
                    Select inventory items and define quantity used for one unit of this product.
                  </p>

                  <div className="space-y-3">
                    {ingredientsForm.map((ing, index) => (
                      <div key={index} className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Inventory Item
                          </label>
                          <select
                            value={ing.inventory_item_id}
                            onChange={(e) =>
                              updateIngredientsFormRow(index, "inventory_item_id", e.target.value)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select Item</option>
                            {inventoryItems.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name} ({item.unit})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="w-32">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Quantity
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={ing.quantity}
                            onChange={(e) =>
                              updateIngredientsFormRow(index, "quantity", e.target.value)
                            }
                            placeholder="0.00"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        {ingredientsForm.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeIngredientsFormRow(index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={addIngredientsFormRow}
                    className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
                  >
                    + Add Ingredient Row
                  </button>

                  <div className="flex gap-3 pt-4 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={closeIngredientsModal}
                      className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingIngredientsForm}
                      className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-colors shadow-md ${
                        savingIngredientsForm
                          ? "bg-blue-300 text-white cursor-not-allowed"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      {savingIngredientsForm ? "Saving..." : "Save Ingredients"}
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
