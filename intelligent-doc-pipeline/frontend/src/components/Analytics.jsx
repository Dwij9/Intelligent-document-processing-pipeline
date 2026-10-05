import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  getSummary,
  getVendorBreakdown,
  getCategoryBreakdown,
  getTimeline,
  getAnomalyBreakdown,
} from "../services/api";

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];

function StatCard({ label, value, sub }) {
  return (
    <div className="stat-card">
      <span className="stat-card__value">{value}</span>
      <span className="stat-card__label">{label}</span>
      {sub && <span className="stat-card__sub">{sub}</span>}
    </div>
  );
}

export default function Analytics() {
  const [summary, setSummary] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [anomalyReasons, setAnomalyReasons] = useState([]);

  useEffect(() => {
    getSummary().then(setSummary).catch(console.error);
    getVendorBreakdown().then(setVendors).catch(console.error);
    getCategoryBreakdown().then(setCategories).catch(console.error);
    getTimeline().then(setTimeline).catch(console.error);
    getAnomalyBreakdown().then(setAnomalyReasons).catch(console.error);
  }, []);

  if (!summary) return <div className="analytics">Loading analytics…</div>;

  return (
    <div className="analytics">
      {/* ── Summary cards ─────────────────────────────── */}
      <div className="stat-grid">
        <StatCard label="Total documents" value={summary.totalDocuments} />
        <StatCard label="Completed" value={summary.completed} />
        <StatCard label="Anomalies flagged" value={summary.anomalies} />
        <StatCard
          label="Total value processed"
          value={`$${Math.round(summary.totalValueProcessed).toLocaleString()}`}
        />
        <StatCard
          label="Avg processing time"
          value={`${(summary.avgProcessingTimeMs / 1000).toFixed(1)}s`}
        />
        <StatCard label="Failed" value={summary.failed} />
      </div>

      {/* ── Timeline chart ────────────────────────────── */}
      <div className="chart-panel">
        <h3>Processing volume — last 30 days</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={timeline}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="count" stroke="#3b82f6" name="Documents" strokeWidth={2} />
            <Line type="monotone" dataKey="anomalies" stroke="#ef4444" name="Anomalies" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-row">
        {/* ── Vendor spend ───────────────────────────── */}
        <div className="chart-panel">
          <h3>Spend by vendor</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={vendors.slice(0, 8)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="vendor" type="category" width={120} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `$${v.toLocaleString()}`} />
              <Bar dataKey="totalSpend" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── Category distribution ──────────────────── */}
        <div className="chart-panel">
          <h3>Spend by category</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={categories.slice(0, 7)}
                dataKey="totalAmount"
                nameKey="category"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ category }) => category}
              >
                {categories.slice(0, 7).map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `$${v.toLocaleString()}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Anomaly reasons ───────────────────────────── */}
      {anomalyReasons.length > 0 && (
        <div className="chart-panel">
          <h3>Anomaly reasons</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={anomalyReasons}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="reason" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
