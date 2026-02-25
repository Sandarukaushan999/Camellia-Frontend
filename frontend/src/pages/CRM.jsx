import React, { useEffect, useMemo, useState } from "react";
import api from "../utils/api.js";
import { formatBusinessDate, formatBusinessDateTime } from "../utils/timezone.js";

const TABS = ["customers", "segments", "campaigns", "loyalty", "followups"];

const emptyFilter = {
  segment: "ALL",
  min_orders: "",
  min_spent: "",
  last_order_before_days: "",
  include_inactive: false,
  tag_ids: [],
};

const emptyCustomerForm = {
  full_name: "",
  phone: "",
  email: "",
  address: "",
  birth_date: "",
  gender: "",
  is_active: true,
};

const emptySegmentPresetForm = {
  name: "",
  description: "",
  is_active: true,
};

const emptyFollowupForm = {
  customer_id: "",
  title: "",
  note: "",
  channel: "PHONE",
  priority: "MEDIUM",
  status: "OPEN",
  due_at: "",
};

function money(v) {
  return `Rs. ${parseFloat(v || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dt(v) {
  if (!v) return "-";
  return formatBusinessDateTime(v);
}

function toDateInput(v) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

function toDateTimeLocal(v) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

function fromDateTimeLocal(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function compactFilter(filter) {
  const payload = {};
  if (filter.segment && filter.segment !== "ALL") payload.segment = filter.segment;
  if (filter.min_orders !== "") payload.min_orders = Number(filter.min_orders);
  if (filter.min_spent !== "") payload.min_spent = Number(filter.min_spent);
  if (filter.last_order_before_days !== "") {
    payload.last_order_before_days = Number(filter.last_order_before_days);
  }
  if (filter.include_inactive) payload.include_inactive = true;
  if (filter.tag_ids?.length) payload.tag_ids = filter.tag_ids;
  return payload;
}

function hydrateCustomerForm(customer) {
  if (!customer) return { ...emptyCustomerForm };
  return {
    full_name: customer.full_name || "",
    phone: customer.phone || "",
    email: customer.email || "",
    address: customer.address || "",
    birth_date: toDateInput(customer.birth_date),
    gender: customer.gender || "",
    is_active: customer.is_active !== false,
  };
}

function hydrateAudienceFilter(filter = {}) {
  const f = filter && typeof filter === "object" ? filter : {};
  return {
    segment: f.segment || "ALL",
    min_orders: f.min_orders > 0 ? String(f.min_orders) : "",
    min_spent: f.min_spent > 0 ? String(f.min_spent) : "",
    last_order_before_days: f.last_order_before_days > 0 ? String(f.last_order_before_days) : "",
    include_inactive: Boolean(f.include_inactive),
    tag_ids: Array.isArray(f.tag_ids)
      ? f.tag_ids.map((v) => parseInt(v, 10)).filter((v) => Number.isFinite(v))
      : [],
  };
}

export default function CRM() {
  const [activeTab, setActiveTab] = useState("customers");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [customers, setCustomers] = useState([]);
  const [query, setQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [customerDetail, setCustomerDetail] = useState(null);
  const [customerForm, setCustomerForm] = useState({ ...emptyCustomerForm });
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [newNote, setNewNote] = useState("");
  const [noteEditId, setNoteEditId] = useState(null);
  const [noteEditText, setNoteEditText] = useState("");
  const [manualPoints, setManualPoints] = useState("");
  const [manualReason, setManualReason] = useState("MANUAL_ADJUSTMENT");
  const [loyaltyEditTxnId, setLoyaltyEditTxnId] = useState(null);
  const [loyaltyEditPoints, setLoyaltyEditPoints] = useState("");
  const [loyaltyEditReason, setLoyaltyEditReason] = useState("");

  const [tags, setTags] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [newTagName, setNewTagName] = useState("");
  const [tagEditId, setTagEditId] = useState(null);
  const [tagEditName, setTagEditName] = useState("");
  const [tagEditColor, setTagEditColor] = useState("slate");

  const [segments, setSegments] = useState([]);
  const [segmentFilter, setSegmentFilter] = useState({ ...emptyFilter });
  const [segmentPresets, setSegmentPresets] = useState([]);
  const [segmentPresetForm, setSegmentPresetForm] = useState({ ...emptySegmentPresetForm });
  const [editingSegmentPresetId, setEditingSegmentPresetId] = useState(null);

  const [campaigns, setCampaigns] = useState([]);
  const [campaignForm, setCampaignForm] = useState({
    name: "",
    channel: "SMS",
    status: "DRAFT",
    message: "",
    scheduled_at: "",
    sent_at: "",
  });
  const [campaignFilter, setCampaignFilter] = useState({ ...emptyFilter });
  const [audiencePreview, setAudiencePreview] = useState(null);
  const [editingCampaignId, setEditingCampaignId] = useState(null);

  const [retention, setRetention] = useState(null);
  const [followupList, setFollowupList] = useState([]);
  const [followupForm, setFollowupForm] = useState({ ...emptyFollowupForm });
  const [editingFollowupId, setEditingFollowupId] = useState(null);
  const [followupStatusFilter, setFollowupStatusFilter] = useState("ALL");

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
      setEditingCustomerId(id);
      setCustomerForm(hydrateCustomerForm(data.customer));
      setNoteEditId(null);
      setLoyaltyEditTxnId(null);
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

  const loadSegmentPresets = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/crm/segment-presets");
      setSegmentPresets(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast("Failed to load segment presets");
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

  const loadFollowups = async (status = followupStatusFilter) => {
    setLoading(true);
    try {
      const { data } = await api.get("/crm/followups", {
        params: {
          status,
          include_completed: status === "ALL" ? "true" : "false",
          limit: 500,
        },
      });
      setFollowupList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast("Failed to load followups");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "customers" || activeTab === "loyalty") {
      const t = setTimeout(() => loadCustomers(query), 250);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [activeTab, query]);

  useEffect(() => {
    if (activeTab === "customers" || activeTab === "segments" || activeTab === "campaigns") {
      loadTags();
    }
    if (activeTab === "segments") {
      loadSegments();
      loadSegmentPresets();
    }
    if (activeTab === "campaigns") loadCampaigns();
    if (activeTab === "loyalty") loadRetention();
    if (activeTab === "followups") {
      loadCustomers("");
      loadFollowups(followupStatusFilter);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "followups") {
      loadFollowups(followupStatusFilter);
    }
  }, [activeTab, followupStatusFilter]);

  const topLoyalty = useMemo(
    () => [...customers].sort((a, b) => (b.loyalty_points || 0) - (a.loyalty_points || 0)).slice(0, 10),
    [customers]
  );

  const inactiveCustomerSuggestions = useMemo(() => {
    const now = Date.now();
    return customers.filter((c) => {
      if (!c.last_order_at) return true;
      const t = new Date(c.last_order_at).getTime();
      if (Number.isNaN(t)) return true;
      return (now - t) / (1000 * 60 * 60 * 24) >= 30;
    });
  }, [customers]);

  const resetCustomerEditor = () => {
    setEditingCustomerId(null);
    setCustomerForm({ ...emptyCustomerForm });
  };

  const saveCustomer = async (e) => {
    e.preventDefault();
    const payload = {
      full_name: customerForm.full_name.trim(),
      phone: customerForm.phone.trim(),
      email: customerForm.email.trim() || null,
      address: customerForm.address.trim() || null,
      birth_date: customerForm.birth_date || null,
      gender: customerForm.gender.trim() || null,
      is_active: Boolean(customerForm.is_active),
    };
    if (!payload.full_name || !payload.phone) {
      toast("Customer name and phone are required");
      return;
    }

    setLoading(true);
    try {
      if (editingCustomerId) {
        await api.put(`/crm/customers/${editingCustomerId}`, payload);
        await Promise.all([loadCustomerDetail(editingCustomerId), loadCustomers(query)]);
        toast("Customer updated");
      } else {
        const { data } = await api.post("/crm/customers", payload);
        await loadCustomers(query);
        if (data?.id) {
          await loadCustomerDetail(data.id);
        }
        toast("Customer created");
      }
    } catch (err) {
      console.error(err);
      toast(err.response?.data?.message || "Failed to save customer");
    } finally {
      setLoading(false);
    }
  };

  const deactivateCustomer = async () => {
    if (!editingCustomerId) return;
    setLoading(true);
    try {
      await api.delete(`/crm/customers/${editingCustomerId}`, { params: { mode: "soft" } });
      await Promise.all([loadCustomers(query), loadCustomerDetail(editingCustomerId)]);
      toast("Customer deactivated");
    } catch (err) {
      console.error(err);
      toast(err.response?.data?.message || "Failed to deactivate customer");
    } finally {
      setLoading(false);
    }
  };

  const deleteCustomerHard = async () => {
    if (!editingCustomerId) return;
    if (!window.confirm("Delete this customer permanently?")) {
      return;
    }
    const id = editingCustomerId;
    setLoading(true);
    try {
      await api.delete(`/crm/customers/${id}`, { params: { mode: "hard" } });
      setCustomerDetail(null);
      setSelectedCustomerId(null);
      resetCustomerEditor();
      await loadCustomers(query);
      toast("Customer deleted");
    } catch (err) {
      console.error(err);
      toast(err.response?.data?.message || "Failed to delete customer");
    } finally {
      setLoading(false);
    }
  };

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
      toast(err.response?.data?.message || "Failed to add note");
    } finally {
      setLoading(false);
    }
  };

  const beginEditNote = (note) => {
    setNoteEditId(note.id);
    setNoteEditText(note.note || "");
  };

  const saveNoteEdit = async () => {
    if (!customerDetail?.customer?.id || !noteEditId || !noteEditText.trim()) return;
    setLoading(true);
    try {
      await api.put(`/crm/customers/${customerDetail.customer.id}/notes/${noteEditId}`, {
        note: noteEditText.trim(),
      });
      setNoteEditId(null);
      setNoteEditText("");
      await loadCustomerDetail(customerDetail.customer.id);
      toast("Note updated");
    } catch (err) {
      console.error(err);
      toast(err.response?.data?.message || "Failed to update note");
    } finally {
      setLoading(false);
    }
  };

  const deleteNote = async (noteId) => {
    if (!customerDetail?.customer?.id || !noteId) return;
    setLoading(true);
    try {
      await api.delete(`/crm/customers/${customerDetail.customer.id}/notes/${noteId}`);
      await loadCustomerDetail(customerDetail.customer.id);
      toast("Note deleted");
    } catch (err) {
      console.error(err);
      toast(err.response?.data?.message || "Failed to delete note");
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
      toast(err.response?.data?.message || "Failed to update points");
    } finally {
      setLoading(false);
    }
  };

  const beginEditLoyaltyTxn = (txn) => {
    setLoyaltyEditTxnId(txn.id);
    setLoyaltyEditPoints(String(txn.points_change || ""));
    setLoyaltyEditReason(txn.reason || "MANUAL_ADJUSTMENT");
  };

  const saveLoyaltyTxnEdit = async () => {
    if (!customerDetail?.customer?.id || !loyaltyEditTxnId) return;
    const points = parseInt(loyaltyEditPoints, 10);
    if (!Number.isFinite(points) || points === 0) {
      toast("Invalid points");
      return;
    }
    setLoading(true);
    try {
      await api.put(`/crm/customers/${customerDetail.customer.id}/loyalty/txns/${loyaltyEditTxnId}`, {
        points_change: points,
        reason: loyaltyEditReason || "MANUAL_ADJUSTMENT",
      });
      setLoyaltyEditTxnId(null);
      setLoyaltyEditPoints("");
      setLoyaltyEditReason("");
      await Promise.all([loadCustomerDetail(customerDetail.customer.id), loadCustomers(query)]);
      toast("Loyalty transaction updated");
    } catch (err) {
      console.error(err);
      toast(err.response?.data?.message || "Failed to update loyalty transaction");
    } finally {
      setLoading(false);
    }
  };

  const deleteLoyaltyTxn = async (txnId) => {
    if (!customerDetail?.customer?.id || !txnId) return;
    setLoading(true);
    try {
      await api.delete(`/crm/customers/${customerDetail.customer.id}/loyalty/txns/${txnId}`);
      await Promise.all([loadCustomerDetail(customerDetail.customer.id), loadCustomers(query)]);
      toast("Loyalty transaction deleted");
    } catch (err) {
      console.error(err);
      toast(err.response?.data?.message || "Failed to delete loyalty transaction");
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
      toast(err.response?.data?.message || "Failed to save tags");
    } finally {
      setLoading(false);
    }
  };

  const createTag = async () => {
    if (!newTagName.trim()) return;
    setLoading(true);
    try {
      await api.post("/crm/tags", { name: newTagName.trim(), color: "slate" });
      setNewTagName("");
      await loadTags();
      toast("Tag created");
    } catch (err) {
      console.error(err);
      toast(err.response?.data?.message || "Failed to create tag");
    } finally {
      setLoading(false);
    }
  };

  const beginTagEdit = (tag) => {
    setTagEditId(tag.id);
    setTagEditName(tag.name || "");
    setTagEditColor(tag.color || "slate");
  };

  const saveTagEdit = async () => {
    if (!tagEditId || !tagEditName.trim()) return;
    setLoading(true);
    try {
      await api.put(`/crm/tags/${tagEditId}`, {
        name: tagEditName.trim(),
        color: (tagEditColor || "slate").trim().toLowerCase(),
      });
      setTagEditId(null);
      setTagEditName("");
      setTagEditColor("slate");
      await loadTags();
      toast("Tag updated");
    } catch (err) {
      console.error(err);
      toast(err.response?.data?.message || "Failed to update tag");
    } finally {
      setLoading(false);
    }
  };

  const deleteTag = async (tagId) => {
    if (!tagId) return;
    setLoading(true);
    try {
      await api.delete(`/crm/tags/${tagId}`);
      await loadTags();
      if (customerDetail?.customer?.id) {
        await loadCustomerDetail(customerDetail.customer.id);
      }
      toast("Tag deleted");
    } catch (err) {
      console.error(err);
      toast(err.response?.data?.message || "Failed to delete tag");
    } finally {
      setLoading(false);
    }
  };

  const applySegmentPreset = async (preset) => {
    const nextFilter = hydrateAudienceFilter(preset?.filter || {});
    setSegmentFilter(nextFilter);
    await loadSegments(nextFilter);
  };

  const beginSegmentPresetEdit = (preset) => {
    setEditingSegmentPresetId(preset.id);
    setSegmentPresetForm({
      name: preset.name || "",
      description: preset.description || "",
      is_active: preset.is_active !== false,
    });
    setSegmentFilter(hydrateAudienceFilter(preset.filter || {}));
  };

  const resetSegmentPresetEditor = () => {
    setEditingSegmentPresetId(null);
    setSegmentPresetForm({ ...emptySegmentPresetForm });
  };

  const saveSegmentPreset = async () => {
    if (!segmentPresetForm.name.trim()) {
      toast("Preset name is required");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: segmentPresetForm.name.trim(),
        description: segmentPresetForm.description.trim() || null,
        is_active: Boolean(segmentPresetForm.is_active),
        filter: compactFilter(segmentFilter),
      };
      if (editingSegmentPresetId) {
        await api.put(`/crm/segment-presets/${editingSegmentPresetId}`, payload);
        toast("Preset updated");
      } else {
        await api.post("/crm/segment-presets", payload);
        toast("Preset created");
      }
      resetSegmentPresetEditor();
      await loadSegmentPresets();
    } catch (err) {
      console.error(err);
      toast(err.response?.data?.message || "Failed to save segment preset");
    } finally {
      setLoading(false);
    }
  };

  const deleteSegmentPreset = async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      await api.delete(`/crm/segment-presets/${id}`);
      await loadSegmentPresets();
      toast("Preset deleted");
    } catch (err) {
      console.error(err);
      toast(err.response?.data?.message || "Failed to delete segment preset");
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
      const payload = {
        ...campaignForm,
        scheduled_at: fromDateTimeLocal(campaignForm.scheduled_at),
        sent_at: fromDateTimeLocal(campaignForm.sent_at),
        audience_filter: compactFilter(campaignFilter),
      };
      if (editingCampaignId) {
        await api.put(`/crm/campaigns/${editingCampaignId}`, payload);
        toast("Campaign updated");
      } else {
        await api.post("/crm/campaigns", payload);
        toast("Campaign created");
      }
      setCampaignForm({
        name: "",
        channel: "SMS",
        status: "DRAFT",
        message: "",
        scheduled_at: "",
        sent_at: "",
      });
      setCampaignFilter({ ...emptyFilter });
      setEditingCampaignId(null);
      setAudiencePreview(null);
      await loadCampaigns();
    } catch (err) {
      console.error(err);
      toast(err.response?.data?.message || "Failed to save campaign");
    } finally {
      setLoading(false);
    }
  };

  const beginCampaignEdit = (campaign) => {
    setEditingCampaignId(campaign.id);
    setCampaignForm({
      name: campaign.name || "",
      channel: campaign.channel || "SMS",
      status: campaign.status || "DRAFT",
      message: campaign.message || "",
      scheduled_at: toDateTimeLocal(campaign.scheduled_at),
      sent_at: toDateTimeLocal(campaign.sent_at),
    });
    setCampaignFilter(hydrateAudienceFilter(campaign.audience_filter || {}));
  };

  const deleteCampaign = async (campaignId) => {
    if (!campaignId) return;
    setLoading(true);
    try {
      await api.delete(`/crm/campaigns/${campaignId}`);
      await loadCampaigns();
      toast("Campaign deleted");
    } catch (err) {
      console.error(err);
      toast(err.response?.data?.message || "Failed to delete campaign");
    } finally {
      setLoading(false);
    }
  };

  const saveFollowup = async (e) => {
    e.preventDefault();
    const payload = {
      customer_id: String(followupForm.customer_id || "").trim(),
      title: String(followupForm.title || "").trim(),
      note: String(followupForm.note || "").trim() || null,
      channel: followupForm.channel,
      priority: followupForm.priority,
      status: followupForm.status,
      due_at: fromDateTimeLocal(followupForm.due_at),
    };
    if (!payload.customer_id || !payload.title) {
      toast("Customer and title are required");
      return;
    }

    setLoading(true);
    try {
      if (editingFollowupId) {
        await api.put(`/crm/followups/${editingFollowupId}`, payload);
        toast("Followup updated");
      } else {
        await api.post("/crm/followups", payload);
        toast("Followup created");
      }
      setEditingFollowupId(null);
      setFollowupForm({ ...emptyFollowupForm });
      await loadFollowups(followupStatusFilter);
    } catch (err) {
      console.error(err);
      toast(err.response?.data?.message || "Failed to save followup");
    } finally {
      setLoading(false);
    }
  };

  const beginFollowupEdit = (item) => {
    setEditingFollowupId(item.id);
    setFollowupForm({
      customer_id: item.customer_id || "",
      title: item.title || "",
      note: item.note || "",
      channel: item.channel || "PHONE",
      priority: item.priority || "MEDIUM",
      status: item.status || "OPEN",
      due_at: toDateTimeLocal(item.due_at),
    });
  };

  const deleteFollowup = async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      await api.delete(`/crm/followups/${id}`);
      await loadFollowups(followupStatusFilter);
      toast("Followup deleted");
    } catch (err) {
      console.error(err);
      toast(err.response?.data?.message || "Failed to delete followup");
    } finally {
      setLoading(false);
    }
  };

  const createQuickFollowup = (customer) => {
    setEditingFollowupId(null);
    setFollowupForm({
      customer_id: customer.id,
      title: `Reconnect with ${customer.full_name || "customer"}`,
      note: customer.last_order_at
        ? `No order since ${formatBusinessDate(customer.last_order_at)}`
        : "No recent order activity",
      channel: "PHONE",
      priority: "MEDIUM",
      status: "OPEN",
      due_at: "",
    });
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
              <div className="p-3 border-b space-y-2">
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customers..." className="w-full px-3 py-2 border rounded-lg text-sm" />
                <button onClick={resetCustomerEditor} className="w-full px-3 py-2 bg-gray-100 rounded text-sm">New Customer</button>
              </div>
              <div className="max-h-[620px] overflow-y-auto divide-y">
                {customers.map((c) => (
                  <button key={c.id} onClick={() => loadCustomerDetail(c.id)} className={`w-full text-left p-3 hover:bg-gray-50 ${selectedCustomerId === c.id ? "bg-blue-50" : ""}`}>
                    <div className="font-semibold">{c.full_name}</div>
                    <div className="text-xs text-gray-500">{c.phone}</div>
                    <div className="text-xs mt-1">
                      <span className={`px-2 py-0.5 rounded ${c.is_active ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                        {c.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="lg:col-span-2 space-y-4">
              <form onSubmit={saveCustomer} className="bg-white border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">{editingCustomerId ? "Edit Customer" : "Create Customer"}</h2>
                  {editingCustomerId && <span className="text-xs text-gray-500">ID: {editingCustomerId}</span>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input value={customerForm.full_name} onChange={(e) => setCustomerForm((p) => ({ ...p, full_name: e.target.value }))} placeholder="Full name" className="px-3 py-2 border rounded text-sm" />
                  <input value={customerForm.phone} onChange={(e) => setCustomerForm((p) => ({ ...p, phone: e.target.value }))} placeholder="Phone" className="px-3 py-2 border rounded text-sm" />
                  <input value={customerForm.email} onChange={(e) => setCustomerForm((p) => ({ ...p, email: e.target.value }))} placeholder="Email" className="px-3 py-2 border rounded text-sm" />
                  <input value={customerForm.gender} onChange={(e) => setCustomerForm((p) => ({ ...p, gender: e.target.value }))} placeholder="Gender" className="px-3 py-2 border rounded text-sm" />
                  <input type="date" value={customerForm.birth_date} onChange={(e) => setCustomerForm((p) => ({ ...p, birth_date: e.target.value }))} className="px-3 py-2 border rounded text-sm" />
                  <label className="px-3 py-2 border rounded text-sm flex items-center gap-2">
                    <input type="checkbox" checked={Boolean(customerForm.is_active)} onChange={(e) => setCustomerForm((p) => ({ ...p, is_active: e.target.checked }))} />
                    Active
                  </label>
                  <textarea value={customerForm.address} onChange={(e) => setCustomerForm((p) => ({ ...p, address: e.target.value }))} rows={2} placeholder="Address" className="md:col-span-2 px-3 py-2 border rounded text-sm" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded text-sm">{editingCustomerId ? "Update Customer" : "Create Customer"}</button>
                  <button type="button" onClick={resetCustomerEditor} className="px-3 py-2 bg-gray-100 rounded text-sm">Reset</button>
                  {editingCustomerId && (
                    <>
                      <button type="button" onClick={deactivateCustomer} className="px-3 py-2 bg-amber-500 text-white rounded text-sm">Deactivate</button>
                      <button type="button" onClick={deleteCustomerHard} className="px-3 py-2 bg-rose-600 text-white rounded text-sm">Delete Hard</button>
                    </>
                  )}
                </div>
              </form>

              <div className="bg-white border rounded-xl p-4 space-y-3">
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
                    <div className="max-h-40 overflow-y-auto space-y-1 border-t pt-2">
                      {tags.map((tag) => (
                        <div key={tag.id} className="flex items-center justify-between gap-2 text-xs bg-gray-50 rounded p-2">
                          {tagEditId === tag.id ? (
                            <>
                              <input value={tagEditName} onChange={(e) => setTagEditName(e.target.value)} className="px-2 py-1 border rounded text-xs" />
                              <input value={tagEditColor} onChange={(e) => setTagEditColor(e.target.value)} className="px-2 py-1 border rounded text-xs w-24" />
                              <button onClick={saveTagEdit} className="px-2 py-1 bg-blue-600 text-white rounded">Save</button>
                              <button onClick={() => setTagEditId(null)} className="px-2 py-1 bg-gray-200 rounded">Cancel</button>
                            </>
                          ) : (
                            <>
                              <span>{tag.name} ({tag.color || "slate"})</span>
                              <div className="flex gap-1">
                                <button onClick={() => beginTagEdit(tag)} className="px-2 py-1 bg-gray-200 rounded">Edit</button>
                                <button onClick={() => deleteTag(tag.id)} className="px-2 py-1 bg-rose-600 text-white rounded">Delete</button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <div className="font-semibold text-sm">Notes</div>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {(customerDetail.notes || []).map((n) => (
                          <div key={n.id} className="p-2 bg-gray-50 rounded text-sm">
                            {noteEditId === n.id ? (
                              <div className="space-y-2">
                                <textarea rows={2} value={noteEditText} onChange={(e) => setNoteEditText(e.target.value)} className="w-full px-2 py-1 border rounded text-sm" />
                                <div className="flex gap-1">
                                  <button onClick={saveNoteEdit} className="px-2 py-1 bg-blue-600 text-white rounded text-xs">Save</button>
                                  <button onClick={() => setNoteEditId(null)} className="px-2 py-1 bg-gray-200 rounded text-xs">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div>{n.note}</div>
                                <div className="text-xs text-gray-500">{dt(n.created_at)} by {n.created_by || "-"}</div>
                                <div className="flex gap-1 mt-1">
                                  <button onClick={() => beginEditNote(n)} className="px-2 py-1 bg-gray-200 rounded text-xs">Edit</button>
                                  <button onClick={() => deleteNote(n.id)} className="px-2 py-1 bg-rose-600 text-white rounded text-xs">Delete</button>
                                </div>
                              </>
                            )}
                          </div>
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
                      <div className="font-semibold text-sm pt-2">Loyalty Transactions</div>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {(customerDetail.loyalty || []).slice(0, 20).map((txn) => {
                          const isManual = !txn.order_id;
                          return (
                            <div key={txn.id} className="p-2 bg-gray-50 rounded text-xs">
                              {loyaltyEditTxnId === txn.id ? (
                                <div className="space-y-2">
                                  <input type="number" value={loyaltyEditPoints} onChange={(e) => setLoyaltyEditPoints(e.target.value)} className="w-full px-2 py-1 border rounded" />
                                  <input value={loyaltyEditReason} onChange={(e) => setLoyaltyEditReason(e.target.value)} className="w-full px-2 py-1 border rounded" />
                                  <div className="flex gap-1">
                                    <button onClick={saveLoyaltyTxnEdit} className="px-2 py-1 bg-blue-600 text-white rounded">Save</button>
                                    <button onClick={() => setLoyaltyEditTxnId(null)} className="px-2 py-1 bg-gray-200 rounded">Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="font-semibold">{txn.points_change > 0 ? "+" : ""}{txn.points_change} pts</div>
                                  <div>{txn.reason}</div>
                                  <div className="text-gray-500">{dt(txn.created_at)}</div>
                                  {isManual && (
                                    <div className="flex gap-1 mt-1">
                                      <button onClick={() => beginEditLoyaltyTxn(txn)} className="px-2 py-1 bg-gray-200 rounded">Edit</button>
                                      <button onClick={() => deleteLoyaltyTxn(txn.id)} className="px-2 py-1 bg-rose-600 text-white rounded">Delete</button>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </>
              )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "segments" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-3">
              <div className="bg-white border rounded-xl p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                <select value={segmentFilter.segment} onChange={(e) => setSegmentFilter((p) => ({ ...p, segment: e.target.value }))} className="px-2 py-2 border rounded text-sm">
                  <option value="ALL">All segments</option><option value="LOYAL">LOYAL</option><option value="ACTIVE">ACTIVE</option><option value="AT_RISK">AT_RISK</option><option value="DORMANT">DORMANT</option><option value="NEW">NEW</option>
                </select>
                <label className="px-2 py-2 border rounded text-sm flex items-center gap-2">
                  <input type="checkbox" checked={segmentFilter.include_inactive} onChange={(e) => setSegmentFilter((p) => ({ ...p, include_inactive: e.target.checked }))} />
                  Include inactive
                </label>
                <input value={segmentFilter.min_orders} onChange={(e) => setSegmentFilter((p) => ({ ...p, min_orders: e.target.value }))} placeholder="Min orders" className="px-2 py-2 border rounded text-sm" />
                <input value={segmentFilter.min_spent} onChange={(e) => setSegmentFilter((p) => ({ ...p, min_spent: e.target.value }))} placeholder="Min spent" className="px-2 py-2 border rounded text-sm" />
                <input value={segmentFilter.last_order_before_days} onChange={(e) => setSegmentFilter((p) => ({ ...p, last_order_before_days: e.target.value }))} placeholder="No order N days" className="px-2 py-2 border rounded text-sm" />
                <button onClick={() => loadSegments(segmentFilter)} className="px-3 py-2 bg-blue-600 text-white rounded text-sm">Apply</button>
                <div className="md:col-span-2">
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
            <div className="space-y-3">
              <div className="bg-white border rounded-xl p-3 space-y-2">
                <div className="font-semibold text-sm">{editingSegmentPresetId ? "Edit Segment Preset" : "Save Segment Preset"}</div>
                <input value={segmentPresetForm.name} onChange={(e) => setSegmentPresetForm((p) => ({ ...p, name: e.target.value }))} placeholder="Preset name" className="w-full px-3 py-2 border rounded text-sm" />
                <textarea value={segmentPresetForm.description} onChange={(e) => setSegmentPresetForm((p) => ({ ...p, description: e.target.value }))} rows={2} placeholder="Description" className="w-full px-3 py-2 border rounded text-sm" />
                <label className="text-sm flex items-center gap-2">
                  <input type="checkbox" checked={Boolean(segmentPresetForm.is_active)} onChange={(e) => setSegmentPresetForm((p) => ({ ...p, is_active: e.target.checked }))} />
                  Active
                </label>
                <div className="flex gap-2">
                  <button onClick={saveSegmentPreset} className="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm">{editingSegmentPresetId ? "Update" : "Create"}</button>
                  <button onClick={resetSegmentPresetEditor} className="px-3 py-2 bg-gray-100 rounded text-sm">Reset</button>
                </div>
              </div>
              <div className="bg-white border rounded-xl p-3 max-h-[420px] overflow-y-auto space-y-2">
                {segmentPresets.map((preset) => (
                  <div key={preset.id} className="p-2 bg-gray-50 rounded text-sm space-y-1">
                    <div className="font-semibold">{preset.name}</div>
                    <div className="text-xs text-gray-500">{preset.description || "No description"}</div>
                    <div className="flex gap-1">
                      <button onClick={() => applySegmentPreset(preset)} className="px-2 py-1 bg-blue-600 text-white rounded text-xs">Apply</button>
                      <button onClick={() => beginSegmentPresetEdit(preset)} className="px-2 py-1 bg-gray-200 rounded text-xs">Edit</button>
                      <button onClick={() => deleteSegmentPreset(preset.id)} className="px-2 py-1 bg-rose-600 text-white rounded text-xs">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "campaigns" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <form onSubmit={saveCampaign} className="bg-white border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{editingCampaignId ? "Edit Campaign" : "Create Campaign"}</div>
                {editingCampaignId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCampaignId(null);
                      setCampaignForm({ name: "", channel: "SMS", status: "DRAFT", message: "", scheduled_at: "", sent_at: "" });
                      setCampaignFilter({ ...emptyFilter });
                      setAudiencePreview(null);
                    }}
                    className="text-xs px-2 py-1 bg-gray-100 rounded"
                  >
                    Reset
                  </button>
                )}
              </div>
              <input value={campaignForm.name} onChange={(e) => setCampaignForm((p) => ({ ...p, name: e.target.value }))} placeholder="Campaign name" className="w-full px-3 py-2 border rounded text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <select value={campaignForm.channel} onChange={(e) => setCampaignForm((p) => ({ ...p, channel: e.target.value }))} className="px-3 py-2 border rounded text-sm">
                  <option value="SMS">SMS</option><option value="WHATSAPP">WHATSAPP</option><option value="PHONE">PHONE</option><option value="WEB">WEB</option><option value="POS">POS</option>
                </select>
                <select value={campaignForm.status} onChange={(e) => setCampaignForm((p) => ({ ...p, status: e.target.value }))} className="px-3 py-2 border rounded text-sm">
                  <option value="DRAFT">DRAFT</option><option value="SCHEDULED">SCHEDULED</option><option value="ACTIVE">ACTIVE</option><option value="PAUSED">PAUSED</option><option value="SENT">SENT</option>
                </select>
              </div>
              <textarea value={campaignForm.message} onChange={(e) => setCampaignForm((p) => ({ ...p, message: e.target.value }))} rows={3} placeholder="Campaign message" className="w-full px-3 py-2 border rounded text-sm" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <label className="text-xs text-gray-600">
                  Scheduled At
                  <input type="datetime-local" value={campaignForm.scheduled_at} onChange={(e) => setCampaignForm((p) => ({ ...p, scheduled_at: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded text-sm" />
                </label>
                <label className="text-xs text-gray-600">
                  Sent At
                  <input type="datetime-local" value={campaignForm.sent_at} onChange={(e) => setCampaignForm((p) => ({ ...p, sent_at: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded text-sm" />
                </label>
              </div>
              <div className="border rounded p-3 space-y-2">
                <div className="text-sm font-semibold">Audience Filter</div>
                <select value={campaignFilter.segment} onChange={(e) => setCampaignFilter((p) => ({ ...p, segment: e.target.value }))} className="w-full px-3 py-2 border rounded text-sm">
                  <option value="ALL">ALL</option><option value="LOYAL">LOYAL</option><option value="ACTIVE">ACTIVE</option><option value="AT_RISK">AT_RISK</option><option value="DORMANT">DORMANT</option><option value="NEW">NEW</option>
                </select>
                <input value={campaignFilter.min_orders} onChange={(e) => setCampaignFilter((p) => ({ ...p, min_orders: e.target.value }))} placeholder="Min orders" className="w-full px-3 py-2 border rounded text-sm" />
                <input value={campaignFilter.min_spent} onChange={(e) => setCampaignFilter((p) => ({ ...p, min_spent: e.target.value }))} placeholder="Min spent" className="w-full px-3 py-2 border rounded text-sm" />
                <input value={campaignFilter.last_order_before_days} onChange={(e) => setCampaignFilter((p) => ({ ...p, last_order_before_days: e.target.value }))} placeholder="No order N days" className="w-full px-3 py-2 border rounded text-sm" />
                <label className="text-sm flex items-center gap-2">
                  <input type="checkbox" checked={campaignFilter.include_inactive} onChange={(e) => setCampaignFilter((p) => ({ ...p, include_inactive: e.target.checked }))} />
                  Include inactive
                </label>
                <select multiple value={campaignFilter.tag_ids.map(String)} onChange={(e) => setCampaignFilter((p) => ({ ...p, tag_ids: readMultiSelect(e) }))} className="w-full min-h-[80px] px-2 py-2 border rounded text-sm">
                  {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button type="button" onClick={previewAudience} className="w-full px-3 py-2 bg-gray-100 rounded text-sm">Preview Audience</button>
              </div>
              <button type="submit" className="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm">{editingCampaignId ? "Update Campaign" : "Save Campaign"}</button>
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
                    <div className="text-xs text-gray-500">{c.channel} | {c.status} | {dt(c.scheduled_at)}</div>
                    <div className="text-xs text-gray-700 mt-1 line-clamp-2">{c.message}</div>
                    <div className="flex gap-1 mt-2">
                      <button onClick={() => beginCampaignEdit(c)} className="px-2 py-1 bg-gray-200 rounded text-xs">Edit</button>
                      <button onClick={() => deleteCampaign(c.id)} className="px-2 py-1 bg-rose-600 text-white rounded text-xs">Delete</button>
                    </div>
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
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <form onSubmit={saveFollowup} className="bg-white border rounded-xl p-4 space-y-2">
                <div className="font-semibold">{editingFollowupId ? "Edit Followup" : "Create Followup"}</div>
                <select value={followupForm.customer_id} onChange={(e) => setFollowupForm((p) => ({ ...p, customer_id: e.target.value }))} className="w-full px-3 py-2 border rounded text-sm">
                  <option value="">Select customer</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.full_name} ({c.phone})</option>)}
                </select>
                <input value={followupForm.title} onChange={(e) => setFollowupForm((p) => ({ ...p, title: e.target.value }))} placeholder="Followup title" className="w-full px-3 py-2 border rounded text-sm" />
                <textarea rows={3} value={followupForm.note} onChange={(e) => setFollowupForm((p) => ({ ...p, note: e.target.value }))} placeholder="Notes" className="w-full px-3 py-2 border rounded text-sm" />
                <div className="grid grid-cols-3 gap-2">
                  <select value={followupForm.channel} onChange={(e) => setFollowupForm((p) => ({ ...p, channel: e.target.value }))} className="px-3 py-2 border rounded text-sm">
                    <option value="PHONE">PHONE</option><option value="SMS">SMS</option><option value="WHATSAPP">WHATSAPP</option><option value="EMAIL">EMAIL</option><option value="OTHER">OTHER</option>
                  </select>
                  <select value={followupForm.priority} onChange={(e) => setFollowupForm((p) => ({ ...p, priority: e.target.value }))} className="px-3 py-2 border rounded text-sm">
                    <option value="LOW">LOW</option><option value="MEDIUM">MEDIUM</option><option value="HIGH">HIGH</option><option value="URGENT">URGENT</option>
                  </select>
                  <select value={followupForm.status} onChange={(e) => setFollowupForm((p) => ({ ...p, status: e.target.value }))} className="px-3 py-2 border rounded text-sm">
                    <option value="OPEN">OPEN</option><option value="IN_PROGRESS">IN_PROGRESS</option><option value="COMPLETED">COMPLETED</option><option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
                <label className="text-xs text-gray-600">
                  Due At
                  <input type="datetime-local" value={followupForm.due_at} onChange={(e) => setFollowupForm((p) => ({ ...p, due_at: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded text-sm" />
                </label>
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm">{editingFollowupId ? "Update" : "Create"}</button>
                  <button type="button" onClick={() => { setEditingFollowupId(null); setFollowupForm({ ...emptyFollowupForm }); }} className="px-3 py-2 bg-gray-100 rounded text-sm">Reset</button>
                </div>
              </form>
              <div className="lg:col-span-2 bg-white border rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">Followup Queue</div>
                  <select value={followupStatusFilter} onChange={(e) => setFollowupStatusFilter(e.target.value)} className="px-3 py-2 border rounded text-sm">
                    <option value="ALL">ALL</option><option value="OPEN">OPEN</option><option value="IN_PROGRESS">IN_PROGRESS</option><option value="COMPLETED">COMPLETED</option><option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
                <div className="max-h-[420px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">Customer</th><th className="px-3 py-2 text-left">Title</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">Due</th><th className="px-3 py-2 text-left">Actions</th></tr></thead>
                    <tbody>
                      {followupList.map((f) => (
                        <tr key={f.id} className="border-t">
                          <td className="px-3 py-2">{f.customer_name}<div className="text-xs text-gray-500">{f.customer_phone}</div></td>
                          <td className="px-3 py-2">{f.title}<div className="text-xs text-gray-500">{f.priority} | {f.channel}</div></td>
                          <td className="px-3 py-2">{f.status}</td>
                          <td className="px-3 py-2">{dt(f.due_at)}</td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              <button onClick={() => beginFollowupEdit(f)} className="px-2 py-1 bg-gray-200 rounded text-xs">Edit</button>
                              <button onClick={() => deleteFollowup(f.id)} className="px-2 py-1 bg-rose-600 text-white rounded text-xs">Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="bg-white border rounded-xl p-4">
              <div className="font-semibold mb-2">Followup Suggestions (30+ days inactive)</div>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">Customer</th><th className="px-3 py-2 text-left">Phone</th><th className="px-3 py-2 text-left">Last Order</th><th className="px-3 py-2 text-left">Action</th></tr></thead>
                  <tbody>
                    {inactiveCustomerSuggestions.map((c) => (
                      <tr key={c.id} className="border-t">
                        <td className="px-3 py-2">{c.full_name}</td>
                        <td className="px-3 py-2">{c.phone}</td>
                        <td className="px-3 py-2">{dt(c.last_order_at)}</td>
                        <td className="px-3 py-2">
                          <button onClick={() => createQuickFollowup(c)} className="px-2 py-1 bg-blue-600 text-white rounded text-xs">Create Draft</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {message && <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">{message}</div>}
      {loading && <div className="fixed top-4 right-4 bg-gray-900 text-white px-3 py-1.5 rounded text-xs">Loading...</div>}
    </div>
  );
}
