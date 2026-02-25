import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../utils/api.js";
import { getActiveBranchId, onActiveBranchChange } from "../utils/branchContext.js";

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
  const [activeBranchId, setActiveBranchId] = useState(() => getActiveBranchId(null));
  const [branches, setBranches] = useState([]);
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
  const [showBranchOverrideModal, setShowBranchOverrideModal] = useState(false);
  const [overrideProduct, setOverrideProduct] = useState(null);
  const [savingOverride, setSavingOverride] = useState(false);
  const [branchOverrideForm, setBranchOverrideForm] = useState({
    has_price_override: false,
    price_override: "",
    is_active: true,
  });
  const [showOverrideMatrixModal, setShowOverrideMatrixModal] = useState(false);
  const [overrideMatrix, setOverrideMatrix] = useState({ branches: [], products: [] });
  const [overrideMatrixInitial, setOverrideMatrixInitial] = useState({});
  const [overrideMatrixDraft, setOverrideMatrixDraft] = useState({});
  const [overrideMatrixLoading, setOverrideMatrixLoading] = useState(false);
  const [overrideMatrixSaving, setOverrideMatrixSaving] = useState(false);
  const [overrideMatrixSearch, setOverrideMatrixSearch] = useState("");
  const [imageUploadBusy, setImageUploadBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadProducts();
    loadInventoryItems();
  }, [activeBranchId]);

  useEffect(() => {
    const loadBranches = async () => {
      try {
        const { data } = await api.get("/branches");
        setBranches(Array.isArray(data) ? data.filter((row) => row?.is_active !== false) : []);
      } catch (err) {
        console.error("Failed to load branches", err);
        setBranches([]);
      }
    };
    loadBranches();
  }, []);

  useEffect(() => onActiveBranchChange((nextBranchId) => setActiveBranchId(nextBranchId)), []);

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
      const params = activeBranchId ? { branch_id: activeBranchId } : {};
      const { data } = await api.get("/admin/products", { params });
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

  const openBranchOverrideModal = (product) => {
    if (!activeBranchId) {
      setMessage("Select an active branch from the top bar first");
      setTimeout(() => setMessage(""), 2600);
      return;
    }
    const hasPriceOverride =
      product.price_override !== null && product.price_override !== undefined;
    const branchActive =
      product.branch_is_active === null || product.branch_is_active === undefined
        ? product.is_active !== false
        : product.branch_is_active === true;

    setOverrideProduct(product);
    setBranchOverrideForm({
      has_price_override: hasPriceOverride,
      price_override: hasPriceOverride ? String(product.price_override) : "",
      is_active: branchActive,
    });
    setShowBranchOverrideModal(true);
  };

  const closeBranchOverrideModal = () => {
    setShowBranchOverrideModal(false);
    setOverrideProduct(null);
    setSavingOverride(false);
    setBranchOverrideForm({
      has_price_override: false,
      price_override: "",
      is_active: true,
    });
  };

  const saveBranchOverride = async (event) => {
    event.preventDefault();
    if (!activeBranchId || !overrideProduct?.id) {
      setMessage("Branch or product is missing");
      return;
    }

    const payload = {
      is_active: branchOverrideForm.is_active === true,
      clear_override: branchOverrideForm.has_price_override !== true,
    };
    if (branchOverrideForm.has_price_override) {
      const parsedPrice = parseFloat(branchOverrideForm.price_override);
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        setMessage("Override price must be a valid non-negative number");
        setTimeout(() => setMessage(""), 2600);
        return;
      }
      payload.price_override = parsedPrice;
    } else {
      payload.price_override = null;
    }

    setSavingOverride(true);
    try {
      await api.put(
        `/branches/${activeBranchId}/products/${overrideProduct.id}`,
        payload
      );
      await loadProducts();
      markProductsUpdated();
      setMessage("Branch override saved");
      closeBranchOverrideModal();
      setTimeout(() => setMessage(""), 2500);
    } catch (err) {
      console.error("Failed to save branch override", err);
      setMessage(err.response?.data?.message || "Failed to save branch override");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setSavingOverride(false);
    }
  };

  const clearBranchOverride = async () => {
    if (!activeBranchId || !overrideProduct?.id) {
      return;
    }
    setSavingOverride(true);
    try {
      await api.delete(`/branches/${activeBranchId}/products/${overrideProduct.id}`);
      await loadProducts();
      markProductsUpdated();
      setMessage("Branch override removed");
      closeBranchOverrideModal();
      setTimeout(() => setMessage(""), 2500);
    } catch (err) {
      console.error("Failed to remove branch override", err);
      setMessage(err.response?.data?.message || "Failed to remove branch override");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setSavingOverride(false);
    }
  };

  const buildOverrideMatrixInitial = (matrixPayload) => {
    const initial = {};
    const branchesList = Array.isArray(matrixPayload?.branches) ? matrixPayload.branches : [];
    const productsList = Array.isArray(matrixPayload?.products) ? matrixPayload.products : [];

    for (const product of productsList) {
      const baseActive = product?.base_active === true;
      for (const branch of branchesList) {
        const branchId = Number(branch?.id);
        if (!Number.isFinite(branchId)) {
          continue;
        }
        const key = `${product.product_id}:${branchId}`;
        const cell = product?.overrides?.[String(branchId)] || {};
        initial[key] = {
          has_override: cell?.has_override === true,
          base_active: baseActive,
          price_override:
            cell?.price_override === null || cell?.price_override === undefined
              ? ""
              : String(cell.price_override),
          is_active:
            cell?.effective_active === undefined || cell?.effective_active === null
              ? baseActive
              : cell.effective_active === true,
        };
      }
    }
    return initial;
  };

  const loadOverrideMatrix = async () => {
    setOverrideMatrixLoading(true);
    try {
      const { data } = await api.get("/branches/product-overrides/matrix");
      const safeMatrix = {
        branches: Array.isArray(data?.branches) ? data.branches : [],
        products: Array.isArray(data?.products) ? data.products : [],
      };
      setOverrideMatrix(safeMatrix);
      setOverrideMatrixInitial(buildOverrideMatrixInitial(safeMatrix));
      setOverrideMatrixDraft({});
    } catch (err) {
      console.error("Failed to load override matrix", err);
      setOverrideMatrix({ branches: [], products: [] });
      setOverrideMatrixInitial({});
      setOverrideMatrixDraft({});
      setMessage(err.response?.data?.message || "Failed to load branch override matrix");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setOverrideMatrixLoading(false);
    }
  };

  const openOverrideMatrixModal = async () => {
    setShowOverrideMatrixModal(true);
    setOverrideMatrixSearch("");
    await loadOverrideMatrix();
  };

  const closeOverrideMatrixModal = () => {
    setShowOverrideMatrixModal(false);
    setOverrideMatrixDraft({});
    setOverrideMatrixSearch("");
    setOverrideMatrixSaving(false);
  };

  const getMatrixCellState = (product, branchId) => {
    const baseKey = `${product.product_id}:${branchId}`;
    const base = overrideMatrixInitial[baseKey] || {
      has_override: false,
      base_active: product?.base_active === true,
      price_override: "",
      is_active: product?.base_active === true,
    };
    const draft = overrideMatrixDraft[baseKey];
    const current = draft ? { ...base, ...draft } : base;
    return {
      key: baseKey,
      base,
      current,
      dirty: Boolean(draft),
    };
  };

  const updateOverrideMatrixCell = (product, branchId, patch) => {
    setOverrideMatrixDraft((prev) => {
      const key = `${product.product_id}:${branchId}`;
      const base = overrideMatrixInitial[key] || {
        has_override: false,
        base_active: product?.base_active === true,
        price_override: "",
        is_active: product?.base_active === true,
      };
      const current = prev[key] ? { ...base, ...prev[key] } : base;
      const next = {
        ...current,
        ...patch,
        price_override: patch.price_override ?? current.price_override ?? "",
      };
      const normalize = (value) => String(value ?? "").trim();
      const samePrice = normalize(next.price_override) === normalize(base.price_override);
      const sameActive = Boolean(next.is_active) === Boolean(base.is_active);

      const nextDraft = { ...prev };
      if (samePrice && sameActive) {
        delete nextDraft[key];
      } else {
        nextDraft[key] = {
          price_override: next.price_override,
          is_active: next.is_active === true,
        };
      }
      return nextDraft;
    });
  };

  const resetOverrideMatrixCell = (product, branchId) => {
    const key = `${product.product_id}:${branchId}`;
    setOverrideMatrixDraft((prev) => {
      if (!prev[key]) {
        return prev;
      }
      const nextDraft = { ...prev };
      delete nextDraft[key];
      return nextDraft;
    });
  };

  const saveOverrideMatrix = async () => {
    const dirtyKeys = Object.keys(overrideMatrixDraft);
    if (dirtyKeys.length === 0) {
      setMessage("No matrix changes to save");
      setTimeout(() => setMessage(""), 2200);
      return;
    }

    const updates = [];
    for (const key of dirtyKeys) {
      const [productId, branchIdRaw] = key.split(":");
      const branchId = Number(branchIdRaw);
      const base = overrideMatrixInitial[key];
      const draft = overrideMatrixDraft[key];
      if (!productId || !Number.isFinite(branchId) || !base || !draft) {
        continue;
      }

      const priceRaw = String(draft.price_override ?? "").trim();
      let priceValue = null;
      if (priceRaw.length > 0) {
        priceValue = Number.parseFloat(priceRaw);
        if (!Number.isFinite(priceValue) || priceValue < 0) {
          setMessage(`Invalid override price for product #${productId} / branch #${branchId}`);
          setTimeout(() => setMessage(""), 3200);
          return;
        }
      }

      const currentActive = draft.is_active === true;
      const sameAsBase = priceRaw.length === 0 && currentActive === (base.base_active === true);
      if (sameAsBase) {
        if (base.has_override === true) {
          updates.push({
            branch_id: branchId,
            product_id: productId,
            delete_override: true,
          });
        }
        continue;
      }

      updates.push({
        branch_id: branchId,
        product_id: productId,
        is_active: currentActive,
        clear_override: priceRaw.length === 0,
        price_override: priceRaw.length === 0 ? null : priceValue,
      });
    }

    if (updates.length === 0) {
      setMessage("No effective override changes to save");
      setTimeout(() => setMessage(""), 2200);
      return;
    }

    setOverrideMatrixSaving(true);
    try {
      await api.put("/branches/product-overrides/matrix", { updates });
      await loadProducts();
      await loadOverrideMatrix();
      markProductsUpdated();
      setMessage("Branch override matrix saved");
      setTimeout(() => setMessage(""), 2500);
    } catch (err) {
      console.error("Failed to save override matrix", err);
      setMessage(err.response?.data?.message || "Failed to save branch override matrix");
      setTimeout(() => setMessage(""), 3200);
    } finally {
      setOverrideMatrixSaving(false);
    }
  };

  const filteredOverrideMatrixProducts = useMemo(() => {
    const search = String(overrideMatrixSearch || "").trim().toLowerCase();
    const productsList = Array.isArray(overrideMatrix.products) ? overrideMatrix.products : [];
    if (!search) {
      return productsList;
    }
    return productsList.filter((product) => {
      const name = String(product?.name || "").toLowerCase();
      const category = String(product?.category || "").toLowerCase();
      return name.includes(search) || category.includes(search);
    });
  }, [overrideMatrix.products, overrideMatrixSearch]);

  const formatCurrency = (amount) => {
    const safeAmount = Number.isFinite(parseFloat(amount)) ? parseFloat(amount) : 0;
    return `Rs. ${safeAmount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const matrixDirtyCount = Object.keys(overrideMatrixDraft).length;
  const matrixBranches = Array.isArray(overrideMatrix.branches) ? overrideMatrix.branches : [];

  return (
    <div className="cv-page cv-page--products p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="cv-page-header flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="cv-page-title text-3xl font-bold text-gray-900">Products (Menu)</h1>
            <p className="cv-page-subtitle text-gray-600 mt-1">Manage your menu items and pricing</p>
            <div className="mt-2 text-xs font-semibold text-blue-700">
              Branch context:{" "}
              {activeBranchId
                ? branches.find((row) => Number(row.id) === Number(activeBranchId))?.name || `Branch #${activeBranchId}`
                : "No branch selected"}
            </div>
          </div>
          <div className="cv-products-header-actions flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openOverrideMatrixModal}
              className="px-4 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-md flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16M8 4v16M16 4v16"
                />
              </svg>
              Branch Matrix
            </button>
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
        </div>

        {/* Filters */}
        <div className="cv-products-filter-bar bg-white rounded-xl shadow-md p-4 mb-6 border border-gray-200">
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
        <div className="cv-table-card bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="cv-table-wrap overflow-x-auto">
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
                          {formatCurrency(
                            product.effective_price !== undefined && product.effective_price !== null
                              ? product.effective_price
                              : product.price
                          )}
                        </span>
                        {product.price_override !== undefined && product.price_override !== null && (
                          <div className="text-[11px] text-blue-600 font-semibold mt-1">
                            Base {formatCurrency(product.price)}  -  Override applied
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => toggleStatus(product)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            (product.effective_active ?? product.is_active)
                              ? "bg-green-100 text-green-800 hover:bg-green-200"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {(product.effective_active ?? product.is_active) ? "Active" : "Inactive"}
                        </button>
                        {product.branch_is_active !== undefined && product.branch_is_active !== null && (
                          <div className="text-[11px] text-blue-600 font-semibold mt-1">
                            Branch override status
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openBranchOverrideModal(product)}
                            className="px-2.5 py-2 text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors text-xs font-semibold border border-indigo-100"
                            title="Branch-specific override"
                          >
                            Branch
                          </button>
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
        <div className="cv-products-stats-grid mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Total Products</div>
            <div className="text-2xl font-bold text-gray-900">{products.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Active Products</div>
            <div className="text-2xl font-bold text-green-600">
              {products.filter((p) => (p.effective_active ?? p.is_active)).length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Categories</div>
            <div className="text-2xl font-bold text-blue-600">
              {new Set(products.map((p) => p.category).filter(Boolean)).size}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Branch Overrides</div>
            <div className="text-2xl font-bold text-indigo-600">
              {
                products.filter(
                  (p) =>
                    (p.price_override !== null && p.price_override !== undefined) ||
                    (p.branch_is_active !== null && p.branch_is_active !== undefined)
                ).length
              }
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

      {showOverrideMatrixModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-[95vw] max-h-[92vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Branch Override Matrix</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Bulk edit product price/active overrides across all branches
                </p>
              </div>
              <div className="flex items-center gap-2">
                {matrixDirtyCount > 0 && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                    {matrixDirtyCount} unsaved
                  </span>
                )}
                <button
                  type="button"
                  onClick={closeOverrideMatrixModal}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  {"\u00D7"}
                </button>
              </div>
            </div>

            <div className="px-6 py-3 border-b border-gray-200 bg-gray-50 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <input
                type="text"
                value={overrideMatrixSearch}
                onChange={(e) => setOverrideMatrixSearch(e.target.value)}
                placeholder="Search product in matrix..."
                className="w-full md:max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={loadOverrideMatrix}
                disabled={overrideMatrixLoading}
                className={`px-3 py-2 rounded-lg text-xs font-semibold ${
                  overrideMatrixLoading
                    ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                    : "bg-gray-700 text-white hover:bg-gray-800"
                }`}
              >
                {overrideMatrixLoading ? "Refreshing..." : "Refresh Matrix"}
              </button>
            </div>

            <div className="flex-1 overflow-auto">
              {overrideMatrixLoading ? (
                <div className="py-16 text-center text-gray-500">Loading branch matrix...</div>
              ) : filteredOverrideMatrixProducts.length === 0 ? (
                <div className="py-16 text-center text-gray-500">
                  No products found for the current matrix filter
                </div>
              ) : (
                <div className="min-w-full">
                  <table className="min-w-[980px] w-full text-xs">
                    <thead className="sticky top-0 z-10 bg-gray-100 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 uppercase tracking-wide">
                          Product
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 uppercase tracking-wide">
                          Category
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 uppercase tracking-wide">
                          Base
                        </th>
                        {matrixBranches.map((branch) => (
                          <th
                            key={`matrix-branch-${branch.id}`}
                            className="px-3 py-3 text-left font-semibold text-gray-700 uppercase tracking-wide min-w-[220px]"
                          >
                            {branch.code || `B${branch.id}`}  -  {branch.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredOverrideMatrixProducts.map((product) => (
                        <tr key={product.product_id} className="align-top hover:bg-gray-50/70">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-900">{product.name}</div>
                            <div className="text-[11px] text-gray-500 mt-1">ID: {product.product_id}</div>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{product.category || "-"}</td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-900">
                              {formatCurrency(product.base_price)}
                            </div>
                            <div className="text-[11px] mt-1">
                              {product.base_active ? (
                                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold">
                                  Base Active
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-700 font-semibold">
                                  Base Inactive
                                </span>
                              )}
                            </div>
                          </td>
                          {matrixBranches.map((branch) => {
                            const branchId = Number(branch.id);
                            const cell = getMatrixCellState(product, branchId);
                            return (
                              <td key={`${product.product_id}:${branchId}`} className="px-3 py-3">
                                <div
                                  className={`p-2 rounded-lg border space-y-2 ${
                                    cell.dirty
                                      ? "border-amber-300 bg-amber-50"
                                      : "border-gray-200 bg-white"
                                  }`}
                                >
                                  <div>
                                    <div className="text-[10px] text-gray-500 mb-1">Price Override</div>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={cell.current.price_override}
                                      onChange={(e) =>
                                        updateOverrideMatrixCell(product, branchId, {
                                          price_override: e.target.value,
                                        })
                                      }
                                      placeholder="Base price"
                                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                  </div>
                                  <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-700">
                                    <input
                                      type="checkbox"
                                      checked={cell.current.is_active === true}
                                      onChange={(e) =>
                                        updateOverrideMatrixCell(product, branchId, {
                                          is_active: e.target.checked,
                                        })
                                      }
                                      className="h-3.5 w-3.5"
                                    />
                                    Active in this branch
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => resetOverrideMatrixCell(product, branchId)}
                                    disabled={!cell.dirty}
                                    className={`w-full px-2 py-1.5 rounded text-[11px] font-semibold ${
                                      cell.dirty
                                        ? "bg-gray-700 text-white hover:bg-gray-800"
                                        : "bg-gray-200 text-gray-500 cursor-not-allowed"
                                    }`}
                                  >
                                    Reset Cell
                                  </button>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-white flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-gray-600">
                {matrixDirtyCount > 0
                  ? `${matrixDirtyCount} changes pending`
                  : "No unsaved matrix changes"}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeOverrideMatrixModal}
                  className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => setOverrideMatrixDraft({})}
                  disabled={matrixDirtyCount === 0 || overrideMatrixSaving}
                  className={`px-4 py-2 rounded-lg font-semibold ${
                    matrixDirtyCount === 0 || overrideMatrixSaving
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : "bg-gray-700 text-white hover:bg-gray-800"
                  }`}
                >
                  Discard Draft
                </button>
                <button
                  type="button"
                  onClick={saveOverrideMatrix}
                  disabled={matrixDirtyCount === 0 || overrideMatrixSaving}
                  className={`px-5 py-2 rounded-lg font-semibold ${
                    matrixDirtyCount === 0 || overrideMatrixSaving
                      ? "bg-indigo-300 text-white cursor-not-allowed"
                      : "bg-indigo-600 text-white hover:bg-indigo-700"
                  }`}
                >
                  {overrideMatrixSaving ? "Saving..." : `Save ${matrixDirtyCount} Changes`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBranchOverrideModal && overrideProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Branch Override</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {overrideProduct.name}  -  Branch #{activeBranchId}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeBranchOverrideModal}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  x
                </button>
              </div>

              <form onSubmit={saveBranchOverride} className="space-y-5">
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <div className="text-xs text-gray-500">Base Product Price</div>
                  <div className="text-lg font-bold text-gray-900 mt-1">
                    {formatCurrency(overrideProduct.price)}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Use Price Override</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Set branch-specific selling price
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={branchOverrideForm.has_price_override}
                    onChange={(e) =>
                      setBranchOverrideForm((prev) => ({
                        ...prev,
                        has_price_override: e.target.checked,
                      }))
                    }
                    className="h-4 w-4"
                  />
                </div>

                {branchOverrideForm.has_price_override && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Override Price (Rs.)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={branchOverrideForm.price_override}
                      onChange={(e) =>
                        setBranchOverrideForm((prev) => ({
                          ...prev,
                          price_override: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                      required
                    />
                  </div>
                )}

                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Branch Active Status</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Enable/disable this product for the selected branch
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={branchOverrideForm.is_active}
                    onChange={(e) =>
                      setBranchOverrideForm((prev) => ({
                        ...prev,
                        is_active: e.target.checked,
                      }))
                    }
                    className="h-4 w-4"
                  />
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={closeBranchOverrideModal}
                    className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={clearBranchOverride}
                    disabled={savingOverride}
                    className={`px-4 py-3 rounded-lg font-semibold transition-colors ${
                      savingOverride
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                        : "bg-gray-700 text-white hover:bg-gray-800"
                    }`}
                  >
                    Remove Override
                  </button>
                  <button
                    type="submit"
                    disabled={savingOverride}
                    className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-colors shadow-md ${
                      savingOverride
                        ? "bg-blue-300 text-white cursor-not-allowed"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {savingOverride ? "Saving..." : "Save Override"}
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

