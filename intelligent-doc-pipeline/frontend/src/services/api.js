import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "/api";

const api = axios.create({ baseURL: API_BASE });

// ── Documents ───────────────────────────────────────────────

export async function uploadFiles(files) {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  const { data } = await api.post("/documents/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function getDocuments(params = {}) {
  const { data } = await api.get("/documents", { params });
  return data;
}

export async function getDocument(id) {
  const { data } = await api.get(`/documents/${id}`);
  return data;
}

export async function reprocessDocument(id) {
  const { data } = await api.post(`/documents/${id}/reprocess`);
  return data;
}

export async function deleteDocument(id) {
  const { data } = await api.delete(`/documents/${id}`);
  return data;
}

// ── Analytics ───────────────────────────────────────────────

export async function getSummary() {
  const { data } = await api.get("/analytics/summary");
  return data;
}

export async function getVendorBreakdown() {
  const { data } = await api.get("/analytics/by-vendor");
  return data;
}

export async function getCategoryBreakdown() {
  const { data } = await api.get("/analytics/by-category");
  return data;
}

export async function getTimeline() {
  const { data } = await api.get("/analytics/timeline");
  return data;
}

export async function getAnomalyBreakdown() {
  const { data } = await api.get("/analytics/anomaly-breakdown");
  return data;
}

// ── Knowledge Base ──────────────────────────────────────────

export async function getKnowledgeBase(params = {}) {
  const { data } = await api.get("/knowledge", { params });
  return data;
}

export async function createKBEntry(entry) {
  const { data } = await api.post("/knowledge", entry);
  return data;
}

export async function updateKBEntry(id, entry) {
  const { data } = await api.put(`/knowledge/${id}`, entry);
  return data;
}

export async function deleteKBEntry(id) {
  const { data } = await api.delete(`/knowledge/${id}`);
  return data;
}

// ── WebSocket ───────────────────────────────────────────────

export function connectWebSocket(onMessage) {
  const wsUrl =
    API_BASE.replace(/^http/, "ws").replace(/\/api$/, "") + "/ws";
  const ws = new WebSocket(wsUrl);

  ws.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch {
      // ignore non-JSON
    }
  };

  ws.onclose = () => {
    // Reconnect after 3s
    setTimeout(() => connectWebSocket(onMessage), 3000);
  };

  return ws;
}
