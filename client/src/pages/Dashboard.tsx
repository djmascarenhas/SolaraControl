import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import {
  BarChart3,
  TrendingUp,
  Clock,
  AlertTriangle,
  ShieldCheck,
  FileCheck,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#f97316"];

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export default function Dashboard() {
  const { lang } = useI18n();
  const { user } = useAuth();
  const pt = lang === "pt";

  const [range, setRange] = useState("30d");
  const [metric, setMetric] = useState("volume");
  const [breakdownBy, setBreakdownBy] = useState("category");

  const { from, to } = useMemo(() => {
    const now = new Date();
    let daysBack = 30;
    if (range === "7d") daysBack = 7;
    else if (range === "14d") daysBack = 14;
    else if (range === "90d") daysBack = 90;
    return {
      from: formatDate(new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)),
      to: formatDate(now),
    };
  }, [range]);

  const fetchApi = async (path: string) => {
    const res = await fetch(path, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
  };

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ["/api/dashboard/overview", from, to],
    queryFn: () => fetchApi(`/api/dashboard/overview?from=${from}&to=${to}`),
  });

  const { data: timeseries = [], isLoading: loadingTs } = useQuery({
    queryKey: ["/api/dashboard/timeseries", metric, from, to],
    queryFn: () => fetchApi(`/api/dashboard/timeseries?metric=${metric}&from=${from}&to=${to}&granularity=day`),
  });

  const { data: breakdowns = [] } = useQuery({
    queryKey: ["/api/dashboard/breakdowns", breakdownBy, from, to],
    queryFn: () => fetchApi(`/api/dashboard/breakdowns?by=${breakdownBy}&from=${from}&to=${to}`),
  });

  const { data: topIssues = [] } = useQuery({
    queryKey: ["/api/dashboard/top-issues", from, to],
    queryFn: () => fetchApi(`/api/dashboard/top-issues?from=${from}&to=${to}&limit=10`),
  });

  if (user?.role !== "admin") {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full text-muted-foreground">
          {pt ? "Acesso restrito a administradores." : "Access restricted to administrators."}
        </div>
      </Layout>
    );
  }

  const tsFormatted = timeseries.map((d: any) => ({
    ...d,
    label: d.period ? new Date(d.period).toLocaleDateString(pt ? "pt-BR" : "en-US", { month: "short", day: "numeric" }) : "",
  }));

  const kpis = [
    {
      label: pt ? "Total Eventos" : "Total Events",
      value: overview?.total_events ?? 0,
      icon: BarChart3,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: pt ? "Tempo Médio Resp." : "Avg Response Time",
      value: overview?.avg_response_time ? `${(overview.avg_response_time / 1000).toFixed(1)}s` : "0s",
      icon: Clock,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      label: pt ? "Taxa Escalonamento" : "Escalation Rate",
      value: overview?.escalation_rate ? `${overview.escalation_rate.toFixed(1)}%` : "0%",
      icon: ArrowUpRight,
      color: "text-red-500",
      bg: "bg-red-500/10",
    },
    {
      label: pt ? "% Alta Confiança" : "% High Confidence",
      value: overview?.high_confidence_pct ? `${overview.high_confidence_pct.toFixed(1)}%` : "0%",
      icon: ShieldCheck,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: pt ? "% Com Fonte" : "% With Citations",
      value: overview?.with_citations_pct ? `${overview.with_citations_pct.toFixed(1)}%` : "0%",
      icon: FileCheck,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
    {
      label: pt ? "Risco Alto" : "High Risk",
      value: overview?.risk_high_count ?? 0,
      icon: AlertTriangle,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
  ];

  const metricOptions = [
    { value: "volume", label: pt ? "Volume" : "Volume" },
    { value: "response_time", label: pt ? "Tempo Resposta" : "Response Time" },
    { value: "confidence", label: pt ? "Confiança" : "Confidence" },
    { value: "escalation", label: pt ? "Escalonamento" : "Escalation" },
  ];

  const breakdownOptions = [
    { value: "category", label: pt ? "Categoria" : "Category" },
    { value: "agent", label: pt ? "Agente" : "Agent" },
    { value: "risk", label: pt ? "Risco" : "Risk" },
    { value: "channel", label: pt ? "Canal" : "Channel" },
  ];

  const rangeOptions = [
    { value: "7d", label: "7d" },
    { value: "14d", label: "14d" },
    { value: "30d", label: "30d" },
    { value: "90d", label: "90d" },
  ];

  return (
    <Layout>
      <div className="h-full overflow-y-auto p-3 sm:p-6">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <h1 className="text-lg sm:text-xl font-bold" data-testid="text-dashboard-title">
                {pt ? "Dashboard Executivo" : "Executive Dashboard"}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                {pt ? "Visão geral das operações de suporte" : "Support operations overview"}
              </p>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              {rangeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRange(opt.value)}
                  className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    range === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                  data-testid={`button-range-${opt.value}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* KPI Cards */}
          {loadingOverview ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              {kpis.map((kpi, i) => {
                const Icon = kpi.icon;
                return (
                  <div
                    key={i}
                    className="border rounded-lg p-3 sm:p-4 bg-card"
                    data-testid={`card-kpi-${i}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-md flex items-center justify-center ${kpi.bg}`}>
                        <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${kpi.color}`} />
                      </div>
                    </div>
                    <p className="text-lg sm:text-2xl font-bold tabular-nums">{kpi.value}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 leading-tight">{kpi.label}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Ticket Stats Row */}
          {overview && (
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <div className="border rounded-lg p-3 sm:p-4 bg-card">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">{pt ? "Total Tickets" : "Total Tickets"}</p>
                <p className="text-lg sm:text-2xl font-bold mt-1" data-testid="text-total-tickets">{overview.total_tickets}</p>
              </div>
              <div className="border rounded-lg p-3 sm:p-4 bg-card">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">{pt ? "Abertos" : "Open"}</p>
                <p className="text-lg sm:text-2xl font-bold mt-1 text-amber-500" data-testid="text-open-tickets">{overview.open_tickets}</p>
              </div>
              <div className="border rounded-lg p-3 sm:p-4 bg-card">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">{pt ? "Concluídos" : "Done"}</p>
                <p className="text-lg sm:text-2xl font-bold mt-1 text-emerald-500" data-testid="text-done-tickets">{overview.done_tickets}</p>
              </div>
            </div>
          )}

          {/* Timeseries Chart */}
          <div className="border rounded-lg p-3 sm:p-4 bg-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-4">
              <h2 className="text-sm font-semibold">{pt ? "Linha do Tempo" : "Timeseries"}</h2>
              <div className="flex items-center gap-1 flex-wrap">
                {metricOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setMetric(opt.value)}
                    className={`px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs rounded-md transition-colors ${
                      metric === opt.value
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                    data-testid={`button-metric-${opt.value}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {loadingTs ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : tsFormatted.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                {pt ? "Sem dados para o período selecionado" : "No data for selected period"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220} className="sm:!h-[280px]">
                <LineChart data={tsFormatted}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={35} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Breakdowns + Top Issues */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            {/* Breakdown */}
            <div className="border rounded-lg p-3 sm:p-4 bg-card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold">{pt ? "Distribuição" : "Breakdown"}</h2>
                <select
                  value={breakdownBy}
                  onChange={(e) => setBreakdownBy(e.target.value)}
                  className="text-xs border rounded-md px-2 py-1 bg-background"
                  data-testid="select-breakdown"
                >
                  {breakdownOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              {breakdowns.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  {pt ? "Sem dados" : "No data"}
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="w-full sm:w-40 h-40 sm:h-48 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={breakdowns}
                          dataKey="count"
                          nameKey="label"
                          cx="50%"
                          cy="50%"
                          outerRadius={55}
                          innerRadius={22}
                        >
                          {breakdowns.map((_: any, idx: number) => (
                            <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-1.5 overflow-y-auto max-h-48">
                    {breakdowns.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-sm py-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[idx % COLORS.length] }} />
                          <span className="truncate max-w-[150px] sm:max-w-[120px]">{item.label}</span>
                        </div>
                        <span className="font-mono text-xs tabular-nums">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Top Issues */}
            <div className="border rounded-lg p-3 sm:p-4 bg-card">
              <h2 className="text-sm font-semibold mb-4">{pt ? "Top Problemas" : "Top Issues"}</h2>
              {topIssues.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  {pt ? "Sem dados" : "No data"}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="text-left py-2 font-medium">{pt ? "Categoria" : "Category"}</th>
                        <th className="text-left py-2 font-medium">{pt ? "Risco" : "Risk"}</th>
                        <th className="text-right py-2 font-medium">{pt ? "Qtd" : "Count"}</th>
                        <th className="text-right py-2 font-medium">{pt ? "TMR" : "Avg RT"}</th>
                        <th className="text-right py-2 font-medium">{pt ? "Escal." : "Escal."}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topIssues.map((issue: any, idx: number) => (
                        <tr key={idx} className="border-b last:border-0">
                          <td className="py-2">{issue.category}</td>
                          <td className="py-2">
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded-full ${
                                issue.risk_level === "high"
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                  : issue.risk_level === "medium"
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                  : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              }`}
                            >
                              {issue.risk_level}
                            </span>
                          </td>
                          <td className="py-2 text-right font-mono tabular-nums">{issue.count}</td>
                          <td className="py-2 text-right font-mono tabular-nums">{(issue.avg_response_time / 1000).toFixed(1)}s</td>
                          <td className="py-2 text-right font-mono tabular-nums">{issue.escalation_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Agent Performance */}
          {breakdownBy !== "agent" && (
            <AgentPerformance from={from} to={to} pt={pt} />
          )}
        </div>
      </div>
    </Layout>
  );
}

function AgentPerformance({ from, to, pt }: { from: string; to: string; pt: boolean }) {
  const { data: agentData = [] } = useQuery({
    queryKey: ["/api/dashboard/breakdowns", "agent", from, to],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/breakdowns?by=agent&from=${from}&to=${to}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  if (agentData.length === 0) return null;

  return (
    <div className="border rounded-lg p-3 sm:p-4 bg-card">
      <h2 className="text-sm font-semibold mb-4">{pt ? "Performance por Agente" : "Agent Performance"}</h2>
      <ResponsiveContainer width="100%" height={180} className="sm:!h-[200px]">
        <BarChart data={agentData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={35} />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
