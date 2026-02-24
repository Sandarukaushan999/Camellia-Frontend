import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  XMarkIcon,
  BuildingStorefrontIcon,
  CurrencyDollarIcon,
  PrinterIcon,
  AdjustmentsHorizontalIcon,
  CloudArrowDownIcon,
  CloudArrowUpIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../state/AuthContext.jsx";
import { adminAPI, triggerDownload } from "../services/adminAPI.js";

export function Footer() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const restoreInputRef = useRef(null);
  const resetCodeInputRef = useRef(null);

  const [showSettings, setShowSettings] = useState(false);
  const [settingsMounted, setSettingsMounted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adminBusy, setAdminBusy] = useState(null);
  const [showResetCodeField, setShowResetCodeField] = useState(false);
  const [resetSecretCode, setResetSecretCode] = useState("");

  const whatsappNumber = "94710901871";
  const whatsappUrl = `https://wa.me/${whatsappNumber}`;
  const email = "voxosolution@gmail.com";
  const isAdmin = String(user?.role || "").toUpperCase() === "ADMIN";

  useEffect(() => {
    let openTimer;
    let closeTimer;

    if (showSettings) {
      setSettingsMounted(true);
      openTimer = setTimeout(() => setSettingsOpen(true), 20);
    } else {
      setSettingsOpen(false);
      closeTimer = setTimeout(() => setSettingsMounted(false), 300);
      setShowResetCodeField(false);
      setResetSecretCode("");
    }

    return () => {
      if (openTimer) {
        clearTimeout(openTimer);
      }
      if (closeTimer) {
        clearTimeout(closeTimer);
      }
    };
  }, [showSettings]);

  useEffect(() => {
    if (!showResetCodeField) {
      return;
    }
    const timer = setTimeout(() => resetCodeInputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [showResetCodeField]);

  return (
    <footer className="bg-gray-900 border-t border-gray-700">
      <div className="max-w-7xl mx-auto px-3 py-2">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
          <div className="text-gray-300 text-center md:text-left">
            (c) 2026 <span className="font-semibold text-white">VOXOsolution</span>. All rights
            reserved
          </div>

          <div className="flex items-center gap-5">
            <a
              href={`mailto:${email}`}
              className="p-2 rounded-full text-gray-300 hover:text-white hover:bg-gray-800 transition"
              aria-label="Email VOXOsolution"
            >
              <EnvelopeIcon className="w-5 h-5" />
            </a>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-full text-gray-300 hover:text-white hover:bg-gray-800 transition"
                aria-label="Open admin settings"
              >
                <Cog6ToothIcon className="w-5 h-5" />
              </button>
            )}

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-full text-gray-300 hover:text-white hover:bg-gray-800 transition"
              aria-label="Open WhatsApp support"
            >
              <ChatBubbleLeftRightIcon className="w-5 h-5" />
            </a>
          </div>

          <div className="text-gray-400 text-center md:text-right">
            Powered by <span className="font-medium text-gray-200">VOXOsolution</span>
          </div>
        </div>
      </div>

      {settingsMounted && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity ${
              settingsOpen ? "opacity-100" : "opacity-0"
            }`}
            onClick={() => setShowSettings(false)}
          />

          <div
            className={`relative w-full sm:max-w-[520px] bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl
            transform transition-all duration-300 ${
              settingsOpen ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
            }`}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-blue-600 to-blue-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Cog6ToothIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">Settings</h2>
                  <p className="text-blue-100 text-xs">System configuration</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="text-white"
                aria-label="Close settings"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-6 max-h-[65vh] overflow-y-auto">
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">
                  Application Settings
                </h3>

                <div className="space-y-3">
                  <SettingItem
                    icon={<BuildingStorefrontIcon className="w-6 h-6 text-blue-600" />}
                    title="Shop & Branch"
                    desc="Name, address and branch details"
                    onClick={() => {
                      setShowSettings(false);
                      navigate("/settings?section=shop");
                    }}
                  />

                  <SettingItem
                    icon={<CurrencyDollarIcon className="w-6 h-6 text-emerald-600" />}
                    title="Tax & Service"
                    desc="Charges, tax and billing rules"
                    onClick={() => {
                      setShowSettings(false);
                      navigate("/settings?section=tax");
                    }}
                  />

                  <SettingItem
                    icon={<PrinterIcon className="w-6 h-6 text-indigo-600" />}
                    title="Printers"
                    desc="Printer and device settings"
                    onClick={() => {
                      setShowSettings(false);
                      navigate("/settings?section=printer");
                    }}
                  />

                  <SettingItem
                    icon={<AdjustmentsHorizontalIcon className="w-6 h-6 text-violet-600" />}
                    title="Preferences"
                    desc="POS startup and system defaults"
                    onClick={() => {
                      setShowSettings(false);
                      navigate("/settings?section=preferences");
                    }}
                  />
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">
                  System Administration
                </h3>

                <div
                  className={`p-3 rounded-xl border flex items-center gap-2 ${
                    isAdmin ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"
                  }`}
                >
                  <ShieldCheckIcon
                    className={`w-5 h-5 ${isAdmin ? "text-green-600" : "text-yellow-600"}`}
                  />
                  <span className="text-sm font-medium">
                    {isAdmin ? "Admin Access Enabled" : "Admin access required"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <AdminAction
                    icon={<CloudArrowDownIcon className="w-6 h-6 text-blue-600" />}
                    label="Backup CSV"
                    disabled={!isAdmin || adminBusy !== null}
                    onClick={async () => {
                      try {
                        setAdminBusy("backup");
                        const { blob, fileName } = await adminAPI.downloadBackup();
                        triggerDownload(blob, fileName);
                      } catch (error) {
                        window.alert(error?.response?.data?.message || "Backup download failed.");
                      } finally {
                        setAdminBusy(null);
                      }
                    }}
                  />

                  <AdminAction
                    icon={<CloudArrowUpIcon className="w-6 h-6 text-sky-600" />}
                    label="Restore CSV"
                    disabled={!isAdmin || adminBusy !== null}
                    onClick={() => restoreInputRef.current?.click()}
                  />
                </div>

                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-2xl">
                  <div className="flex gap-2 text-red-700">
                    <ExclamationTriangleIcon className="w-5 h-5" />
                    <div>
                      <p className="font-semibold text-sm">Danger Zone</p>
                      <p className="text-xs">
                        This will delete business data and keep user account access.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!isAdmin || adminBusy !== null}
                    onClick={async () => {
                      const shouldBackup = window.confirm(
                        "Please backup before reset.\n\nClick OK to backup now.\nClick Cancel to skip backup and continue to secret code."
                      );

                      if (shouldBackup) {
                        try {
                          setAdminBusy("backup");
                          const { blob, fileName } = await adminAPI.downloadBackup();
                          triggerDownload(blob, fileName);
                        } catch (error) {
                          window.alert(
                            error?.response?.data?.message ||
                              "Backup download failed. Retry or continue without backup."
                          );
                          return;
                        } finally {
                          setAdminBusy(null);
                        }
                      }

                      setShowResetCodeField(true);
                    }}
                    className="mt-4 w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition disabled:opacity-50"
                  >
                    Reset System
                  </button>

                  {showResetCodeField && (
                    <div className="mt-4 space-y-3">
                      <label className="block text-xs font-semibold text-red-800 uppercase tracking-wide">
                        Reset Secret Code
                      </label>
                      <input
                        ref={resetCodeInputRef}
                        type="password"
                        value={resetSecretCode}
                        onChange={(event) => setResetSecretCode(event.target.value)}
                        placeholder="Enter reset secret code"
                        className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                      <button
                        type="button"
                        disabled={!isAdmin || adminBusy !== null || !resetSecretCode.trim()}
                        onClick={async () => {
                          try {
                            setAdminBusy("reset");
                            await adminAPI.resetSystem(resetSecretCode.trim());
                            logout();
                            window.location.href = "/login";
                          } catch (error) {
                            window.alert(
                              error?.response?.data?.message ||
                                "Reset failed. Check secret code and try again."
                            );
                          } finally {
                            setAdminBusy(null);
                          }
                        }}
                        className="w-full py-2.5 bg-red-700 hover:bg-red-800 text-white rounded-lg font-semibold transition disabled:opacity-50"
                      >
                        Confirm Reset
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <input
              ref={restoreInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";

                if (!file) {
                  return;
                }

                const restoreConfirmed = window.confirm(
                  `Restore full system from CSV backup: ${file.name}?`
                );
                if (!restoreConfirmed) {
                  return;
                }

                try {
                  setAdminBusy("restore");
                  await adminAPI.restoreFromBackup(file);
                  logout();
                  window.location.href = "/login";
                } catch (error) {
                  window.alert(
                    error?.response?.data?.message ||
                      "Restore failed. Please use a valid CSV backup downloaded from this system."
                  );
                } finally {
                  setAdminBusy(null);
                }
              }}
            />
          </div>
        </div>
      )}
    </footer>
  );
}

const SettingItem = ({ icon, title, desc, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center gap-4 p-4 bg-white border rounded-2xl hover:shadow-md transition"
  >
    <div className="p-3 bg-gray-100 rounded-xl">{icon}</div>
    <div className="text-left flex-1">
      <p className="font-semibold text-gray-900">{title}</p>
      <p className="text-xs text-gray-500">{desc}</p>
    </div>
  </button>
);

const AdminAction = ({ icon, label, onClick, disabled }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="p-4 border rounded-2xl bg-white hover:shadow-md transition disabled:opacity-50"
  >
    <div className="flex justify-center">{icon}</div>
    <p className="mt-2 text-sm font-medium text-center">{label}</p>
  </button>
);
