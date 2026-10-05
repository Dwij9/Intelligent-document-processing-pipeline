import React from "react";
import { ArrowLeft, AlertTriangle, CheckCircle2, Link2 } from "lucide-react";
import { useDocument } from "../hooks/useDocuments";

function Field({ label, value }) {
  if (value == null || value === "") return null;
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <span className="field__value">{value}</span>
    </div>
  );
}

export default function ExtractedData({ docId, onBack }) {
  const { doc, loading } = useDocument(docId);

  if (loading) return <div className="detail-panel">Loading…</div>;
  if (!doc) return <div className="detail-panel">Document not found.</div>;

  const e = doc.extracted || {};
  const a = doc.anomaly || {};
  const matches = doc.matches || [];

  return (
    <div className="detail-panel">
      <button className="detail-panel__back" onClick={onBack}>
        <ArrowLeft size={16} /> Back to list
      </button>

      <h2>{doc.originalName || doc.filename}</h2>

      {/* ── Anomaly banner ──────────────────────────────── */}
      {a.isAnomaly && (
        <div className="anomaly-banner">
          <AlertTriangle size={18} />
          <div>
            <strong>Anomaly detected</strong> (score: {a.score})
            <ul>
              {a.reasons?.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {!a.isAnomaly && doc.status === "completed" && (
        <div className="ok-banner">
          <CheckCircle2 size={18} />
          No anomalies detected
        </div>
      )}

      {/* ── Extracted fields ────────────────────────────── */}
      <section className="detail-section">
        <h3>Extracted data</h3>
        <div className="fields-grid">
          <Field label="Document type" value={e.documentType} />
          <Field label="Vendor" value={e.vendor} />
          <Field label="Invoice #" value={e.invoiceNumber} />
          <Field label="Date" value={e.date?.slice(0, 10)} />
          <Field label="Due date" value={e.dueDate?.slice(0, 10)} />
          <Field label="Subtotal" value={e.subtotal != null ? `$${e.subtotal.toLocaleString()}` : null} />
          <Field label="Tax" value={e.tax != null ? `$${e.tax.toLocaleString()}` : null} />
          <Field label="Total" value={e.total != null ? `$${e.total.toLocaleString()}` : null} />
          <Field label="Currency" value={e.currency} />
          <Field label="Confidence" value={e.confidence != null ? `${(e.confidence * 100).toFixed(0)}%` : null} />
        </div>
        {e.notes && <p className="detail-notes">{e.notes}</p>}
      </section>

      {/* ── Line items ──────────────────────────────────── */}
      {e.lineItems?.length > 0 && (
        <section className="detail-section">
          <h3>Line items</h3>
          <table className="line-items-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit price</th>
                <th>Amount</th>
                <th>Category</th>
                <th>GL code</th>
              </tr>
            </thead>
            <tbody>
              {e.lineItems.map((li, i) => (
                <tr key={i}>
                  <td>{li.description}</td>
                  <td>{li.quantity ?? "—"}</td>
                  <td>{li.unitPrice != null ? `$${li.unitPrice}` : "—"}</td>
                  <td>${li.amount?.toLocaleString()}</td>
                  <td>{li.category || "—"}</td>
                  <td>{li.glCode || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ── Matches ─────────────────────────────────────── */}
      {matches.length > 0 && (
        <section className="detail-section">
          <h3>Knowledge base matches</h3>
          <div className="matches-list">
            {matches.map((m, i) => (
              <div key={i} className="match-card">
                <Link2 size={14} />
                <div>
                  <strong>{m.field}</strong> matched <em>{m.matchedEntity}</em>
                  <span className="match-card__conf">
                    {(m.confidence * 100).toFixed(0)}% ({m.matchType})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Processing metadata ─────────────────────────── */}
      <section className="detail-section detail-section--meta">
        <Field label="Status" value={doc.status} />
        <Field label="Processing time" value={doc.processingTimeMs ? `${doc.processingTimeMs} ms` : null} />
        <Field label="Uploaded" value={new Date(doc.createdAt).toLocaleString()} />
      </section>
    </div>
  );
}
