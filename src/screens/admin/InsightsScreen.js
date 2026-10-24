import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, Alert, ActivityIndicator, TouchableOpacity, Share } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../lib/api";
import ScreenTitle from "../../components/ScreenTitle";
import { F, C, fmtMoney } from "../../lib/theme";
import { DCAL_COLORS } from "../../components/DayCalendarView";
import { SkeletonKPI, SkeletonCard } from "../../components/Skeleton";
import ErrorState from "../../components/ErrorState";
import { getCached, setCache } from "../../lib/cache";
import { useRole } from "../../lib/RoleContext";

// ── Date helpers ──────────────────────────────────────────────────────────────
function isoToday() { return new Date().toISOString().split("T")[0]; }
function isoOffset(days) {
  const d = new Date(); d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
function getDateRange(period) {
  const now = new Date();
  switch (period) {
    case "week": {
      const mon = new Date(now);
      mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      return { from: mon.toISOString().split("T")[0], to: isoToday() };
    }
    case "month": {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: d.toISOString().split("T")[0], to: isoToday() };
    }
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end   = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: start.toISOString().split("T")[0], to: end.toISOString().split("T")[0] };
    }
    case "year": {
      return { from: `${now.getFullYear()}-01-01`, to: isoToday() };
    }
    default: return { from: null, to: null }; // all time
  }
}
function getPriorDateRange(period) {
  const now = new Date();
  switch (period) {
    case "week": {
      const end = new Date(now);
      end.setDate(now.getDate() - ((now.getDay() + 6) % 7) - 1);
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      return { from: start.toISOString().split("T")[0], to: end.toISOString().split("T")[0] };
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end   = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: start.toISOString().split("T")[0], to: end.toISOString().split("T")[0] };
    }
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const end   = new Date(now.getFullYear(), now.getMonth() - 1, 0);
      return { from: start.toISOString().split("T")[0], to: end.toISOString().split("T")[0] };
    }
    case "year": {
      return { from: `${now.getFullYear() - 1}-01-01`, to: `${now.getFullYear() - 1}-12-31` };
    }
    default: return { from: null, to: null };
  }
}

const PERIODS = [
  { key: "week",       label: "This week" },
  { key: "month",      label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "year",       label: "This year" },
  { key: "all",        label: "All time" },
];


// ── KPI Card ──────────────────────────────────────────────────────────────────
// Stat card: a mono label, one big number, one line of context (brand/components/StatCards).
// Up is success with an arrow, never colour alone. A rising cancel rate is not good news.
function KPICard({ value, label, trend, night, lowerIsBetter }) {
  const good = trend == null ? null : (lowerIsBetter ? trend <= 0 : trend >= 0);
  return (
    <View style={[styles.kpi, night && styles.kpiNight]}>
      <Text style={[styles.kpiLabel, night && { color: C.nightMuted }]}>{label}</Text>
      <Text style={[styles.kpiValue, night && { color: C.onNight }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {trend !== null && trend !== undefined && (
        <View style={styles.kpiTrendRow}>
          <Ionicons name={trend >= 0 ? "arrow-up" : "arrow-down"} size={12} color={night ? C.onNight : good ? C.success : C.danger} />
          <Text style={[styles.kpiTrend, { color: night ? C.onNight : good ? C.success : C.danger }]}>
            {Math.abs(trend)}% <Text style={{ color: night ? C.nightMuted : C.muted, fontFamily: F.regular }}>vs last period</Text>
          </Text>
        </View>
      )}
    </View>
  );
}

function shortMoney(n) {
  const v = Math.round(n);
  if (v >= 1000) return `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return `$${v}`;
}

// ── Revenue Bar Chart ─────────────────────────────────────────────────────────
function RevenueChart({ data }) {
  if (!data || data.length === 0) {
    return <View style={styles.chartEmpty}><Text style={styles.chartEmptyText}>No revenue data for this period.</Text></View>;
  }
  const DAY_ABBR = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  // Daily for up to 31 days (week/month/last_month), weekly aggregation beyond that (year/all)
  const items = data.length > 31
    ? (() => {
        const chunks = [];
        for (let i = 0; i < data.length; i += 7) {
          const slice = data.slice(i, i + 7);
          chunks.push({ label: slice[0].date.slice(5), revenue: slice.reduce((s, d) => s + d.revenue, 0) });
        }
        return chunks;
      })()
    : data.map(d => {
        const dt = new Date(d.date + "T12:00:00");
        const lbl = data.length <= 7
          ? DAY_ABBR[dt.getDay()]
          : `${dt.getDate()}`;
        return { label: lbl, revenue: d.revenue };
      });
  const maxVal = Math.max(...items.map(i => i.revenue), 1);
  const BAR_H = 110;
  const barW = Math.max(32, Math.min(48, 320 / items.length));

  return (
    <View style={styles.chartWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4, paddingBottom: 22, paddingTop: 18, paddingHorizontal: 4 }}>
          {items.map((item, i) => {
            const barH = Math.max(4, (item.revenue / maxVal) * BAR_H);
            return (
              <View key={i} style={{ alignItems: "center", width: barW }}>
                <Text style={[styles.barValue, { width: barW + 12, marginBottom: 3 }]}>{item.revenue > 0 ? shortMoney(item.revenue) : ""}</Text>
                <View style={[styles.bar, { width: barW - 8, height: barH, backgroundColor: C.blue }]} />
                <Text style={[styles.barLabel, { width: barW, marginTop: 4 }]}>{item.label}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}


// ── Main Screen ───────────────────────────────────────────────────────────────
export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const { role } = useRole();
  const [period, setPeriod] = useState("month");
  const [data, setData] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [periodClients, setPeriodClients] = useState([]);
  const [trends, setTrends] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    const { from, to } = getDateRange(period);
    const prior = getPriorDateRange(period);
    try {
      const promises = [
        api.adminInsights(from, to),
        api.adminRevenueChart(from || "2020-01-01", to || isoToday()),
        api.adminClients(),
      ];
      if (prior.from) promises.push(api.adminInsights(prior.from, prior.to));
      const results = await Promise.all(promises);
      const [kpis, chart, allClients] = results;
      setData(kpis);
      setChartData(Array.isArray(chart) ? chart : []);
      // Filter clients to period using their booking history from kpis
      // The client list from adminClients has last_visit — filter by date range
      const clients = Array.isArray(allClients) ? allClients : (allClients?.clients || []);
      if (from) {
        const filtered = clients.filter(c => {
          const lv = c.last_visit || c.last_booking;
          if (!lv) return false;
          return lv >= from && lv <= (to || isoToday());
        });
        setPeriodClients(filtered);
      } else {
        setPeriodClients(clients);
      }
      // Compute trends
      if (results[3]) {
        const prev = results[3];
        // No earlier data means nothing to compare against, so show no trend rather than a fake +100%
        const pct = (cur, old) => old > 0 ? Math.round(((cur - old) / old) * 100) : null;
        setTrends({
          revenue: pct(kpis.total_revenue ?? 0, prev.total_revenue ?? 0),
          bookings: pct(kpis.total_bookings ?? 0, prev.total_bookings ?? 0),
          avg: pct(kpis.avg_booking_value ?? 0, prev.avg_booking_value ?? 0),
          cancel: pct(kpis.cancellation_rate ?? 0, prev.cancellation_rate ?? 0),
        });
      } else {
        setTrends({});
      }
      setError(null);
      setCache(`insights_${period}`, { kpis, chart: Array.isArray(chart) ? chart : [], clients });
    } catch (err) {
      if (!data) setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [period]);

  const upcoming = data?.upcoming_bookings || [];

  if (error && !data) {
    return <View style={[styles.container, { paddingTop: insets.top }]}><ErrorState message={error} onRetry={() => load()} /></View>;
  }
  if (loading) {
    return <View style={[styles.container, { paddingTop: insets.top, padding: 16 }]}><SkeletonKPI /><View style={{ height: 16 }} /><SkeletonCard lines={5} /><View style={{ height: 12 }} /><SkeletonCard lines={3} /></View>;
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.ink} />}
    >
      <ScreenTitle title="Insights" />
      {/* Period selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodScroll}>
        <View style={styles.periodRow}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[styles.periodBtn, period === p.key && styles.periodBtnActive]}
              onPress={() => setPeriod(p.key)}
            >
              <Text style={[styles.periodBtnText, period === p.key && styles.periodBtnTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={async () => {
              const { from, to } = getDateRange(period);
              const fromDate = from || "2020-01-01";
              const toDate = to || isoToday();
              try {
                const csv = await api.adminExportCsv(fromDate, toDate);
                await Share.share({ message: csv, title: `zelko-export-${fromDate}-${toDate}.csv` });
              } catch (err) { Alert.alert("Error", err.message); }
            }}
          >
            <Ionicons name="download-outline" size={14} color={C.blue} />
            <Text style={styles.exportBtnText}>Export CSV</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {loading ? (
        <View style={{ padding: 16 }}><SkeletonKPI /><View style={{ height: 16 }} /><SkeletonCard lines={4} /></View>
      ) : !data ? null : (
        <>
          {/* KPI grid */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Overview</Text>
            <View style={styles.kpiGrid}>
              <KPICard night value={fmtMoney(data.total_revenue)} label="Revenue" trend={trends.revenue} />
              <KPICard value={data.total_bookings ?? 0} label="Bookings" trend={trends.bookings} />
              <KPICard value={fmtMoney(data.avg_booking_value)} label="Average ticket" trend={trends.avg} />
              <KPICard value={`${data.cancellation_rate ?? 0}%`} label="Cancel rate" trend={trends.cancel} lowerIsBetter />
            </View>
          </View>

          {/* Revenue chart */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Revenue over time</Text>
            <RevenueChart data={chartData} />
          </View>

          {/* Barber performance */}
          {role !== "staff" && data.top_barbers?.length > 0 && (() => {
            const maxRev = Math.max(...data.top_barbers.map(b => b.revenue || 0), 1);
            const maxBks = Math.max(...data.top_barbers.map(b => b.count || 0), 1);
            return (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Barber performance</Text>
                {data.top_barbers.map((b, i) => {
                  const avgVal = b.count > 0 ? Math.round(b.revenue / b.count) : 0;
                  const revPct = (b.revenue || 0) / maxRev;
                  return (
                    <View key={b.name} style={styles.perfCard}>
                      <View style={styles.perfHeader}>
                        <View style={[styles.perfAvatar, { backgroundColor: DCAL_COLORS[i % DCAL_COLORS.length].bg, borderColor: DCAL_COLORS[i % DCAL_COLORS.length].bd }]}>
                          <Text style={[styles.perfInitials, { color: DCAL_COLORS[i % DCAL_COLORS.length].tx }]}>
                            {(b.name || "?").trim().split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?"}
                          </Text>
                        </View>
                        <Text style={styles.perfName}>{b.name}</Text>
                        <Text style={styles.perfRevenue}>{fmtMoney(b.revenue)}</Text>
                      </View>
                      <View style={styles.perfBar}>
                        <View style={[styles.perfBarFill, { width: `${Math.max(revPct * 100, 4)}%` }]} />
                      </View>
                      <View style={styles.perfStats}>
                        <Text style={styles.perfStat}>{b.count} bookings</Text>
                        <Text style={styles.perfStat}>Avg {fmtMoney(avgVal)}</Text>
                        <Text style={styles.perfStat}>{Math.round((b.count / maxBks) * 100)}% of top</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })()}

          {/* Service breakdown */}
          {data.service_breakdown?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>By service</Text>
              {data.service_breakdown.map((s) => (
                <View key={s.service_name} style={styles.breakdownRow}>
                  <View style={styles.breakdownLeft}>
                    <Text style={styles.breakdownName}>{s.service_name}</Text>
                    <Text style={styles.breakdownSub}>{s.booking_count} bookings</Text>
                  </View>
                  <Text style={styles.breakdownVal}>{fmtMoney(s.revenue)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Upcoming 7 days */}
          {upcoming.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Upcoming 7 Days</Text>
              {upcoming.map((day) => (
                <View key={day.date} style={styles.upcomingRow}>
                  <Text style={styles.upcomingDate}>{day.date}</Text>
                  <Text style={styles.upcomingCount}>{day.count} booking{day.count !== 1 ? "s" : ""}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Period clients */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Clients{periodClients.length > 0 ? ` (${periodClients.length})` : ""}
            </Text>
            {periodClients.length === 0 ? (
              <View style={styles.chartEmpty}>
                <Text style={styles.chartEmptyText}>No clients for this period.</Text>
              </View>
            ) : (
              periodClients.slice(0, 50).map((c, i) => {
                const initials = c.name
                  ? c.name.split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase()
                  : "?";
                return (
                  <View key={c.email || i} style={styles.clientRow}>
                    <View style={styles.clientAvatar}>
                      <Text style={styles.clientInitials}>{initials}</Text>
                    </View>
                    <View style={styles.clientInfo}>
                      <Text style={styles.clientName}>{c.name}</Text>
                      <Text style={styles.clientSub}>
                        {c.visit_count ?? c.booking_count ?? 0} visit{(c.visit_count ?? c.booking_count ?? 0) !== 1 ? "s" : ""}
                        {c.total_spent ? ` · ${fmtMoney(c.total_spent)}` : ""}
                      </Text>
                    </View>
                    {c.last_visit && (
                      <Text style={styles.clientDate}>{c.last_visit.slice(5)}</Text>
                    )}
                  </View>
                );
              })
            )}
            {periodClients.length > 50 && (
              <Text style={styles.moreClients}>+{periodClients.length - 50} more</Text>
            )}
          </View>
        </>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.paper },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingInline: { padding: 40, alignItems: "center" },

  // Period selector
  periodScroll: { backgroundColor: C.paper, flexGrow: 0 },
  periodRow: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  periodBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface },
  periodBtnActive: { backgroundColor: C.blueSoft, borderColor: C.blueSoft },
  periodBtnText: { fontSize: 13, fontFamily: F.regular, color: C.muted },
  periodBtnTextActive: { color: C.blue, fontFamily: F.medium },
  exportBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.surface },
  exportBtnText: { fontSize: 13, fontFamily: F.medium, color: C.ink },

  section: { margin: 16, marginBottom: 0 },
  sectionTitle: { fontSize: 20, fontFamily: F.regular, color: C.ink, letterSpacing: -0.4, marginBottom: 12 },

  // KPIs
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kpi: { width: "48.6%", backgroundColor: C.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  kpiNight: { backgroundColor: C.night, borderColor: C.night },
  kpiAccent: { display: "none" },
  kpiIcon: { marginBottom: 8 },
  kpiValue: { fontSize: 28, fontFamily: F.regular, color: C.ink, letterSpacing: -0.7, marginTop: 8, marginBottom: 4, fontVariant: ["tabular-nums"] },
  kpiTrendRow: { flexDirection: "row", alignItems: "center", gap: 2, marginBottom: 2 },
  kpiTrend: { fontSize: 12, fontFamily: F.medium },
  kpiTrendUp: { color: C.success },
  kpiTrendDown: { color: C.danger },
  kpiLabel: { fontSize: 11, fontFamily: F.monoMedium, color: C.muted, textTransform: "uppercase", letterSpacing: 1 },

  // Revenue chart
  chartWrap: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 12 },
  chartEmpty: { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 32, alignItems: "center" },
  chartEmptyText: { color: C.muted, fontFamily: F.regular, fontSize: 13 },
  bar: { borderRadius: 4, minHeight: 4 },
  barValue: { fontSize: 11, fontFamily: F.medium, color: C.ink, textAlign: "center", fontVariant: ["tabular-nums"] },
  barLabel: { fontFamily: F.mono, fontSize: 11, color: C.muted, textAlign: "center" },

  // Clients
  clientRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.surface, borderRadius: 14, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: C.line },
  clientAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.blueSoft, alignItems: "center", justifyContent: "center" },
  clientInitials: { fontSize: 13, fontFamily: F.medium, color: C.blue },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 15, fontFamily: F.medium, color: C.ink },
  clientSub: { fontFamily: F.regular, fontSize: 13, color: C.muted, marginTop: 1 },
  clientDate: { fontSize: 12, color: C.muted, fontFamily: F.mono },
  moreClients: { fontSize: 12, color: C.muted, textAlign: "center", paddingVertical: 8, fontFamily: F.semibold },

  // Barber performance
  perfCard: { backgroundColor: C.surface, borderRadius: 16, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.line },
  perfHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  perfAvatar: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  perfInitials: { fontSize: 12, fontFamily: F.semibold },
  perfName: { flex: 1, fontSize: 16, fontFamily: F.medium, color: C.ink },
  perfRevenue: { fontSize: 18, fontFamily: F.regular, color: C.ink, fontVariant: ["tabular-nums"] },
  perfBar: { height: 6, backgroundColor: C.sunk, borderRadius: 3, overflow: "hidden", marginBottom: 8 },
  perfBarFill: { height: 6, backgroundColor: C.blue, borderRadius: 3 },
  perfStats: { flexDirection: "row", justifyContent: "space-between" },
  perfStat: { fontSize: 13, color: C.muted, fontFamily: F.regular },

  // Breakdowns
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.line },
  breakdownLeft: {},
  breakdownName: { fontSize: 15, fontFamily: F.medium, color: C.ink },
  breakdownSub: { fontFamily: F.regular, fontSize: 13, color: C.muted, marginTop: 1 },
  breakdownVal: { fontSize: 17, fontFamily: F.regular, color: C.ink, fontVariant: ["tabular-nums"] },

  // Upcoming
  upcomingRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  upcomingDate: { fontSize: 15, fontFamily: F.medium, color: C.ink },
  upcomingCount: { fontFamily: F.regular, fontSize: 13, color: C.muted },
});
