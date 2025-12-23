import React, { useEffect, useState } from "react";
import api from "../utils/api.js";

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/admin/products");
      setItems(data);
    } catch (err) {
      console.error("Failed to load inventory", err);
      setItems([]);
      setMessage("Failed to load inventory");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateStock = async (item, newStock) => {
    const value = parseInt(newStock, 10);
    if (isNaN(value) || value < 0) return;
    try {
      await api.put(`/admin/products/${item.id}`, {
        name: item.name,
        price: item.price,
        category: item.category,
        is_active: item.is_active,
        stock: value,
      });
      setItems((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, stock: value } : p))
      );
      setMessage("Stock updated");
      setTimeout(() => setMessage(""), 2000);
    } catch (err) {
      console.error("Failed to update stock", err);
      setMessage("Failed to update stock");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
            <p className="text-sm text-gray-600">
              Track and adjust stock levels for each menu item
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left">Product</th>
                  <th className="px-4 py-2 text-left">Category</th>
                  <th className="px-4 py-2 text-right">Price (Rs.)</th>
                  <th className="px-4 py-2 text-center">Stock</th>
                  <th className="px-4 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-gray-400"
                    >
                      Loading inventory...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-gray-400"
                    >
                      No products found
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-4 py-2 font-medium text-gray-900">
                        {item.name}
                      </td>
                      <td className="px-4 py-2 text-gray-700">
                        {item.category || "-"}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-800">
                        {parseFloat(item.price || 0).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <input
                          type="number"
                          min="0"
                          value={item.stock ?? 0}
                          onChange={(e) => updateStock(item, e.target.value)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        {item.is_active ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700">
                            Inactive
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {message && (
          <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}





