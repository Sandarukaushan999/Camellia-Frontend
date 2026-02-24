import React, { useEffect, useMemo, useState } from "react";
import api from "../utils/api.js";

const TABS = ["customers", "segments", "campaigns", "loyalty", "followups"];

const emptyFilter = {
  segment: "ALL",
  min_orders: "",
  min_spent: "",
  last_order_before_days: "",
  tag_ids: [],
};

function money(v) {
  return `Rs. ${parseFloat(v || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dt(v) {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

function compactFilter(filter) {
  const payload = {};
  if (filter.segment && filter.segment !== "ALL") payload.segment = filter.segment;
  if (filter.min_orders !== "") payload.min_orders = Number(filter.min_orders);
  if (filter.min_spent !== "") payload.min_spent = Number(filter.min_spent);
  if (filter.last_order_before_days !== "") {
    payload.last_order_before_days = Number(filter.last_order_before_days);
  }
  if (filter.tag_ids?.length) payload.tag_ids = filter.tag_ids;
  return payload;
}

export default function CRM() {
  const [activeTab, setActiveTab] = useState("customers");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [customers, setCustomers] = useState([]);
  const [query, setQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [customerDetail, setCustomerDetail] = useState(null);
  const [newNote, setNewNote] = useState("");
  const [manualPoints, setManualPoints] = useState("");
  const [manualReason, setManualReason] = useState("MANUAL_ADJUSTMENT");

  const [tags, setTags] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [newTagName, setNewTagName] = useState("");

  const [segments, setSegments] = useState([]);
  const [segmentFilter, setSegmentFilter] = useState(emptyFilter);

  const [campaigns, setCampaigns] = useState([]);
  const [campaignForm, setCampaignForm] = useState({
    name: "",
    channel: "SMS",
    status: "DRAFT",
    message: "",
  });
  const [campaignFilter, setCampaignFilter] = useState(emptyFilter);
  const [audiencePreview, setAudiencePreview] = useState(null);

  const [retention, setRetention] = useState(null);

  const toast = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(""), 2500);
  };

  const loadCustomers = async (search = "") => {
    setLoading(true);
    try {
      const { data } = await api.get("/crm/customers", { params: { query: search } });
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast("Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerDetail = async (id) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/crm/customers/${id}`);
      setCustomerDetail(data);
      setSelectedCustomerId(id);
      setSelectedTagIds((data.tags || []).map((t) => t.id));
    } catch (err) {
      console.error(err);
      toast("Failed to load customer detail");
    } finally {
      setLoading(false);
    }
  };

  const loadTags = async () => {
    try {
      const { data } = await api.get("/crm/tags");
      setTags(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadSegments = async (filter = segmentFilter) => {
    setLoading(true);
    try {
      const params = compactFilter(filter);
      if (params.tag_ids) params.tag_ids = params.tag_ids.join(",");
      const { data } = await api.get("/crm/segments/rfm", { params });
      setSegments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast("Failed to load segments");
    } finally {
      setLoading(false);
    }
  };

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/crm/campaigns");
      setCampaigns(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast("Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  };

  const loadRetention = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/crm/reports/retention-ltv", { params: { days: 90 } });
      setRetention(data || null);
    } catch (err) {
      console.error(err);
      toast("Failed to load retention");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "customers" || activeTab === "followups" || activeTab === "loyalty") {
      const t = setTimeout(() => loadCustomers(query), 250);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [activeTab, query]);

  useEffect(() => {
    if (activeTab === "customers" || activeTab === "segments" || activeTab === "campaigns") {
      loadTags();
    }
    if (activeTab === "segments") loadSegments();
    if (activeTab === "campaigns") loadCampaigns();
    if (activeTab === "loyalty") loadRetention();
  }, [activeTab]);

  const topLoyalty = useMemo(
    () => [...customers].sort((a, b) => (b.loyalty_points || 0) - (a.loyalty_points || 0)).slice(0, 10),
    [customers]
  );

  const followups = useMemo(() => {
    const now = Date.now();
    return customers.filter((c) => {
      if (!c.last_order_at) return true;
      const t = new Date(c.last_order_at).getTime();
      if (Number.isNaN(t)) return true;
      return (now - t) / (1000 * 60 * 60 * 24) >= 30;
    });
  }, [customers]);

  const addNote = async () => {
    if (!customerDetail?.customer?.id || !newNote.trim()) return;
    setLoading(true);
    try {
      await api.post(`/crm/customers/${customerDetail.customer.id}/notes`, { note: newNote.trim() });
      setNewNote("");
      await loadCustomerDetail(customerDetail.customer.id);
      toast("Note added");
    } catch (err) {
      console.error(err);
      toast("Failed to add note");
    } finally {
      setLoading(false);
    }
  };

  const adjustLoyalty = async () => {
    if (!customerDetail?.customer?.id) return;
    const points = parseInt(manualPoints, 10);
    if (!Number.isFinite(points) || points === 0) return toast("Invalid points");
    setLoading(true);
    try {
      await api.post(`/crm/customers/${customerDetail.customer.id}/loyalty`, {
        points_change: points,
        reason: manualReason,
      });
      setManualPoints("");
      await loadCustomerDetail(customerDetail.customer.id);
      await loadCustomers(query);
      toast("Points updated");
    } catch (err) {
      console.error(err);
      toast("Failed to update points");
    } finally {
      setLoading(false);
    }
  };

  const saveCustomerTags = async () => {
    if (!customerDetail?.customer?.id) return;
    setLoading(true);
    try {
      await api.put(`/crm/customers/${customerDetail.customer.id}/tags`, { tag_ids: selectedTagIds });
      await loadCustomerDetail(customerDetail.customer.id);
      await loadTags();
      toast("Tags updated");
    } catch (err) {
      console.error(err);
      toast("Failed to save tags");
    } finally {
      setLoading(false);
    }
  };

  const createTag = async () => {
    if (!newTagName.trim()) return;
    setLoading(true);
    try {
      await api.post("/crm/tags", { name: newTagName.trim(), color: "blue" });
      setNewTagName("");
      await loadTags();
      toast("Tag created");
    } catch (err) {
      console.error(err);
      toast("Failed to create tag");
    } finally {
      setLoading(false);
    }
  };

  const previewAudience = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/crm/campaigns/audience-preview", {
        audience_filter: compactFilter(campaignFilter),
      });
      setAudiencePreview(data || null);
    } catch (err) {
      console.error(err);
      toast("Failed to preview audience");
    } finally {
      setLoading(false);
    }
  };

  const saveCampaign = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/crm/campaigns", {
        ...campaignForm,
        audience_filter: compactFilter(campaignFilter),
      });
      setCampaignForm({ name: "", channel: "SMS", status: "DRAFT", message: "" });
      setAudiencePreview(null);
      await loadCampaigns();
      toast("Campaign saved");
    } catch (err) {
      console.error(err);
      toast("Failed to save campaign");
    } finally {
      setLoading(false);
    }
  };

  const readMultiSelect = (event) =>
    [...event.target.selectedOptions]
      .map((o) => parseInt(o.value, 10))
      .filter((v) => Number.isFinite(v));

  return (
    <div className="cv-page cv-page--crm p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="cv-page-header">
          <h1 className="cv-page-title text-2xl font-bold text-gray-900">CRM</h1>
          <p className="cv-page-subtitle text-sm text-gray-600">Customer 360, segments, campaigns, loyalty analytics</p>
        </div>

        <div className="bg-white border rounded-xl p-2 flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 rounded-lg text-sm font-medium ${activeTab === tab ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "customers" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white border rounded-xl">
              <div className="p-3 border-b">
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customers..." className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div className="max-h-[620px] overflow-y-auto divide-y">
                {customers.map((c) => (
                  <button key={c.id} onClick={() => loadCustomerDetail(c.id)} className={`w-full text-left p-3 hover:bg-gray-50 ${selectedCustomerId === c.id ? "bg-blue-50" : ""}`}>
                    <div className="font-semibold">{c.full_name}</div>
                    <div className="text-xs text-gray-500">{c.phone}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="lg:col-span-2 bg-white border rounded-xl p-4 space-y-3">
              {!customerDetail ? (
                <div className="text-sm text-gray-500">Select a customer</div>
              ) : (
                <>
                  <div className="flex justify-between">
                    <div>
                      <h2 className="text-xl font-bold">{customerDetail.customer.full_name}</h2>
                      <div className="text-sm text-gray-600">{customerDetail.customer.phone}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Loyalty Points</div>
                      <div className="text-2xl font-bold text-blue-600">{customerDetail.customer.loyalty_points || 0}</div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-700">Orders: {customerDetail.customer.total_orders || 0} | Spent: {money(customerDetail.customer.total_spent)}</div>
                  <div className="border rounded-lg p-3 space-y-2">
                    <div className="font-semibold text-sm">Tags</div>
                    <div className="flex flex-wrap gap-1">
                      {(customerDetail.tags || []).map((tag) => (
                        <span key={tag.id} className="px-2 py-1 bg-gray-100 rounded text-xs">{tag.name}</span>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {tags.map((tag) => (
                        <label key={tag.id} className="text-sm">
                          <input
                            type="checkbox"
                            checked={selectedTagIds.includes(tag.id)}
                            onChange={() =>
                              setSelectedTagIds((prev) => (prev.includes(tag.id) ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]))
                            }
                          />{" "}
                          {tag.name}
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="New tag" className="flex-1 px-3 py-2 border rounded text-sm" />
                      <button onClick={createTag} className="px-3 py-2 bg-emerald-600 text-white rounded text-sm">Create Tag</button>
                      <button onClick={saveCustomerTags} className="px-3 py-2 bg-blue-600 text-white rounded text-sm">Save Tags</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <div className="font-semibold text-sm">Notes</div>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {(customerDetail.notes || []).map((n) => (
                          <div key={n.id} className="p-2 bg-gray-50 rounded text-sm">{n.note}</div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add note..." className="flex-1 px-3 py-2 border rounded text-sm" />
                        <button onClick={addNote} className="px-3 py-2 bg-blue-600 text-white rounded text-sm">Add</button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="font-semibold text-sm">Manual Loyalty</div>
                      <input type="number" value={manualPoints} onChange={(e) => setManualPoints(e.target.value)} placeholder="+/- points" className="w-full px-3 py-2 border rounded text-sm" />
                      <input value={manualReason} onChange={(e) => setManualReason(e.target.value)} placeholder="Reason" className="w-full px-3 py-2 border rounded text-sm" />
                      <button onClick={adjustLoyalty} className="w-full px-3 py-2 bg-emerald-600 text-white rounded text-sm">Update Points</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === "segments" && (
          <div className="space-y-3">
            <div className="bg-white border rounded-xl p-3 grid grid-cols-1 md:grid-cols-5 gap-2">
              <select value={segmentFilter.segment} onChange={(e) => setSegmentFilter((p) => ({ ...p, segment: e.target.value }))} className="px-2 py-2 border rounded text-sm">
                <option value="ALL">All segments</option><option value="LOYAL">LOYAL</option><option value="ACTIVE">ACTIVE</option><option value="AT_RISK">AT_RISK</option><option value="DORMANT">DORMANT</option><option value="NEW">NEW</option>
              </select>
              <input value={segmentFilter.min_orders} onChange={(e) => setSegmentFilter((p) => ({ ...p, min_orders: e.target.value }))} placeholder="Min orders" className="px-2 py-2 border rounded text-sm" />
              <input value={segmentFilter.min_spent} onChange={(e) => setSegmentFilter((p) => ({ ...p, min_spent: e.target.value }))} placeholder="Min spent" className="px-2 py-2 border rounded text-sm" />
              <input value={segmentFilter.last_order_before_days} onChange={(e) => setSegmentFilter((p) => ({ ...p, last_order_before_days: e.target.value }))} placeholder="No order N days" className="px-2 py-2 border rounded text-sm" />
              <button onClick={() => loadSegments(segmentFilter)} className="px-3 py-2 bg-blue-600 text-white rounded text-sm">Apply</button>
              <div className="md:col-span-5">
                <select multiple value={segmentFilter.tag_ids.map(String)} onChange={(e) => setSegmentFilter((p) => ({ ...p, tag_ids: readMultiSelect(e) }))} className="w-full min-h-[80px] px-2 py-2 border rounded text-sm">
                  {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div className="bg-white border rounded-xl overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">Customer</th><th className="px-3 py-2 text-left">Phone</th><th className="px-3 py-2 text-left">Orders</th><th className="px-3 py-2 text-left">Spent</th><th className="px-3 py-2 text-left">Segment</th></tr></thead>
                <tbody>{segments.map((s) => <tr key={s.id} className="border-t"><td className="px-3 py-2">{s.full_name}</td><td className="px-3 py-2">{s.phone}</td><td className="px-3 py-2">{s.total_orders || 0}</td><td className="px-3 py-2">{money(s.total_spent)}</td><td className="px-3 py-2">{s.segment}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "campaigns" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <form onSubmit={saveCampaign} className="bg-white border rounded-xl p-4 space-y-2">
              <input value={campaignForm.name} onChange={(e) => setCampaignForm((p) => ({ ...p, name: e.target.value }))} placeholder="Campaign name" className="w-full px-3 py-2 border rounded text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <select value={campaignForm.channel} onChange={(e) => setCampaignForm((p) => ({ ...p, channel: e.target.value }))} className="px-3 py-2 border rounded text-sm">
                  <option value="SMS">SMS</option><option value="WHATSAPP">WHATSAPP</option><option value="PHONE">PHONE</option><option value="WEB">WEB</option><option value="POS">POS</option>
                </select>
                <select value={campaignForm.status} onChange={(e) => setCampaignForm((p) => ({ ...p, status: e.target.value }))} className="px-3 py-2 border rounded text-sm">
                  <option value="DRAFT">DRAFT</option><option value="SCHEDULED">SCHEDULED</option><option value="ACTIVE">ACTIVE</option>
                </select>
              </div>
              <textarea value={campaignForm.message} onChange={(e) => setCampaignForm((p) => ({ ...p, message: e.target.value }))} rows={3} placeholder="Campaign message" className="w-full px-3 py-2 border rounded text-sm" />
              <div className="border rounded p-3 space-y-2">
                <div className="text-sm font-semibold">Audience Filter</div>
                <input value={campaignFilter.min_orders} onChange={(e) => setCampaignFilter((p) => ({ ...p, min_orders: e.target.value }))} placeholder="Min orders" className="w-full px-3 py-2 border rounded text-sm" />
                <input value={campaignFilter.min_spent} onChange={(e) => setCampaignFilter((p) => ({ ...p, min_spent: e.target.value }))} placeholder="Min spent" className="w-full px-3 py-2 border rounded text-sm" />
                <input value={campaignFilter.last_order_before_days} onChange={(e) => setCampaignFilter((p) => ({ ...p, last_order_before_days: e.target.value }))} placeholder="No order N days" className="w-full px-3 py-2 border rounded text-sm" />
                <select multiple value={campaignFilter.tag_ids.map(String)} onChange={(e) => setCampaignFilter((p) => ({ ...p, tag_ids: readMultiSelect(e) }))} className="w-full min-h-[80px] px-2 py-2 border rounded text-sm">
                  {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button type="button" onClick={previewAudience} className="w-full px-3 py-2 bg-gray-100 rounded text-sm">Preview Audience</button>
              </div>
              <button type="submit" className="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm">Save Campaign</button>
            </form>
            <div className="space-y-3">
              <div className="bg-white border rounded-xl p-4">
                <div className="font-semibold mb-2">Audience Preview</div>
                {!audiencePreview ? <div className="text-sm text-gray-500">Run preview</div> : (
                  <>
                    <div className="text-sm mb-2">Total: <b>{audiencePreview.total || 0}</b></div>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {(audiencePreview.customers || []).slice(0, 10).map((c) => (
                        <div key={c.id} className="text-sm p-2 bg-gray-50 rounded">{c.full_name} - {c.phone}</div>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="bg-white border rounded-xl p-4 max-h-[420px] overflow-y-auto space-y-2">
                {campaigns.map((c) => (
                  <div key={c.id} className="p-2 bg-gray-50 rounded">
                    <div className="font-semibold text-sm">{c.name}</div>
                    <div className="text-xs text-gray-500">{c.channel} | {c.status}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "loyalty" && (
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm">
              Loyalty points are redeemable at POS: 1 point per Rs.100 earned, 1 point = Rs.1 discount (max 20% bill).
            </div>
            {retention?.summary && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <div className="bg-white border rounded-lg p-3"><div className="text-xs text-gray-500">Repeat Rate</div><div className="text-xl font-bold">{retention.summary.repeat_rate || 0}%</div></div>
                <div className="bg-white border rounded-lg p-3"><div className="text-xs text-gray-500">Avg LTV</div><div className="text-xl font-bold">{money(retention.summary.avg_ltv)}</div></div>
                <div className="bg-white border rounded-lg p-3"><div className="text-xs text-gray-500">Churn Risk</div><div className="text-xl font-bold">{retention.summary.churn_risk_customers || 0}</div></div>
                <div className="bg-white border rounded-lg p-3"><div className="text-xs text-gray-500">Avg Order Value</div><div className="text-xl font-bold">{money(retention.summary.avg_order_value)}</div></div>
              </div>
            )}
            <div className="bg-white border rounded-xl overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">Customer</th><th className="px-3 py-2 text-left">Phone</th><th className="px-3 py-2 text-left">Points</th><th className="px-3 py-2 text-left">Orders</th><th className="px-3 py-2 text-left">Spent</th></tr></thead>
                <tbody>{topLoyalty.map((c) => <tr key={c.id} className="border-t"><td className="px-3 py-2">{c.full_name}</td><td className="px-3 py-2">{c.phone}</td><td className="px-3 py-2">{c.loyalty_points || 0}</td><td className="px-3 py-2">{c.total_orders || 0}</td><td className="px-3 py-2">{money(c.total_spent)}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "followups" && (
          <div className="bg-white border rounded-xl overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">Customer</th><th className="px-3 py-2 text-left">Phone</th><th className="px-3 py-2 text-left">Last Order</th><th className="px-3 py-2 text-left">Orders</th><th className="px-3 py-2 text-left">Spent</th></tr></thead>
              <tbody>{followups.map((c) => <tr key={c.id} className="border-t"><td className="px-3 py-2">{c.full_name}</td><td className="px-3 py-2">{c.phone}</td><td className="px-3 py-2">{dt(c.last_order_at)}</td><td className="px-3 py-2">{c.total_orders || 0}</td><td className="px-3 py-2">{money(c.total_spent)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>

      {message && <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">{message}</div>}
      {loading && <div className="fixed top-4 right-4 bg-gray-900 text-white px-3 py-1.5 rounded text-xs">Loading...</div>}
    </div>
  );
}
