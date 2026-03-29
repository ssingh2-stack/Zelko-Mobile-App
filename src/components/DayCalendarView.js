import React from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl,
} from "react-native";
import { C, serif } from "../lib/theme";

export const PX_PER_HOUR = 80;
export const OPEN_HOUR   = 9;
export const CLOSE_HOUR  = 21;
export const TOTAL_H     = CLOSE_HOUR - OPEN_HOUR;
const TIME_COL_W = 56;

export const DCAL_COLORS = [
  { bg: "rgba(59,130,246,0.10)",  bd: "#3B82F6", tx: "#1D4ED8" },
  { bg: "rgba(16,185,129,0.10)",  bd: "#10B981", tx: "#065F46" },
  { bg: "rgba(139,92,246,0.10)",  bd: "#8B5CF6", tx: "#5B21B6" },
  { bg: "rgba(245,158,11,0.10)",  bd: "#F59E0B", tx: "#92400E" },
  { bg: "rgba(196,104,62,0.14)",  bd: "#C4683E", tx: "#5C2A0A" },
  { bg: "rgba(100,80,155,0.12)",  bd: "#64509B", tx: "#2A1E52" },
];

export function tMin(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
export function tPx(min) {
  return (min - OPEN_HOUR * 60) / 60 * PX_PER_HOUR;
}
export function fmtTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const p = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${p}`;
}
export function pxToTimeStr(y) {
  const min = Math.round(y / PX_PER_HOUR * 60 / 30) * 30 + OPEN_HOUR * 60;
  const clamped = Math.max(OPEN_HOUR * 60, Math.min(CLOSE_HOUR * 60 - 30, min));
  const h = Math.floor(clamped / 60), m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function fmtHour(h) {
  if (h === 0) return "12 AM";
  if (h < 12)  return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}
export function getNowTop() {
  const now = new Date();
  return tPx(now.getHours() * 60 + now.getMinutes());
}
export function isNowVisible() {
  const h = new Date().getHours();
  return h >= OPEN_HOUR && h <= CLOSE_HOUR;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function DayCalendarView({
  bookings, barbers, allBarbers, nowTop, scrollRef,
  onBookingPress, onSlotPress, onRefresh, refreshing, date,
  blockedSlots = [],
  shopHours,
  clientNotes = {},
}) {
  const totalPx = TOTAL_H * PX_PER_HOUR;
  const todayStr = new Date().toISOString().split("T")[0];
  const showNow = (date === todayStr || !date) && isNowVisible();
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  // Determine open/close for this day from shopHours
  const dayOfWeek = date ? DAY_NAMES[new Date(date + "T12:00:00").getDay()] : DAY_NAMES[new Date().getDay()];
  const dayHours = shopHours?.[dayOfWeek];
  // Closed when the day exists in config and open is falsy (false, 0, null, etc.)
  const isClosed = !!dayHours && !dayHours.open;
  const shopOpenMin = dayHours?.open && dayHours?.open_time ? tMin(dayHours.open_time) : null;
  const shopCloseMin = dayHours?.open && dayHours?.close_time ? tMin(dayHours.close_time) : null;

  if (isClosed) {
    return (
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.espresso} />}
        contentContainerStyle={styles.closedContainer}
      >
        <View style={styles.closedCard}>
          <Text style={styles.closedIcon}>🔒</Text>
          <Text style={styles.closedTitle}>Shop Closed</Text>
          <Text style={styles.closedSub}>{dayOfWeek}s are not a business day</Text>
          <Text style={styles.closedHint}>Update your hours in Settings → Business Hours</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.espresso} />}
    >
      {/* Column headers */}
      <View style={styles.head}>
        <View style={styles.timeColHead} />
        {barbers.map((b) => {
          const bIdx = allBarbers.findIndex(ab => ab.id === b.id);
          const c = DCAL_COLORS[bIdx % DCAL_COLORS.length];
          return (
            <View key={b.id} style={[styles.th, { borderLeftColor: c.bd }]}>
              <View style={[styles.thDot, { backgroundColor: c.bd }]} />
              <Text style={styles.thText} numberOfLines={1}>{b.name}</Text>
            </View>
          );
        })}
        {barbers.length === 0 && <View style={styles.thEmpty} />}
      </View>

      {/* Body */}
      <View style={styles.body}>
        {/* Time labels column — overflow hidden so top/bottom labels don't bleed */}
        <View style={[styles.timeCol, { height: totalPx }]}>
          {Array.from({ length: TOTAL_H + 1 }, (_, i) => {
            // Clamp first label down, last label up, to avoid bleeding outside bounds
            const rawTop = i * PX_PER_HOUR - 7;
            const top = i === 0 ? 4 : Math.min(totalPx - 14, rawTop);
            return (
              <Text key={i} style={[styles.timeLabel, { top }]}>
                {fmtHour(OPEN_HOUR + i)}
              </Text>
            );
          })}
        </View>

        {/* Grid area + barber columns */}
        <View style={[styles.cols, { height: totalPx }]}>

          {/* ── Google Calendar-style alternating hour bands ── */}
          {Array.from({ length: TOTAL_H }, (_, i) => (
            <View
              key={`band${i}`}
              style={[
                styles.hourBand,
                { top: i * PX_PER_HOUR },
                i % 2 === 1 && styles.hourBandAlt,
              ]}
            />
          ))}

          {/* Hour lines */}
          {Array.from({ length: TOTAL_H + 1 }, (_, i) => (
            <View key={`g${i}`}>
              <View style={[styles.hLine, { top: i * PX_PER_HOUR }]} />
              {i < TOTAL_H && (
                <View style={[styles.hLineDash, { top: i * PX_PER_HOUR + 40 }]} />
              )}
            </View>
          ))}

          {/* Now line */}
          {showNow && (
            <View style={[styles.nowLine, { top: nowTop }]}>
              <View style={styles.nowDot} />
            </View>
          )}

          {/* Before-open / after-close bands */}
          {shopOpenMin !== null && shopOpenMin > OPEN_HOUR * 60 && (
            <View style={[styles.closedBand, { top: 0, height: tPx(shopOpenMin) }]} />
          )}
          {shopCloseMin !== null && shopCloseMin < CLOSE_HOUR * 60 && (
            <View style={[styles.closedBand, { top: tPx(shopCloseMin), height: totalPx - tPx(shopCloseMin) }]} />
          )}

          {/* Barber columns */}
          {barbers.map((barber) => {
            const bIdx = allBarbers.findIndex(ab => ab.id === barber.id);
            const c = DCAL_COLORS[bIdx % DCAL_COLORS.length];
            const bks = bookings.filter(b => b.barber_id === barber.id);

            return (
              <TouchableOpacity
                key={barber.id}
                style={[styles.col, { height: totalPx }]}
                onPress={(e) => {
                  if (!onSlotPress) return;
                  const y = e.nativeEvent.locationY;
                  onSlotPress({ barberId: barber.id, barberName: barber.name, time: pxToTimeStr(y) });
                }}
                activeOpacity={1}
              >
                {/* Blocked time slots */}
                {blockedSlots
                  .filter(bl => bl.barber_id === barber.id)
                  .map((bl, bi) => {
                    if (bl.all_day) {
                      return (
                        <View key={`bl${bi}`} style={styles.blockedAll}>
                          <Text style={styles.blockedText}>Blocked</Text>
                        </View>
                      );
                    }
                    if (!bl.start_time || !bl.end_time) return null;
                    const blStart = tMin(bl.start_time);
                    const blEnd = tMin(bl.end_time);
                    if (blStart < OPEN_HOUR * 60 || blStart >= CLOSE_HOUR * 60) return null;
                    const blTop = tPx(blStart);
                    const blH = Math.max((blEnd - blStart) / 60 * PX_PER_HOUR, 24);
                    return (
                      <View key={`bl${bi}`} style={[styles.blockedSlot, { top: blTop, height: blH }]}>
                        <Text style={styles.blockedText} numberOfLines={1}>{bl.reason || "Blocked"}</Text>
                      </View>
                    );
                  })
                }

                {bks.map(bk => {
                  const startMin = tMin(bk.start_time);
                  if (startMin < OPEN_HOUR * 60 || startMin >= CLOSE_HOUR * 60) return null;
                  const top  = tPx(startMin);
                  const bkH  = Math.max((bk.duration_min || 30) / 60 * PX_PER_HOUR, 36);
                  const cancelled = bk.status === "cancelled" || bk.status === "no_show";
                  const endMin = bk.end_time ? tMin(bk.end_time) : startMin + (bk.duration_min || 30);
                  const isPast = showNow && endMin < nowMin;

                  return (
                    <TouchableOpacity
                      key={bk.confirmation_code}
                      style={[
                        styles.appt,
                        { top, height: bkH, backgroundColor: c.bg, borderLeftColor: c.bd },
                        cancelled && styles.apptCancelled,
                        isPast && !cancelled && styles.apptPast,
                      ]}
                      onPress={(e) => { e.stopPropagation?.(); onBookingPress?.(bk); }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.apptTime, { color: c.tx }]}>{fmtTime(bk.start_time)}</Text>
                      <Text style={[styles.apptName, (cancelled || isPast) && styles.apptNameMuted]} numberOfLines={1}>
                        {bk.customer_name}
                      </Text>
                      {bkH > 52 && (
                        <Text style={styles.apptSvc} numberOfLines={1}>{bk.service_name}</Text>
                      )}
                      {bkH > 68 && clientNotes[bk.customer_email] ? (
                        <Text style={styles.apptNote} numberOfLines={1}>{clientNotes[bk.customer_email]}</Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </TouchableOpacity>
            );
          })}

          {/* Empty state column placeholder when no barbers loaded yet */}
          {barbers.length === 0 && (
            <View style={[styles.col, styles.colEmpty, { height: totalPx }]} />
          )}
        </View>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },

  // Header
  head: {
    flexDirection: "row",
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  timeColHead: { width: TIME_COL_W, borderRightWidth: 1, borderRightColor: C.border },
  th: {
    flex: 1, paddingVertical: 10, paddingHorizontal: 10,
    borderLeftWidth: 3, flexDirection: "row", alignItems: "center", gap: 6,
  },
  thEmpty: { flex: 1 },
  thDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  thText: { fontSize: 12, fontWeight: "800", color: C.espresso, flex: 1 },

  // Body
  body: { flexDirection: "row" },

  // Time labels column — overflow hidden prevents ±bleed into header/footer
  timeCol: {
    width: TIME_COL_W,
    position: "relative",
    backgroundColor: C.surface,
    borderRightWidth: 1,
    borderRightColor: C.border,
    overflow: "hidden",
  },
  timeLabel: {
    position: "absolute",
    right: 6,
    fontSize: 9,
    fontWeight: "700",
    color: C.muted,
    width: 44,
    textAlign: "right",
  },

  // Grid area
  cols: {
    flex: 1,
    position: "relative",
    flexDirection: "row",
    overflow: "hidden",
  },

  // ── Google Calendar alternating hour bands ──
  hourBand: {
    position: "absolute",
    left: 0, right: 0,
    height: PX_PER_HOUR,
    backgroundColor: "#fff",
    zIndex: 0,
  },
  hourBandAlt: {
    backgroundColor: "#F5F1ED",
  },

  // Grid lines (above bands)
  hLine: {
    position: "absolute", left: 0, right: 0,
    height: 1, backgroundColor: C.border, zIndex: 2,
  },
  hLineDash: {
    position: "absolute", left: 0, right: 0,
    height: 1,
    borderTopWidth: 1, borderTopColor: "#E8DFDA",
    borderStyle: "dashed",
    zIndex: 2,
  },

  // Now line
  nowLine: {
    position: "absolute", left: 0, right: 0,
    height: 2, backgroundColor: C.terra, zIndex: 8,
  },
  nowDot: {
    position: "absolute", left: -1, top: -4,
    width: 10, height: 10, borderRadius: 5, backgroundColor: C.terra,
  },

  // Barber columns
  col: {
    flex: 1,
    position: "relative",
    borderLeftWidth: 1,
    borderLeftColor: C.border,
    zIndex: 3,
  },
  colEmpty: {
    backgroundColor: "transparent",
  },

  // Blocked time
  blockedAll: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(155,134,119,0.18)",
    alignItems: "center", justifyContent: "center",
    zIndex: 4,
  },
  blockedSlot: {
    position: "absolute", left: 2, right: 2,
    backgroundColor: "rgba(155,134,119,0.22)",
    borderLeftWidth: 3, borderLeftColor: C.muted,
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4,
    zIndex: 4, justifyContent: "center",
  },
  blockedText: {
    fontSize: 9, fontWeight: "700", color: C.muted,
    textTransform: "uppercase", letterSpacing: 0.5,
  },

  // Closed day
  closedContainer: {
    flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80,
  },
  closedCard: {
    alignItems: "center", padding: 32, backgroundColor: C.white,
    borderRadius: 16, borderWidth: 1, borderColor: C.border,
    marginHorizontal: 32, width: 280,
  },
  closedIcon: { fontSize: 40, marginBottom: 12 },
  closedTitle: {
    fontFamily: serif, fontSize: 22, fontWeight: "800", color: C.espresso, marginBottom: 6,
  },
  closedSub: {
    fontSize: 14, color: C.muted, fontWeight: "600", textAlign: "center", marginBottom: 12,
  },
  closedHint: {
    fontSize: 11, color: C.muted, fontStyle: "italic", textAlign: "center",
  },
  // Before/after hours band
  closedBand: {
    position: "absolute", left: 0, right: 0,
    backgroundColor: "rgba(155,134,119,0.10)",
    zIndex: 1,
  },

  // Booking blocks
  appt: {
    position: "absolute", left: 4, right: 4,
    borderRadius: 7, padding: 5, paddingLeft: 6,
    borderLeftWidth: 3, overflow: "hidden", zIndex: 5,
  },
  apptCancelled: { opacity: 0.25 },
  apptPast:      { opacity: 0.45 },
  apptTime: { fontSize: 9, fontWeight: "700", lineHeight: 13 },
  apptName: { fontSize: 11, fontWeight: "700", color: C.espresso, lineHeight: 14 },
  apptNameMuted: { color: C.muted },
  apptSvc:  { fontSize: 10, color: C.muted, marginTop: 1 },
  apptNote: { fontSize: 9, color: "#92400E", fontStyle: "italic", marginTop: 1 },
});
