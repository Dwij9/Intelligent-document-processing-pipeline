import { useState, useEffect, useCallback } from "react";
import {
  getDocuments,
  getDocument,
  uploadFiles,
  deleteDocument,
  reprocessDocument,
  connectWebSocket,
} from "../services/api";

export function useDocuments() {
  const [documents, setDocuments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: "", anomaly: "" });

  const fetchDocs = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params = { page, limit: 20 };
        if (filters.status) params.status = filters.status;
        if (filters.anomaly) params.anomaly = filters.anomaly;
        const data = await getDocuments(params);
        setDocuments(data.documents);
        setPagination(data.pagination);
      } catch (err) {
        console.error("Failed to fetch documents:", err);
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  // Initial fetch + WebSocket
  useEffect(() => {
    fetchDocs();

    const ws = connectWebSocket((msg) => {
      // Refresh the list when any document changes status
      if (msg.docId) fetchDocs();
    });

    return () => ws.close();
  }, [fetchDocs]);

  const upload = async (files) => {
    const result = await uploadFiles(files);
    await fetchDocs();
    return result;
  };

  const remove = async (id) => {
    await deleteDocument(id);
    await fetchDocs();
  };

  const reprocess = async (id) => {
    await reprocessDocument(id);
    await fetchDocs();
  };

  return {
    documents,
    pagination,
    loading,
    filters,
    setFilters,
    fetchDocs,
    upload,
    remove,
    reprocess,
  };
}

export function useDocument(id) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getDocument(id)
      .then(setDoc)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  return { doc, loading };
}
