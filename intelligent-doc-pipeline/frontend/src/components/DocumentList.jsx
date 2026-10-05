import React from "react";
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  XCircle,
  RotateCw,
  Trash2,
  ChevronRight,
} from "lucide-react";

const STATUS_CONFIG = {
  uploaded:   { icon: FileText,      color: "var(--color-muted)",   label: "Uploaded" },
  parsing:    { icon: Loader2,       color: "var(--color-info)",    label: "Parsing" },
  extracting: { icon: Loader2,       color: "var(--color-info)",    label: "Extracting" },
  matching:   { icon: Loader2,       color: "var(--color-info)",    label: "Matching" },
  analyzing:  { icon: Loader2,       color: "var(--color-info)",    label: "Analyzing" },
  completed:  { icon: CheckCircle2,  color: "var(--color-success)", label: "Completed" },
  failed:     { icon: XCircle,       color: "var(--color-danger)",  label: "Failed" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.uploaded;
  const Icon = cfg.icon;
  const isSpinning = ["parsing", "extracting", "matching", "analyzing"].includes(status);

  return (
    <span className="badge" style={{ "--badge-color": cfg.color }}>
      <Icon size={14} className={isSpinning ? "spin" : ""} />
      {cfg.label}
    </span>
  );
}

export default function DocumentList({
  documents,
  pagination,
  loading,
  filters,
  setFilters,
  fetchDocs,
  onSelect,
  onReprocess,
  onDelete,
}) {
  return (
    <div className="doc-list">
      <div className="doc-list__header">
        <h2>Documents</h2>
        <div className="doc-list__filters">
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="">All statuses</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
          <label className="doc-list__checkbox">
            <input
              type="checkbox"
              checked={filters.anomaly === "true"}
              onChange={(e) =>
                setFilters((f) => ({ ...f, anomaly: e.target.checked ? "true" : "" }))
              }
            />
            Anomalies only
          </label>
        </div>
      </div>

      {loading ? (
        <div className="doc-list__empty">
          <Loader2 size={24} className="spin" /> Loading…
        </div>
      ) : documents.length === 0 ? (
        <div className="doc-list__empty">No documents yet. Upload some files to get started.</div>
      ) : (
        <table className="doc-table">
          <thead>
            <tr>
              <th>File</th>
              <th>Status</th>
              <th>Vendor</th>
              <th>Total</th>
              <th>Anomaly</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc._id} onClick={() => onSelect(doc._id)} className="doc-table__row">
                <td>
                  <span className="doc-table__filename">{doc.originalName || doc.filename}</span>
                  <span className="doc-table__type">{doc.fileType.toUpperCase()}</span>
                </td>
                <td>
                  <StatusBadge status={doc.status} />
                </td>
                <td>{doc.extracted?.vendor || "—"}</td>
                <td>
                  {doc.extracted?.total != null
                    ? `$${doc.extracted.total.toLocaleString()}`
                    : "—"}
                </td>
                <td>
                  {doc.anomaly?.isAnomaly ? (
                    <AlertTriangle size={16} style={{ color: "var(--color-warning)" }} />
                  ) : doc.status === "completed" ? (
                    <CheckCircle2 size={16} style={{ color: "var(--color-success)" }} />
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <div className="doc-table__actions" onClick={(e) => e.stopPropagation()}>
                    <button title="Reprocess" onClick={() => onReprocess(doc._id)}>
                      <RotateCw size={14} />
                    </button>
                    <button title="Delete" onClick={() => onDelete(doc._id)}>
                      <Trash2 size={14} />
                    </button>
                    <ChevronRight size={14} className="doc-table__chevron" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {pagination.pages > 1 && (
        <div className="doc-list__pagination">
          {Array.from({ length: pagination.pages }, (_, i) => (
            <button
              key={i}
              className={pagination.page === i + 1 ? "active" : ""}
              onClick={() => fetchDocs(i + 1)}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
