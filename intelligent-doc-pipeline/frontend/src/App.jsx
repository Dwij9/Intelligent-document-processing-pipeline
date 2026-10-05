import React, { useState } from "react";
import { FileStack, BarChart3, Database } from "lucide-react";
import DocumentUpload from "./components/DocumentUpload";
import DocumentList from "./components/DocumentList";
import ExtractedData from "./components/ExtractedData";
import Analytics from "./components/Analytics";
import { useDocuments } from "./hooks/useDocuments";

const TABS = [
  { id: "documents", label: "Documents", icon: FileStack },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
];

export default function App() {
  const [tab, setTab] = useState("documents");
  const [selectedDocId, setSelectedDocId] = useState(null);
  const docs = useDocuments();

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {/* ── Sidebar ─────────────────────────────────── */}
        <nav className="sidebar">
          <div className="sidebar__brand">
            <Database size={22} />
            <span>DocPipeline</span>
          </div>
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`sidebar__item ${tab === t.id ? "sidebar__item--active" : ""}`}
              onClick={() => {
                setTab(t.id);
                setSelectedDocId(null);
              }}
            >
              <t.icon size={18} />
              {t.label}
            </button>
          ))}
        </nav>

        {/* ── Main content ────────────────────────────── */}
        <main className="main">
          {tab === "documents" && !selectedDocId && (
            <>
              <DocumentUpload onUpload={docs.upload} />
              <DocumentList
                documents={docs.documents}
                pagination={docs.pagination}
                loading={docs.loading}
                filters={docs.filters}
                setFilters={docs.setFilters}
                fetchDocs={docs.fetchDocs}
                onSelect={setSelectedDocId}
                onReprocess={docs.reprocess}
                onDelete={docs.remove}
              />
            </>
          )}

          {tab === "documents" && selectedDocId && (
            <ExtractedData docId={selectedDocId} onBack={() => setSelectedDocId(null)} />
          )}

          {tab === "analytics" && <Analytics />}
        </main>
      </div>
    </>
  );
}

/* ── Styles ──────────────────────────────────────────────── */
const CSS = `
  :root {
    --color-bg: #0f1117;
    --color-surface: #181a20;
    --color-surface-2: #1e2028;
    --color-border: #2a2d36;
    --color-text: #e4e5e9;
    --color-text-dim: #8b8e98;
    --color-primary: #3b82f6;
    --color-primary-dim: #2563eb;
    --color-success: #10b981;
    --color-warning: #f59e0b;
    --color-danger: #ef4444;
    --color-info: #06b6d4;
    --color-muted: #6b7280;
    --font: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
    --radius: 8px;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: var(--font);
    background: var(--color-bg);
    color: var(--color-text);
    line-height: 1.55;
  }

  .app {
    display: flex;
    min-height: 100vh;
  }

  /* ── Sidebar ───────────────────────────────────────── */
  .sidebar {
    width: 220px;
    background: var(--color-surface);
    border-right: 1px solid var(--color-border);
    padding: 20px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    position: sticky;
    top: 0;
    height: 100vh;
  }

  .sidebar__brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 700;
    font-size: 17px;
    padding: 8px 12px 20px;
    color: var(--color-primary);
  }

  .sidebar__item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border: none;
    background: none;
    color: var(--color-text-dim);
    font: inherit;
    font-size: 14px;
    border-radius: var(--radius);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .sidebar__item:hover { background: var(--color-surface-2); color: var(--color-text); }
  .sidebar__item--active { background: var(--color-primary-dim); color: #fff; }

  /* ── Main ──────────────────────────────────────────── */
  .main {
    flex: 1;
    padding: 28px 36px;
    max-width: 1200px;
  }

  /* ── Upload zone ───────────────────────────────────── */
  .upload-zone {
    border: 2px dashed var(--color-border);
    border-radius: var(--radius);
    padding: 40px;
    text-align: center;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    margin-bottom: 28px;
    color: var(--color-text-dim);
  }
  .upload-zone:hover, .upload-zone--active {
    border-color: var(--color-primary);
    background: rgba(59,130,246,0.05);
  }
  .upload-zone__title { font-size: 15px; font-weight: 500; margin: 12px 0 4px; color: var(--color-text); }
  .upload-zone__hint { font-size: 13px; }

  /* ── Document list ─────────────────────────────────── */
  .doc-list__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  .doc-list__header h2 { font-size: 18px; font-weight: 600; }
  .doc-list__filters { display: flex; gap: 12px; align-items: center; }
  .doc-list__filters select {
    background: var(--color-surface);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    padding: 6px 10px;
    border-radius: 6px;
    font: inherit;
    font-size: 13px;
  }
  .doc-list__checkbox {
    display: flex; align-items: center; gap: 6px;
    font-size: 13px; color: var(--color-text-dim); cursor: pointer;
  }
  .doc-list__empty {
    text-align: center;
    padding: 48px 0;
    color: var(--color-text-dim);
    display: flex; align-items: center; justify-content: center; gap: 8px;
  }

  .doc-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13.5px;
  }
  .doc-table th {
    text-align: left;
    padding: 10px 12px;
    font-weight: 500;
    color: var(--color-text-dim);
    border-bottom: 1px solid var(--color-border);
    font-size: 12px;
  }
  .doc-table td {
    padding: 12px;
    border-bottom: 1px solid var(--color-border);
    vertical-align: middle;
  }
  .doc-table__row { cursor: pointer; transition: background 0.12s; }
  .doc-table__row:hover { background: var(--color-surface-2); }

  .doc-table__filename { font-weight: 500; }
  .doc-table__type {
    font-size: 11px;
    font-family: var(--font-mono);
    background: var(--color-surface-2);
    padding: 2px 6px;
    border-radius: 4px;
    margin-left: 8px;
    color: var(--color-text-dim);
  }
  .doc-table__actions { display: flex; gap: 6px; align-items: center; }
  .doc-table__actions button {
    background: none; border: none; color: var(--color-text-dim);
    cursor: pointer; padding: 4px; border-radius: 4px;
    transition: color 0.15s, background 0.15s;
  }
  .doc-table__actions button:hover { color: var(--color-text); background: var(--color-surface); }
  .doc-table__chevron { color: var(--color-text-dim); }

  /* ── Badges ────────────────────────────────────────── */
  .badge {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 12px; font-weight: 500;
    padding: 3px 10px;
    border-radius: 20px;
    background: color-mix(in srgb, var(--badge-color) 15%, transparent);
    color: var(--badge-color);
  }

  /* ── Pagination ────────────────────────────────────── */
  .doc-list__pagination {
    display: flex; gap: 4px; margin-top: 16px; justify-content: center;
  }
  .doc-list__pagination button {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    color: var(--color-text-dim);
    padding: 6px 12px; border-radius: 6px;
    cursor: pointer; font: inherit; font-size: 13px;
  }
  .doc-list__pagination button.active {
    background: var(--color-primary); color: #fff; border-color: var(--color-primary);
  }

  /* ── Detail panel ──────────────────────────────────── */
  .detail-panel { max-width: 880px; }
  .detail-panel__back {
    display: inline-flex; align-items: center; gap: 6px;
    background: none; border: none; color: var(--color-primary);
    font: inherit; font-size: 13px; cursor: pointer; margin-bottom: 16px;
  }
  .detail-panel h2 { font-size: 20px; font-weight: 600; margin-bottom: 16px; }

  .anomaly-banner {
    display: flex; gap: 12px; align-items: flex-start;
    background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.25);
    border-radius: var(--radius);
    padding: 14px 18px;
    margin-bottom: 20px;
    color: var(--color-danger);
  }
  .anomaly-banner ul { margin-top: 6px; padding-left: 18px; font-size: 13px; color: var(--color-text); }

  .ok-banner {
    display: flex; gap: 10px; align-items: center;
    background: rgba(16,185,129,0.08);
    border: 1px solid rgba(16,185,129,0.25);
    border-radius: var(--radius);
    padding: 12px 18px;
    margin-bottom: 20px;
    color: var(--color-success);
    font-size: 14px;
  }

  .detail-section {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 20px;
    margin-bottom: 16px;
  }
  .detail-section h3 { font-size: 14px; font-weight: 600; margin-bottom: 14px; }

  .fields-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 14px; }
  .field__label { display: block; font-size: 11px; color: var(--color-text-dim); margin-bottom: 2px; }
  .field__value { font-size: 14px; font-weight: 500; }
  .detail-notes { margin-top: 12px; font-size: 13px; color: var(--color-text-dim); }

  .line-items-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .line-items-table th {
    text-align: left; padding: 8px 10px;
    font-weight: 500; font-size: 11px; color: var(--color-text-dim);
    border-bottom: 1px solid var(--color-border);
  }
  .line-items-table td { padding: 8px 10px; border-bottom: 1px solid var(--color-border); }

  .matches-list { display: flex; flex-direction: column; gap: 8px; }
  .match-card {
    display: flex; gap: 10px; align-items: center;
    background: var(--color-surface-2);
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 13px;
  }
  .match-card__conf {
    margin-left: 8px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-text-dim);
  }

  .detail-section--meta { display: flex; gap: 24px; }

  /* ── Analytics ─────────────────────────────────────── */
  .analytics { max-width: 1100px; }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 12px;
    margin-bottom: 24px;
  }
  .stat-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 18px;
    text-align: center;
  }
  .stat-card__value { display: block; font-size: 26px; font-weight: 700; color: var(--color-primary); }
  .stat-card__label { display: block; font-size: 12px; color: var(--color-text-dim); margin-top: 4px; }
  .stat-card__sub { display: block; font-size: 11px; color: var(--color-muted); margin-top: 2px; }

  .chart-panel {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 20px;
    margin-bottom: 16px;
  }
  .chart-panel h3 { font-size: 14px; font-weight: 600; margin-bottom: 16px; }

  .chart-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 860px) { .chart-row { grid-template-columns: 1fr; } }

  /* ── Utilities ─────────────────────────────────────── */
  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  @media (max-width: 700px) {
    .sidebar { width: 64px; padding: 16px 8px; }
    .sidebar__brand span, .sidebar__item span:not(svg) { display: none; }
    .main { padding: 16px; }
  }
`;
