import React, { useRef, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";
import { C, serif } from "../lib/theme";

export const PX_PER_HOUR = 80;
export const OPEN_HOUR   = 9;
export const CLOSE_HOUR  = 21;
export const TOTAL_H     = CLOSE_HOUR - OPEN_HOUR;
const TIME_COL_W = 56;

// Distinct but on-brand — each pulls from a different hue family, kept muted/mature
export const SERVICE_COLORS = [
  "#C4683E", // terra (the Clipd accent)
  "#2C6E63", // deep teal
  "#7B4B94", // muted plum
  "#8C6B2C", // burnished gold
  "#3D5A80", // steel blue
  "#994D3A", // burnt brick
  "#4A7C59", // forest sage
  "#6B4C6E", // dusty mauve
];

export function buildServiceColorMap(bookings) {
  const names = [...new Set(bookings.map(b => b.service_name).filter(Boolean))];
  const map = {};
  names.forEach((n) => {
    // Deterministic hash from service name so color never changes
    let hash = 0;
    for (let i = 0; i < n.length; i++) hash = ((hash << 5) - hash + n.charCodeAt(i)) | 0;
    map[n] = SERVICE_COLORS[Math.abs(hash) % SERVICE_COLORS.length];
  });
  return map;
}

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
  serviceColors = {},
  showBarberName = false,
  onSwipeLeft,
  onSwipeRight,
  barberAvailability = {},
}) {
  const touchStart = useRef({ x: 0, y: 0, t: 0 });
  const bookingTapped = useRef(false);
  const [dragging, setDragging] = useState(null); // { code, top, height }
  const [dragY, setDragY] = useState(0);
  const colRef = useRef(null);

  const totalPx = TOTAL_H * PX_PER_HOUR;
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
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
        onTouchStart={(e) => {
          touchStart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, t: Date.now(), swiped: false };
        }}
        onTouchEnd={(e) => {
          const dx = e.nativeEvent.pageX - touchStart.current.x;
          const dy = e.nativeEvent.pageY - touchStart.current.y;
          const dt = Date.now() - touchStart.current.t;
          if (dt < 400 && Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 2) {
            if (dx > 0) onSwipeRight?.();
            else onSwipeLeft?.();
          }
        }}
      >
        <View style={styles.closedCard}>
          <Ionicons name="lock-closed-outline" size={40} color={C.muted} />
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
      scrollEnabled={!dragging}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.espresso} />}
      onTouchStart={(e) => {
        touchStart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, t: Date.now(), swiped: false };
      }}
      onTouchEnd={(e) => {
        const dx = e.nativeEvent.pageX - touchStart.current.x;
        const dy = e.nativeEvent.pageY - touchStart.current.y;
        const dt = Date.now() - touchStart.current.t;
        if (dt < 400 && Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 2) {
          touchStart.current.swiped = true;
          if (dx > 0) onSwipeRight?.();
          else onSwipeLeft?.();
        }
      }}
    >
      {/* Column headers */}
      <View style={styles.head}>
        <View style={styles.timeColHead} />
        {barbers.map((b) => (
          <View key={b.id} style={styles.th}>
            <Text style={styles.thText} numberOfLines={1}>{b.name}</Text>
          </View>
        ))}
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

            // Check barber availability for this day
            const dayNum = date ? new Date(date + "T12:00:00").getDay() : new Date().getDay();
            const avail = barberAvailability[barber.id];
            const todayAvail = avail?.find(a => a.day_of_week === dayNum);
            const barberOff = avail && avail.length > 0 && !todayAvail;

            return (
              <TouchableOpacity
                key={barber.id}
                style={[styles.col, { height: totalPx }]}
                onPress={(e) => {
                  if (dragging) {
                    // Drop the dragged booking
                    const snapMin = Math.round(dragY / PX_PER_HOUR * 60 / 15) * 15 + OPEN_HOUR * 60;
                    const clamped = Math.max(OPEN_HOUR * 60, Math.min(CLOSE_HOUR * 60 - 15, snapMin));
                    const newTime = `${String(Math.floor(clamped/60)).padStart(2,"0")}:${String(clamped%60).padStart(2,"0")}`;
                    const code = dragging.code;
                    setDragging(null);
                    Alert.alert(`Move to ${fmtTime(newTime)}?`, null, [
                      { text: "Cancel", style: "cancel" },
                      { text: "Move", onPress: async () => {
                        try {
                          await api.adminUpdateBooking(code, { start_time: newTime });
                          onRefresh?.();
                        } catch (err) { Alert.alert("Error", err.message); }
                      }},
                    ]);
                    return;
                  }
                  if (bookingTapped.current) { bookingTapped.current = false; return; }
                  if (!onSlotPress || touchStart.current.swiped) return;
                  const y = e.nativeEvent.locationY;
                  onSlotPress({ barberId: barber.id, barberName: barber.name, time: pxToTimeStr(y) });
                }}
                onMoveShouldSetResponder={() => !!dragging}
                onResponderMove={(e) => {
                  if (!dragging) return;
                  const newY = e.nativeEvent.locationY - dragging.height / 2;
                  const snapped = Math.round(newY / (PX_PER_HOUR / 4)) * (PX_PER_HOUR / 4);
                  setDragY(Math.max(0, Math.min(totalPx - dragging.height, snapped)));
                }}
                activeOpacity={1}
              >
                {/* Barber off day */}
                {barberOff && (
                  <View style={styles.barberOffOverlay}>
                    <Text style={styles.barberOffText}>Off</Text>
                  </View>
                )}

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
                  const bkH  = Math.max((bk.duration_min || 30) / 60 * PX_PER_HOUR - 6, 28);
                  const cancelled = bk.status === "cancelled" || bk.status === "no_show";
                  const endMin = bk.end_time ? tMin(bk.end_time) : startMin + (bk.duration_min || 30);
                  const isPast = showNow && endMin < nowMin;

                  const svcColor = serviceColors[bk.service_name];
                  // Service = color, barber = column position
                  const blockBg = svcColor ? svcColor + "1A" : "#E8E0D8";
                  const blockBorder = svcColor || "#9B8677";

                  // Buffer block positioning — starts at the booking's actual time-end
                  const bufferMin = bk.buffer_minutes || 0;
                  const bufferH = (bufferMin / 60) * PX_PER_HOUR;
                  const bookingEndPx = tPx(endMin);
                  const bufferTop = bookingEndPx;

                  return (
                    <React.Fragment key={bk.confirmation_code}>
                    <TouchableOpacity
                      style={[
                        styles.appt,
                        { top: dragging?.code === bk.confirmation_code ? dragY : top,
                          height: bkH, backgroundColor: blockBg, borderLeftColor: blockBorder,
                          justifyContent: bkH > 60 ? "center" : "flex-start" },
                        cancelled && styles.apptCancelled,
                        isPast && !cancelled && styles.apptPast,
                        dragging?.code === bk.confirmation_code && styles.apptDragging,
                      ]}
                      onPress={(e) => { if (touchStart.current.swiped || dragging) return; bookingTapped.current = true; onBookingPress?.(bk); }}
                      onLongPress={() => {
                        if (cancelled) return;
                        setDragging({ code: bk.confirmation_code, origTop: top, height: bkH, barberId: barber.id });
                        setDragY(top);
                      }}
                      delayLongPress={400}
                      activeOpacity={dragging?.code === bk.confirmation_code ? 1 : 0.8}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Text style={[styles.apptTime, { color: blockBorder }]}>{fmtTime(bk.start_time)}</Text>
                        {(bk.payment_status === "paid" || bk.payment_status === "cash_paid" || bk.payment_status === "card_paid") && (
                          <Text style={styles.paidIcon}>$</Text>
                        )}
                        {bk.payment_status === "deposit_paid" && (
                          <Text style={styles.depositIcon}>$</Text>
                        )}
                      </View>
                      <Text style={[styles.apptName, (cancelled || isPast) && styles.apptNameMuted]} numberOfLines={1}>
                        {bk.customer_name}
                      </Text>
                      {bkH > 32 && bk.barber_name && showBarberName && (
                        <Text style={styles.apptBarber} numberOfLines={1}>{bk.barber_name}</Text>
                      )}
                      {bkH > 56 && !svcColor && (
                        <Text style={styles.apptSvc} numberOfLines={1}>{bk.service_name}</Text>
                      )}
                      {bkH > 72 && clientNotes[bk.customer_email] ? (
                        <Text style={styles.apptNote} numberOfLines={1}>{clientNotes[bk.customer_email]}</Text>
                      ) : null}
                    </TouchableOpacity>
                    {bufferMin > 0 && !cancelled && (
                      <View
                        style={[
                          styles.bufferBlock,
                          {
                            top: bufferTop,
                            height: bufferH,
                            borderLeftColor: blockBorder,
                          },
                        ]}
                        pointerEvents="none"
                      >
                        <Text style={styles.bufferText}>Buffer</Text>
                      </View>
                    )}
                    </React.Fragment>
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
    borderLeftWidth: 1, borderLeftColor: C.border,
    justifyContent: "center",
  },
  thEmpty: { flex: 1 },
  thText: { fontSize: 12, fontWeight: "800", color: C.espresso },

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
    backgroundColor: "rgba(44,24,16,0.08)",
    alignItems: "center", justifyContent: "center",
    zIndex: 4,
  },
  blockedSlot: {
    position: "absolute", left: 2, right: 2,
    backgroundColor: "rgba(44,24,16,0.08)",
    borderLeftWidth: 3, borderLeftColor: C.muted,
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4,
    zIndex: 4, justifyContent: "center",
  },
  blockedText: {
    fontSize: 9, fontWeight: "700", color: "#6B5C52",
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
  // Barber off day
  barberOffOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(155,134,119,0.08)",
    alignItems: "center", paddingTop: 40, zIndex: 6,
  },
  barberOffText: {
    fontSize: 11, fontWeight: "700", color: C.muted,
    textTransform: "uppercase", letterSpacing: 1,
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
    borderRadius: 7, padding: 4, paddingLeft: 7,
    borderLeftWidth: 4, overflow: "hidden", zIndex: 5,
  },
  apptDragging: { opacity: 0.85, zIndex: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 8 },
  apptCancelled: { opacity: 0.25 },
  apptPast:      { opacity: 0.45 },
  apptTime: { fontSize: 9, fontWeight: "700", lineHeight: 11 },
  apptName: { fontSize: 11, fontWeight: "700", color: C.espresso, lineHeight: 13 },
  apptBarber: { fontSize: 8, fontWeight: "600", color: C.muted, lineHeight: 10 },
  apptNameMuted: { color: C.muted },
  apptSvcRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 1 },
  svcDot: { width: 6, height: 6, borderRadius: 3 },
  apptSvc:  { fontSize: 10, color: C.muted },
  apptNote: { fontSize: 9, color: "#92400E", fontStyle: "italic", marginTop: 1 },
  paidIcon: { fontSize: 8, fontWeight: "900", color: "#065F46", backgroundColor: "#D1FAE5", borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1, overflow: "hidden" },
  depositIcon: { fontSize: 8, fontWeight: "900", color: "#92400E", backgroundColor: "#FEF3C7", borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1, overflow: "hidden" },

  // Buffer blocks
  bufferBlock: {
    position: "absolute", left: 4, right: 4,
    backgroundColor: "rgba(44,24,16,0.12)",
    borderLeftWidth: 4, borderLeftStyle: "dashed",
    borderRadius: 4, paddingHorizontal: 6,
    justifyContent: "center",
    zIndex: 4,
  },
  bufferText: {
    fontSize: 9, fontWeight: "600", color: "rgba(44,24,16,0.4)",
    textTransform: "uppercase", letterSpacing: 0.5,
  },
});
