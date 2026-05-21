import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, Alert, ActivityIndicator, TouchableOpacity, Share } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../lib/api";
import { C, serif, fmtMoney } from "../../lib/theme";
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
  { key: "week",       label: "This Week" },
  { key: "month",      label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "year",       label: "This Year" },
  { key: "all",        label: "All Time" },
];


// ── KPI Card ──────────────────────────────────────────────────────────────────
function KPICard({ icon, value, label, accent, trend }) {
  return (
    <View style={styles.kpi}>
      <View style={[styles.kpiAccent, { backgroundColor: accent || C.terra }]} />
      <Ionicons name={icon} size={20} color={accent || C.terra} style={styles.kpiIcon} />
      <Text style={styles.kpiValue}>{value}</Text>
      {trend !== null && trend !== undefined && (
        <View style={styles.kpiTrendRow}>
          <Ionicons name={trend >= 0 ? "caret-up" : "caret-down"} size={11} color={trend >= 0 ? "#059669" : "#DC2626"} />
          <Text style={[styles.kpiTrend, trend >= 0 ? styles.kpiTrendUp : styles.kpiTrendDown]}>
            {Math.abs(trend)}%
          </Text>
        </View>
      )}
      <Text style={styles.kpiLabel}>{label}</Text>
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
                <View style={[styles.bar, { width: barW - 8, height: barH, backgroundColor: C.terra }]} />
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
        const pct = (cur, old) => old > 0 ? Math.round(((cur - old) / old) * 100) : (cur > 0 ? 100 : null);
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.espresso} />}
    >
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
                await Share.share({ message: csv, title: `clipd-export-${fromDate}-${toDate}.csv` });
              } catch (err) { Alert.alert("Error", err.message); }
            }}
          >
            <Ionicons name="download-outline" size={14} color={C.terra} />
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
              <KPICard icon="cash-outline" value={fmtMoney(data.total_revenue)} label="Total Revenue" accent={C.terra} trend={trends.revenue} />
              <KPICard icon="calendar-outline" value={data.total_bookings ?? 0} label="Bookings" accent="#555555" trend={trends.bookings} />
              <KPICard icon="star-outline" value={fmtMoney(data.avg_booking_value)} label="Avg Value" accent="#C4683E" trend={trends.avg} />
              <KPICard icon="close-circle-outline" value={`${data.cancellation_rate ?? 0}%`} label="Cancel Rate" accent="#888888" trend={trends.cancel} />
            </View>
          </View>

          {/* Revenue chart */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Revenue Over Time</Text>
            <RevenueChart data={chartData} />
          </View>

          {/* Barber performance */}
          {role !== "staff" && data.top_barbers?.length > 0 && (() => {
            const maxRev = Math.max(...data.top_barbers.map(b => b.revenue || 0), 1);
            const maxBks = Math.max(...data.top_barbers.map(b => b.count || 0), 1);
            return (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Barber Performance</Text>
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
              <Text style={styles.sectionTitle}>By Service</Text>
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
  container: { flex: 1, backgroundColor: C.cream },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingInline: { padding: 40, alignItems: "center" },

  // Period selector
  periodScroll: { backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  periodRow: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  periodBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1.5, borderColor: C.border },
  periodBtnActive: { backgroundColor: C.espresso, borderColor: C.espresso },
  periodBtnText: { fontSize: 12, fontWeight: "700", color: C.muted },
  periodBtnTextActive: { color: C.cream },
  exportBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1.5, borderColor: C.terra },
  exportBtnText: { fontSize: 12, fontWeight: "700", color: C.terra },

  section: { margin: 16, marginBottom: 0 },
  sectionTitle: { fontFamily: serif, fontSize: 18, fontWeight: "700", color: C.espresso, marginBottom: 12 },

  // KPIs
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpi: { width: "47%", backgroundColor: C.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  kpiAccent: { position: "absolute", top: 0, left: 0, right: 0, height: 3 },
  kpiIcon: { marginBottom: 8 },
  kpiValue: { fontFamily: serif, fontSize: 26, fontWeight: "900", color: C.espresso, marginBottom: 2 },
  kpiTrendRow: { flexDirection: "row", alignItems: "center", gap: 2, marginBottom: 2 },
  kpiTrend: { fontSize: 11, fontWeight: "800" },
  kpiTrendUp: { color: "#059669" },
  kpiTrendDown: { color: "#DC2626" },
  kpiLabel: { fontSize: 10, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 1.5 },

  // Revenue chart
  chartWrap: { backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 12 },
  chartEmpty: { backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 32, alignItems: "center" },
  chartEmptyText: { color: C.muted, fontSize: 13 },
  bar: { borderRadius: 4, minHeight: 4 },
  barValue: { fontSize: 9, fontWeight: "700", color: C.espresso, textAlign: "center" },
  barLabel: { fontSize: 8, color: C.muted, textAlign: "center" },

  // Clients
  clientRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.white, borderRadius: 10, padding: 12, marginBottom: 6,
    borderWidth: 1, borderColor: C.border,
  },
  clientAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.surface, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: C.border,
  },
  clientInitials: { fontSize: 13, fontWeight: "800", color: C.espresso },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 13, fontWeight: "700", color: C.espresso },
  clientSub: { fontSize: 11, color: C.muted, marginTop: 1 },
  clientDate: { fontSize: 10, color: C.muted, fontWeight: "600" },
  moreClients: { fontSize: 12, color: C.muted, textAlign: "center", paddingVertical: 8, fontWeight: "600" },

  // Barber performance
  perfCard: {
    backgroundColor: C.white, borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: C.border,
  },
  perfHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  perfAvatar: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  perfInitials: { fontSize: 12, fontWeight: "800" },
  perfName: { flex: 1, fontSize: 14, fontWeight: "700", color: C.espresso },
  perfRevenue: { fontFamily: serif, fontSize: 16, fontWeight: "700", color: C.espresso },
  perfBar: { height: 5, backgroundColor: C.border, borderRadius: 3, overflow: "hidden", marginBottom: 8 },
  perfBarFill: { height: 5, backgroundColor: C.terra, borderRadius: 3 },
  perfStats: { flexDirection: "row", justifyContent: "space-between" },
  perfStat: { fontSize: 11, color: C.muted, fontWeight: "600" },

  // Breakdowns
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: C.white, borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  breakdownLeft: {},
  breakdownName: { fontSize: 14, fontWeight: "700", color: C.espresso },
  breakdownSub: { fontSize: 12, color: C.muted, marginTop: 1 },
  breakdownVal: { fontFamily: serif, fontSize: 16, fontWeight: "700", color: C.espresso },

  // Upcoming
  upcomingRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  upcomingDate: { fontSize: 14, fontWeight: "600", color: C.espresso },
  upcomingCount: { fontSize: 13, color: C.muted },
});
