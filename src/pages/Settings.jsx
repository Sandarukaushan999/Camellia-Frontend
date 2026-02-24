import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../utils/api.js";

const SETTINGS_SECTIONS = [
  { id: "shop", label: "Shop & Branch Info", icon: "SHOP" },
  { id: "tax", label: "Tax & Service Charges", icon: "TAX" },
  { id: "printer", label: "Printer & Devices", icon: "PRINT" },
  { id: "backup", label: "Backup & Restore", icon: "BACKUP" },
  { id: "security", label: "Security & Access", icon: "SEC" },
  { id: "preferences", label: "System Preferences", icon: "PREF" },
];

const DEFAULT_PRINTER_SETTINGS = {
  printerType: "thermal",
  paperSize: "80mm",
  autoPrint: true,
  printMode: "ESC_POS_TCP",
  model: "XPrinter XP-K200L",
  host: "",
  port: 9100,
  charsPerLine: 48,
  timeoutMs: 4000,
};

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const validSectionIds = useMemo(
    () => new Set(SETTINGS_SECTIONS.map((section) => section.id)),
    []
  );
  const sectionFromQuery = searchParams.get("section");
  const [activeSection, setActiveSection] = useState(
    validSectionIds.has(sectionFromQuery) ? sectionFromQuery : "shop"
  );
  const [message, setMessage] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const nextSection = searchParams.get("section");
    if (validSectionIds.has(nextSection)) {
      setActiveSection(nextSection);
    }
  }, [searchParams, validSectionIds]);

  const handleSectionChange = (sectionId) => {
    setActiveSection(sectionId);
    setSearchParams({ section: sectionId }, { replace: true });
  };

  // Shop Info State
  const [shopInfo, setShopInfo] = useState(() => {
    // Load saved shop info from localStorage if available
    try {
      const saved = localStorage.getItem("cv_shop_info");
      if (saved) {
        return {
          name: "Camellia Cafe & Restaurant",
          address: "",
          phone: "",
          email: "",
          currency: "LKR",
          ...JSON.parse(saved),
        };
      }
    } catch {
      // ignore parse errors and fall back to defaults
    }
    return {
      name: "Camellia Cafe & Restaurant",
      address: "",
      phone: "",
      email: "",
      currency: "LKR",
    };
  });

  // Tax & Service State
  const [taxSettings, setTaxSettings] = useState(() => {
    // Load saved tax settings from localStorage if available
    try {
      const saved = localStorage.getItem("cv_tax_settings");
      if (saved) {
        return { enableTax: true, enableService: true, roundTotal: false, ...JSON.parse(saved) };
      }
    } catch {
      // ignore parse errors and fall back to defaults
    }
    return {
      enableTax: true,
      taxPercentage: 2,
      enableService: true,
      serviceCharge: 5,
      roundTotal: false,
    };
  });

  // Printer Settings
  const [printerSettings, setPrinterSettings] = useState(() => {
    try {
      const saved = localStorage.getItem("cv_printer_settings");
      if (saved) {
        return { ...DEFAULT_PRINTER_SETTINGS, ...JSON.parse(saved) };
      }
    } catch {
      // ignore parse errors
    }
    return { ...DEFAULT_PRINTER_SETTINGS };
  });

  // System Preferences
  const [preferences, setPreferences] = useState(() => {
    try {
      const saved = localStorage.getItem("cv_system_prefs");
      if (saved) {
        return {
          defaultOrderType: "DINE-IN",
          openPOSOnStart: true,
          enableSound: true,
          touchMode: true,
          language: "English",
          theme: "Light",
          ...JSON.parse(saved),
        };
      }
    } catch {
      // ignore parse errors
    }
    return {
      defaultOrderType: "DINE-IN",
      openPOSOnStart: true,
      enableSound: true,
      touchMode: true,
      language: "English",
      theme: "Light",
    };
  });

  const [backupFile, setBackupFile] = useState(null);

  const handleSave = async () => {
    // Persist shop info so receipts, POS and reports can use them
    try {
      localStorage.setItem("cv_shop_info", JSON.stringify(shopInfo));
      localStorage.setItem("cv_shop_info_updated_at", String(Date.now()));
    } catch {
      // ignore storage errors
    }

    // Persist tax & service settings so POS billing can use them
    try {
      localStorage.setItem("cv_tax_settings", JSON.stringify(taxSettings));
      localStorage.setItem("cv_tax_settings_updated_at", String(Date.now()));
    } catch {
      // ignore storage errors
    }

    // Persist system preferences (order type, open POS on start, sound, touch mode, etc.)
    try {
      localStorage.setItem("cv_system_prefs", JSON.stringify(preferences));
      localStorage.setItem("cv_system_prefs_updated_at", String(Date.now()));
    } catch {
      // ignore storage errors
    }

    // Persist printer settings used by POS checkout
    try {
      localStorage.setItem("cv_printer_settings", JSON.stringify(printerSettings));
      localStorage.setItem("cv_printer_settings_updated_at", String(Date.now()));
    } catch {
      // ignore storage errors
    }

    setMessage("Settings saved successfully");
    setHasChanges(false);
    setTimeout(() => setMessage(""), 3000);
    // In production, also save to backend
  };

  const handleBackup = async () => {
    try {
      const { data } = await api.post("/admin/backup");
      setMessage(data.message || "Backup created successfully");
      setTimeout(() => setMessage(""), 3000);
    } catch {
      setMessage("Backup failed");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleRestore = async () => {
    if (!backupFile) {
      setMessage("Please select a backup file first");
      return;
    }

    if (!window.confirm("Are you sure you want to restore? This will overwrite current data.")) {
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", backupFile);
      const { data } = await api.post("/admin/restore", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage(data.message || "Restore completed successfully");
      setTimeout(() => setMessage(""), 3000);
    } catch {
      setMessage("Restore failed");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleTestPrint = async () => {
    if (printerSettings.printMode !== "ESC_POS_TCP") {
      setMessage("Print mode is Browser. Switch to ESC/POS TCP for direct thermal print.");
      setTimeout(() => setMessage(""), 3500);
      return;
    }

    const printerHost = String(printerSettings.host || "").trim();
    if (!printerHost) {
      setMessage("Printer host/IP is required for ESC/POS TCP mode.");
      setTimeout(() => setMessage(""), 3500);
      return;
    }

    try {
      const now = new Date();
      await api.post("/printing/escpos", {
        printer: {
          host: printerHost,
          port: Number(printerSettings.port) || 9100,
          paperSize: printerSettings.paperSize || "80mm",
          charsPerLine: Number(printerSettings.charsPerLine) || 48,
          timeoutMs: Number(printerSettings.timeoutMs) || 4000,
        },
        receipt: {
          billNo: "TEST",
          date: now.toISOString().slice(0, 10),
          time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
          orderType: "DINE-IN",
          tableNumber: "T1",
          customerName: "Printer Test",
          cashier: "SYSTEM",
          items: [
            { name: "Printer Alignment Test", qty: 1, price: 100 },
            { name: "Speed Test Line", qty: 2, price: 50 },
          ],
          subtotal: 200,
          serviceCharge: 0,
          tax: 0,
          discount: 0,
          total: 200,
          paymentMethod: "CASH",
          cashGiven: 500,
          balance: 300,
          shop: {
            name: shopInfo.name,
            address: shopInfo.address,
            phone: shopInfo.phone,
            email: shopInfo.email,
          },
        },
      });
      setMessage("Test receipt sent to ESC/POS printer");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessage(error?.response?.data?.message || "Test print failed");
      setTimeout(() => setMessage(""), 4000);
    }
  };

  const calculateExample = () => {
    const subtotal = 1000;
    const tax = taxSettings.enableTax ? subtotal * (taxSettings.taxPercentage / 100) : 0;
    const service = taxSettings.enableService ? subtotal * (taxSettings.serviceCharge / 100) : 0;
    let total = subtotal + tax + service;
    if (taxSettings.roundTotal) {
      total = Math.round(total);
    }
    return { subtotal, tax, service, total };
  };

  const example = calculateExample();

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-600 mt-1">Configure your POS system</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar - Section Selector */}
          <div className="lg:w-64 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-2">
              {SETTINGS_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  onClick={() => handleSectionChange(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all mb-1 ${
                    activeSection === section.id
                      ? "bg-blue-600 text-white shadow-md"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span className="text-base">{section.icon}</span>
                  <span className="text-left">{section.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Shop & Branch Info */}
            {activeSection === "shop" && (
              <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <span>SHOP</span> Shop & Branch Info
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Shop Name</label>
                    <input
                      type="text"
                      value={shopInfo.name}
                      onChange={(e) => {
                        setShopInfo({ ...shopInfo, name: e.target.value });
                        setHasChanges(true);
                      }}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                    <textarea
                      value={shopInfo.address}
                      onChange={(e) => {
                        setShopInfo({ ...shopInfo, address: e.target.value });
                        setHasChanges(true);
                      }}
                      rows={3}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter shop address"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                      <input
                        type="tel"
                        value={shopInfo.phone}
                        onChange={(e) => {
                          setShopInfo({ ...shopInfo, phone: e.target.value });
                          setHasChanges(true);
                        }}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                      <input
                        type="email"
                        value={shopInfo.email}
                        onChange={(e) => {
                          setShopInfo({ ...shopInfo, email: e.target.value });
                          setHasChanges(true);
                        }}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                    <select
                      value={shopInfo.currency}
                      onChange={(e) => {
                        setShopInfo({ ...shopInfo, currency: e.target.value });
                        setHasChanges(true);
                      }}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="LKR">LKR (Rs.)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (EUR)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Logo Upload</label>
                    <div className="flex items-center gap-4">
                      <input
                        type="file"
                        accept="image/*"
                        className="text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                      <span className="text-xs text-gray-500">Used in bills & reports</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tax & Service Charges */}
            {activeSection === "tax" && (
              <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <span>TAX</span> Tax & Service Charges
                </h2>
                <div className="space-y-6">
                  {/* Tax Settings */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900">Enable Tax</div>
                        <div className="text-xs text-gray-500 mt-1">Apply tax to all orders</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={taxSettings.enableTax}
                          onChange={(e) => {
                            setTaxSettings({ ...taxSettings, enableTax: e.target.checked });
                            setHasChanges(true);
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    {taxSettings.enableTax && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tax Percentage (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={taxSettings.taxPercentage}
                          onChange={(e) => {
                            setTaxSettings({ ...taxSettings, taxPercentage: parseFloat(e.target.value) || 0 });
                            setHasChanges(true);
                          }}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* Service Charge Settings */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900">Enable Service Charge</div>
                        <div className="text-xs text-gray-500 mt-1">Apply service charge to all orders</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={taxSettings.enableService}
                          onChange={(e) => {
                            setTaxSettings({ ...taxSettings, enableService: e.target.checked });
                            setHasChanges(true);
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    {taxSettings.enableService && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Service Charge (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={taxSettings.serviceCharge}
                          onChange={(e) => {
                            setTaxSettings({ ...taxSettings, serviceCharge: parseFloat(e.target.value) || 0 });
                            setHasChanges(true);
                          }}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* Round Total */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">Round Total</div>
                      <div className="text-xs text-gray-500 mt-1">Round final amount to nearest whole number</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={taxSettings.roundTotal}
                        onChange={(e) => {
                          setTaxSettings({ ...taxSettings, roundTotal: e.target.checked });
                          setHasChanges(true);
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {/* Preview Example */}
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-sm font-semibold text-gray-900 mb-3">Preview Example (Rs. 1,000 order)</div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Subtotal</span>
                        <span className="font-medium">Rs. {example.subtotal.toFixed(2)}</span>
                      </div>
                      {taxSettings.enableTax && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Tax ({taxSettings.taxPercentage}%)</span>
                          <span className="font-medium">Rs. {example.tax.toFixed(2)}</span>
                        </div>
                      )}
                      {taxSettings.enableService && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Service ({taxSettings.serviceCharge}%)</span>
                          <span className="font-medium">Rs. {example.service.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-2 border-t border-blue-300">
                        <span className="font-bold text-gray-900">Total</span>
                        <span className="font-bold text-blue-600">Rs. {example.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Printer & Devices */}
            {activeSection === "printer" && (
              <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <span>PRINT</span> Printer & Devices
                </h2>
                <div className="space-y-6">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-sm font-semibold text-blue-900">Recommended Model</div>
                    <div className="text-xs text-blue-700 mt-1">{printerSettings.model || "XPrinter XP-K200L"} (80mm)</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Print Mode</label>
                    <select
                      value={printerSettings.printMode}
                      onChange={(e) => {
                        setPrinterSettings((prev) => ({ ...prev, printMode: e.target.value }));
                        setHasChanges(true);
                      }}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ESC_POS_TCP">Direct ESC/POS (TCP)</option>
                      <option value="BROWSER_PRINT">Browser Print (Fallback)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Printer Type</label>
                    <select
                      value={printerSettings.printerType}
                      onChange={(e) => {
                        setPrinterSettings((prev) => ({ ...prev, printerType: e.target.value }));
                        setHasChanges(true);
                      }}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="thermal">Thermal</option>
                      <option value="inkjet">Inkjet</option>
                      <option value="dot-matrix">Dot Matrix</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Printer Host / IP</label>
                      <input
                        type="text"
                        value={printerSettings.host || ""}
                        onChange={(e) => {
                          setPrinterSettings((prev) => ({ ...prev, host: e.target.value }));
                          setHasChanges(true);
                        }}
                        placeholder="e.g. 192.168.1.90"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">TCP Port</label>
                      <input
                        type="number"
                        min="1"
                        max="65535"
                        value={printerSettings.port}
                        onChange={(e) => {
                          setPrinterSettings((prev) => ({ ...prev, port: e.target.value }));
                          setHasChanges(true);
                        }}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Paper Size</label>
                    <select
                      value={printerSettings.paperSize}
                      onChange={(e) => {
                        setPrinterSettings((prev) => ({ ...prev, paperSize: e.target.value }));
                        setHasChanges(true);
                      }}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="80mm">80mm</option>
                      <option value="58mm">58mm</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Characters / Line</label>
                      <input
                        type="number"
                        min="32"
                        max="56"
                        value={printerSettings.charsPerLine}
                        onChange={(e) => {
                          setPrinterSettings((prev) => ({ ...prev, charsPerLine: e.target.value }));
                          setHasChanges(true);
                        }}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Timeout (ms)</label>
                      <input
                        type="number"
                        min="1000"
                        max="15000"
                        value={printerSettings.timeoutMs}
                        onChange={(e) => {
                          setPrinterSettings((prev) => ({ ...prev, timeoutMs: e.target.value }));
                          setHasChanges(true);
                        }}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">Auto Print</div>
                      <div className="text-xs text-gray-500 mt-1">Automatically print receipt after payment</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={printerSettings.autoPrint}
                        onChange={(e) => {
                          setPrinterSettings((prev) => ({ ...prev, autoPrint: e.target.checked }));
                          setHasChanges(true);
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  {printerSettings.printMode === "BROWSER_PRINT" && (
                    <div className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      Browser mode uses window.print(). For fast direct thermal printing choose ESC/POS TCP.
                    </div>
                  )}
                  <div className="pt-4 border-t border-gray-200">
                    <button
                      onClick={handleTestPrint}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                    >
                      Print Test Receipt
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Backup & Restore */}
            {activeSection === "backup" && (
              <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <span>BACKUP</span> Backup & Restore
                </h2>
                <div className="space-y-6">
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="text-sm font-semibold text-yellow-800 mb-1">Important</div>
                    <div className="text-xs text-yellow-700">
                      Regular backups protect your data. Restore will overwrite current data.
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Backup Location</label>
                    <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>Local Drive</option>
                      <option>Cloud Storage (Coming Soon)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Auto Backup</label>
                    <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>Daily</option>
                      <option>Weekly</option>
                      <option>Monthly</option>
                      <option>Disabled</option>
                    </select>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Last Backup</div>
                    <div className="text-sm font-medium text-gray-900">Never</div>
                  </div>
                  <div className="flex gap-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={handleBackup}
                      className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                    >
                      Backup Now
                    </button>
                    <div className="flex-1">
                      <input
                        type="file"
                        accept=".sql,.backup"
                        onChange={(e) => setBackupFile(e.target.files?.[0])}
                        className="hidden"
                        id="restore-file"
                      />
                      <label
                        htmlFor="restore-file"
                        className="block w-full px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors text-center cursor-pointer"
                      >
                        Choose File
                      </label>
                      {backupFile && (
                        <div className="text-xs text-gray-600 mt-2 text-center">{backupFile.name}</div>
                      )}
                    </div>
                    <button
                      onClick={handleRestore}
                      disabled={!backupFile}
                      className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-colors ${
                        backupFile
                          ? "bg-green-600 text-white hover:bg-green-700"
                          : "bg-gray-300 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      Restore Backup
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Security & Access */}
            {activeSection === "security" && (
              <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <span>SEC</span> Security & Access
                </h2>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Password Length</label>
                    <input
                      type="number"
                      min="6"
                      max="20"
                      defaultValue={6}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Auto Logout (minutes)</label>
                    <input
                      type="number"
                      min="5"
                      max="60"
                      defaultValue={15}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Role Permissions (Read-only)</h3>
                    <div className="space-y-3">
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="font-medium text-gray-900">Cashier</div>
                        <div className="text-xs text-gray-600 mt-1">POS Billing only</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="font-medium text-gray-900">Admin</div>
                        <div className="text-xs text-gray-600 mt-1">Full system access</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* System Preferences */}
            {activeSection === "preferences" && (
              <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <span>PREF</span> System Preferences
                </h2>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Default Order Type</label>
                    <select
                      value={preferences.defaultOrderType}
                      onChange={(e) => {
                        setPreferences({ ...preferences, defaultOrderType: e.target.value });
                        setHasChanges(true);
                      }}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="DINE-IN">Dine-In</option>
                      <option value="TAKEAWAY">Takeaway</option>
                      <option value="DELIVERY">Delivery</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">Open POS on Start</div>
                      <div className="text-xs text-gray-500 mt-1">Automatically open POS screen on login</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.openPOSOnStart}
                        onChange={(e) => {
                          setPreferences({ ...preferences, openPOSOnStart: e.target.checked });
                          setHasChanges(true);
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">Enable Sound on Add</div>
                      <div className="text-xs text-gray-500 mt-1">Play sound when item added to cart</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.enableSound}
                        onChange={(e) => {
                          setPreferences({ ...preferences, enableSound: e.target.checked });
                          setHasChanges(true);
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">Touch Mode</div>
                      <div className="text-xs text-gray-500 mt-1">Optimize for touchscreen devices</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.touchMode}
                        onChange={(e) => {
                          setPreferences({ ...preferences, touchMode: e.target.checked });
                          setHasChanges(true);
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
                      <select
                        value={preferences.language}
                        onChange={(e) => {
                          setPreferences({ ...preferences, language: e.target.value });
                          setHasChanges(true);
                        }}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option>English</option>
                        <option>Sinhala</option>
                        <option>Tamil</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
                      <select
                        value={preferences.theme}
                        onChange={(e) => {
                          setPreferences({ ...preferences, theme: e.target.value });
                          setHasChanges(true);
                        }}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option>Light</option>
                        <option>Dark</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Save Button */}
            {hasChanges && (
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setHasChanges(false);
                    setMessage("Changes discarded");
                    setTimeout(() => setMessage(""), 3000);
                  }}
                  className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-md"
                >
                  Save Changes
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Success/Error Message */}
        {message && (
          <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-xl z-50">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
