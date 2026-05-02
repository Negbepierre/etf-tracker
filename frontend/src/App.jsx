import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from "recharts";

const API = "http://localhost:5002";

const ETF_LIST = [
  { id: "CSPX", label: "CSPX", name: "iShares Core S&P 500", benchmark: "S&P 500" },
  { id: "VUSA", label: "VUSA", name: "Vanguard S&P 500", benchmark: "S&P 500" },
  { id: "ISF",  label: "ISF",  name: "iShares Core FTSE 100", benchmark: "FTSE 100" },
];

const PERIODS = [
  { value: "1mo", label: "1M" },
  { value: "3mo", label: "3M" },
  { value: "6mo", label: "6M" },
  { value: "1y",  label: "1Y" },
];

const fmt = (v, dec = 2) =>
  v === null || v === undefined ? "—" : `${v >= 0 ? "+" : ""}${Number(v).toFixed(dec)}%`;

const fmtAbs = (v, dec = 2) =>
  v === null || v === undefined ? "—" : `${Number(v).toFixed(dec)}%`;

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#0f1117", border: "1px solid #2a2d3a",
      borderRadius: 6, padding: "10px 14px", fontSize: 12
    }}>
      <p style={{ color: "#6b7280", marginBottom: 6 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: "2px 0", fontFamily: "monospace" }}>
          {p.name}: {Number(p.value).toFixed(2)}%
        </p>
      ))}
    </div>
  );
};

const MetricCard = ({ label, value, sub, valueColor }) => (
  <div style={{
    background: "#0f1117", border: "1px solid #1e2130",
    borderRadius: 8, padding: "16px 20px", flex: 1, minWidth: 140
  }}>
    <p style={{ fontSize: 11, color: "#6b7280", letterSpacing: "0.06em", marginBottom: 8 }}>
      {label}
    </p>
    <p style={{
      fontSize: 22, fontFamily: "monospace", fontWeight: 600,
      color: valueColor || "#e8e8e8", margin: 0, letterSpacing: "-0.02em"
    }}>
      {value}
    </p>
    {sub && <p style={{ fontSize: 11, color: "#4b5563", marginTop: 6 }}>{sub}</p>}
  </div>
);

export default function App() {
  const [selectedETF, setSelectedETF] = useState("CSPX");
  const [period, setPeriod] = useState("6mo");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [commentary, setCommentary] = useState("");
  const [commentaryLoading, setCommentaryLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError("");
    setData(null);
    setCommentary("");
    try {
      const res = await axios.post(`${API}/api/analytics`, {
        etf_id: selectedETF, period
      });
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.error || "Failed to fetch data. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, [selectedETF, period]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const fetchCommentary = async () => {
    if (!data) return;
    setCommentaryLoading(true);
    setCommentary("");
    try {
      const res = await axios.post(`${API}/api/commentary`, {
        etf_name: data.etf_name,
        benchmark_name: data.benchmark_name,
        tracking_error: data.tracking_error,
        tracking_difference: data.tracking_difference,
        etf_return: data.etf_return,
        benchmark_return: data.benchmark_return,
        period_days: data.period_days,
        ter: data.ter,
      });
      setCommentary(res.data.commentary);
    } catch (e) {
      setCommentary("Commentary unavailable. Check Bedrock credentials.");
    } finally {
      setCommentaryLoading(false);
    }
  };

  const chartData = data?.chart?.dates?.map((d, i) => ({
    date: d,
    ETF: data.chart.etf_cumulative[i],
    Index: data.chart.benchmark_cumulative[i],
    "Rolling TE": data.chart.rolling_tracking_error[i],
  })) || [];

  const teColor = data
    ? data.tracking_error < 2 ? "#10b981"
      : data.tracking_error < 5 ? "#f59e0b" : "#ef4444"
    : "#e8e8e8";

  const tdColor = data
    ? data.tracking_difference >= 0 ? "#10b981" : "#ef4444"
    : "#e8e8e8";

  return (
    <div style={{ minHeight: "100vh", background: "#080b12", color: "#e8e8e8" }}>

      {/* Header */}
      <div style={{
        borderBottom: "1px solid #1e2130", padding: "18px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%", background: "#3b82f6"
          }} />
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", color: "#9ca3af" }}>
            ETF TRACKING ANALYTICS
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            fontSize: 10, background: "#0d2137", color: "#3b82f6",
            border: "1px solid #1d4ed8", borderRadius: 4, padding: "3px 8px",
            letterSpacing: "0.05em"
          }}>
            AWS BEDROCK
          </div>
          <div style={{
            fontSize: 10, background: "#0d1f0d", color: "#10b981",
            border: "1px solid #065f46", borderRadius: 4, padding: "3px 8px",
            letterSpacing: "0.05em"
          }}>
            FX ADJUSTED · GBP
          </div>
        </div>
      </div>

      <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto" }}>

        {/* Controls */}
        <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {ETF_LIST.map(e => (
              <button key={e.id} onClick={() => setSelectedETF(e.id)} style={{
                padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 500,
                cursor: "pointer", transition: "all 0.15s",
                background: selectedETF === e.id ? "#1d4ed8" : "#0f1117",
                color: selectedETF === e.id ? "#fff" : "#6b7280",
                border: selectedETF === e.id ? "1px solid #2563eb" : "1px solid #1e2130",
              }}>
                {e.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
            {PERIODS.map(p => (
              <button key={p.value} onClick={() => setPeriod(p.value)} style={{
                padding: "8px 14px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                background: period === p.value ? "#1e2130" : "transparent",
                color: period === p.value ? "#e8e8e8" : "#4b5563",
                border: period === p.value ? "1px solid #2a2d3a" : "1px solid transparent",
              }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* ETF Title */}
        {data && (
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: "#f3f4f6", margin: 0 }}>
              {data.etf_name}
            </h1>
            <p style={{ fontSize: 12, color: "#4b5563", marginTop: 4 }}>
              vs {data.benchmark_name} · {data.period_start} → {data.period_end} · {data.period_days} trading days · TER {data.ter}%
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: "#1f0a0a", border: "1px solid #7f1d1d",
            borderRadius: 8, padding: "14px 18px", marginBottom: 20,
            color: "#fca5a5", fontSize: 13
          }}>
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "40px 0", color: "#4b5563", fontSize: 13
          }}>
            <div style={{
              width: 16, height: 16, border: "2px solid #1e2130",
              borderTop: "2px solid #3b82f6", borderRadius: "50%",
              animation: "spin 0.8s linear infinite"
            }} />
            Fetching live market data and computing analytics...
          </div>
        )}

        {/* Metrics */}
        {data && !loading && (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              <MetricCard
                label="TRACKING ERROR (ANN.)"
                value={fmtAbs(data.tracking_error)}
                sub="annualised std dev of daily return diff"
                valueColor={teColor}
              />
              <MetricCard
                label="TRACKING DIFFERENCE"
                value={fmt(data.tracking_difference)}
                sub="ETF return minus index return"
                valueColor={tdColor}
              />
              <MetricCard
                label="ETF RETURN"
                value={fmt(data.etf_return)}
                sub={`${period} cumulative · GBP`}
                valueColor={data.etf_return >= 0 ? "#10b981" : "#ef4444"}
              />
              <MetricCard
                label="INDEX RETURN"
                value={fmt(data.benchmark_return)}
                sub={`${data.benchmark_name} · FX adjusted`}
                valueColor={data.benchmark_return >= 0 ? "#10b981" : "#ef4444"}
              />
            </div>

            {/* Cumulative Returns Chart */}
            <div style={{
              background: "#0f1117", border: "1px solid #1e2130",
              borderRadius: 8, padding: "20px 24px", marginBottom: 16
            }}>
              <p style={{
                fontSize: 11, color: "#6b7280", letterSpacing: "0.06em", marginBottom: 16
              }}>
                CUMULATIVE RETURN — ETF VS INDEX (GBP, FX ADJUSTED)
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2130" />
                  <XAxis dataKey="date" tick={{ fill: "#4b5563", fontSize: 10 }}
                    tickLine={false} axisLine={false} interval={14} />
                  <YAxis tick={{ fill: "#4b5563", fontSize: 10 }} tickLine={false}
                    axisLine={false} tickFormatter={v => `${v.toFixed(1)}%`} width={48} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#6b7280", paddingTop: 12 }} />
                  <Line type="monotone" dataKey="ETF" stroke="#3b82f6"
                    strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="Index" stroke="#4b5563"
                    strokeWidth={1} dot={false} strokeDasharray="4 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Rolling TE Chart */}
            <div style={{
              background: "#0f1117", border: "1px solid #1e2130",
              borderRadius: 8, padding: "20px 24px", marginBottom: 16
            }}>
              <p style={{
                fontSize: 11, color: "#6b7280", letterSpacing: "0.06em", marginBottom: 16
              }}>
                ROLLING 30-DAY TRACKING ERROR (ANNUALISED %)
              </p>
              <ResponsiveContainer width="100%" height={130}>
                <LineChart data={chartData} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2130" />
                  <XAxis dataKey="date" tick={{ fill: "#4b5563", fontSize: 10 }}
                    tickLine={false} axisLine={false} interval={14} />
                  <YAxis tick={{ fill: "#4b5563", fontSize: 10 }} tickLine={false}
                    axisLine={false} tickFormatter={v => v != null ? `${v.toFixed(1)}%` : ""}
                    width={48} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="Rolling TE" stroke="#f59e0b"
                    strokeWidth={1.5} dot={false} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Commentary */}
            <div style={{
              background: "#0f1117", border: "1px solid #1e2130",
              borderRadius: 8, padding: "20px 24px"
            }}>
              <div style={{
                display: "flex", alignItems: "center",
                justifyContent: "space-between", marginBottom: 14
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <p style={{
                    fontSize: 11, color: "#6b7280", letterSpacing: "0.06em", margin: 0
                  }}>
                    AI COMMENTARY
                  </p>
                  <span style={{
                    fontSize: 10, background: "#0d2137", color: "#3b82f6",
                    border: "1px solid #1d4ed8", borderRadius: 4, padding: "2px 7px"
                  }}>
                    Claude via Bedrock
                  </span>
                  <span style={{
                    fontSize: 10, color: "#374151", padding: "2px 0"
                  }}>
                    derived metrics only · zero data retention
                  </span>
                </div>
                <button onClick={fetchCommentary} disabled={commentaryLoading} style={{
                  padding: "7px 16px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                  background: commentaryLoading ? "#0f1117" : "#1d4ed8",
                  color: commentaryLoading ? "#4b5563" : "#fff",
                  border: "1px solid #2563eb", transition: "all 0.15s"
                }}>
                  {commentaryLoading ? "Generating..." : commentary ? "Regenerate" : "Generate"}
                </button>
              </div>

              {commentary ? (
                <p style={{
                  fontSize: 13, lineHeight: 1.8, color: "#d1d5db",
                  borderLeft: "2px solid #1d4ed8", paddingLeft: 14, margin: 0
                }}>
                  {commentary}
                </p>
              ) : (
                <p style={{ fontSize: 13, color: "#374151", fontStyle: "italic", margin: 0 }}>
                  Click Generate to produce client-ready commentary via AWS Bedrock.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        button:hover { opacity: 0.85; }
      `}</style>
    </div>
  );
}
