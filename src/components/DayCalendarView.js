import React, { useRef, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";
import { F, C, DCAL_COLORS } from "../lib/theme";

export const PX_PER_HOUR = 80;
export const OPEN_HOUR   = 9;
export const CLOSE_HOUR  = 21;
export const TOTAL_H     = CLOSE_HOUR - OPEN_HOUR;
const TIME_COL_W = 56;

// Service accents: brand colours only, told apart by strength; the service name is always on the block.
export const SERVICE_COLORS = [C.blue, C.ink, C.muted, "rgba(26,36,201,0.55)", C.lineStrong];

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

export { DCAL_COLORS };

export function tMin(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
// Overlapping bookings sit side by side. Returns {code: {lane, of}}.
export function layoutLanes(bks) {
  const out = {};
  const items = bks.map(b => ({ code: b.confirmation_code, s: tMin(b.start_time), e: tMin(b.start_time) + (b.duration_min || 30) }))
    .sort((a, b) => a.s - b.s || b.e - a.e);
  let cluster = [], clusterEnd = -1, laneEnds = [];
  const flush = () => { cluster.forEach(it => { out[it.code] = { lane: it.lane, of: laneEnds.length || 1 }; }); cluster = []; laneEnds = []; };
  items.forEach(it => {
    if (it.s >= clusterEnd) flush();
    let lane = laneEnds.findIndex(e => e <= it.s);
    if (lane < 0) { lane = laneEnds.length; laneEnds.push(it.e); } else laneEnds[lane] = it.e;
    it.lane = lane; cluster.push(it); clusterEnd = Math.max(clusterEnd, it.e);
  });
  flush();
  return out;
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
  onSwipeLeft,
  onSwipeRight,
  barberAvailability = {},
  onBufferPress,
  onBlockPress,
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ink} />}
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
          <Text style={styles.closedTitle}>Closed today.</Text>
          <Text style={styles.closedSub}>The shop is closed on {dayOfWeek}s.</Text>
          <Text style={styles.closedHint}>Change your hours in More, then Settings.</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      scrollEnabled={!dragging}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ink} />}
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
            const lanes = layoutLanes(bks);

            // Check barber availability for this day
            // JS getDay(): Sun=0..Sat=6. DB stores Python weekday(): Mon=0..Sun=6. Convert.
            const jsDow = date ? new Date(date + "T12:00:00").getDay() : new Date().getDay();
            const dayNum = (jsDow + 6) % 7;
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

                {/* Blocked time slots — uniform style regardless of reason */}
                {blockedSlots
                  .filter(bl => bl.barber_id === barber.id)
                  .map((bl, bi) => {
                    const onPress = (e) => {
                      if (touchStart.current.swiped || dragging) return;
                      bookingTapped.current = true;
                      onBlockPress?.(bl);
                    };
                    if (bl.all_day) {
                      return (
                        <TouchableOpacity key={`bl${bi}`} style={styles.blockedAll} activeOpacity={0.7} onPress={onPress}>
                          <Ionicons name="lock-closed-outline" size={16} color={C.muted} />
                          <Text style={styles.blockedText}>{bl.reason || "Blocked"} · all day</Text>
                        </TouchableOpacity>
                      );
                    }
                    if (!bl.start_time || !bl.end_time) return null;
                    const blStart = tMin(bl.start_time);
                    const blEnd = tMin(bl.end_time);
                    if (blStart < OPEN_HOUR * 60 || blStart >= CLOSE_HOUR * 60) return null;
                    const blTop = tPx(blStart);
                    const blH = Math.max((blEnd - blStart) / 60 * PX_PER_HOUR, 16);
                    return (
                      <TouchableOpacity
                        key={`bl${bi}`}
                        style={[styles.blockedSlot, { top: blTop, height: blH }]}
                        activeOpacity={0.7}
                        onPress={onPress}
                      >
                        <Ionicons name="lock-closed-outline" size={11} color={C.muted} />
                        <Text style={styles.blockedText} numberOfLines={1}>{bl.reason || "Blocked"} · {fmtTime(bl.start_time)} – {fmtTime(bl.end_time)}</Text>
                      </TouchableOpacity>
                    );
                  })
                }

                {bks.map(bk => {
                  const startMin = tMin(bk.start_time);
                  if (startMin < OPEN_HOUR * 60 || startMin >= CLOSE_HOUR * 60) return null;
                  const top  = tPx(startMin);
                  const dur  = bk.duration_min || 30;
                  // True length, so a 20-minute booking never spills into the next one
                  const bkH  = Math.max(dur / 60 * PX_PER_HOUR - 2, 18);
                  const compact = bkH < 34;
                  const L = lanes[bk.confirmation_code] || { lane: 0, of: 1 };
                  const laneStyle = L.of > 1 ? { left: `${(L.lane / L.of) * 100}%`, width: `${100 / L.of - 1.5}%`, right: undefined } : null;
                  const cancelled = bk.status === "cancelled" || bk.status === "no_show";
                  const statusWord = bk.status === "no_show" ? "No-show · " : bk.status === "cancelled" ? "Cancelled · " : "";
                  const endMin = bk.end_time ? tMin(bk.end_time) : startMin + dur;
                  const isPast = showNow && endMin < nowMin;

                  // Color = barber (consistent per column). Use the barber's palette entry.
                  const barberColor = DCAL_COLORS[bIdx % DCAL_COLORS.length];
                  const blockBg = barberColor.bg;
                  const blockBorder = barberColor.bd;

                  // Buffer starts at the booking's real end and sits underneath it
                  const bufferMin = bk.buffer_minutes || 0;
                  const bufferTop = tPx(startMin + dur);
                  let bufferH = (bufferMin / 60) * PX_PER_HOUR;

                  // Clip buffer if it would overlap the next booking or blocked time on this barber
                  if (bufferMin > 0) {
                    let earliestNextPx = Infinity;
                    bks.forEach(other => {
                      if (other === bk || other.status === "cancelled" || other.status === "no_show") return;
                      const oStart = tMin(other.start_time);
                      if (oStart > startMin) {
                        const oPx = tPx(oStart);
                        if (oPx < earliestNextPx) earliestNextPx = oPx;
                      }
                    });
                    blockedSlots
                      .filter(bl => bl.barber_id === barber.id && bl.start_time)
                      .forEach(bl => {
                        const bs = tMin(bl.start_time);
                        if (bs > startMin) {
                          const bp = tPx(bs);
                          if (bp < earliestNextPx) earliestNextPx = bp;
                        }
                      });
                    // Also clip at shop close
                    if (shopCloseMin !== null) {
                      const closePx = tPx(shopCloseMin);
                      if (closePx < earliestNextPx) earliestNextPx = closePx;
                    }
                    if (isFinite(earliestNextPx)) {
                      bufferH = Math.max(0, Math.min(bufferH, earliestNextPx - bufferTop));
                    }
                  }

                  return (
                    <React.Fragment key={bk.confirmation_code}>
                    <TouchableOpacity
                      style={[
                        styles.appt,
                        compact && styles.apptCompact,
                        { top: dragging?.code === bk.confirmation_code ? dragY : top,
                          height: bkH, backgroundColor: blockBg, borderLeftColor: blockBorder },
                        laneStyle,
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
                        <Text style={[styles.apptTime, cancelled && styles.apptStruck]} numberOfLines={1}>
                          {statusWord}{fmtTime(bk.start_time)} · {bk.customer_name}
                          {compact && bk.service_name ? <Text style={styles.apptSvcInline}>  {bk.service_name}</Text> : null}
                        </Text>
                      </View>
                      {!compact ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          {bk.service_name ? <Text style={[styles.apptSvc, { flexShrink: 1 }]} numberOfLines={1}>{bk.service_name}</Text> : null}
                          {(bk.payment_status === "paid" || bk.payment_status === "cash_paid" || bk.payment_status === "card_paid") && (
                            <Text style={styles.paidIcon} numberOfLines={1}>Paid ✓</Text>
                          )}
                          {bk.payment_status === "deposit_paid" && (
                            <Text style={styles.depositIcon} numberOfLines={1}>Deposit</Text>
                          )}
                        </View>
                      ) : null}
                      {bkH > 56 && clientNotes[bk.customer_email] ? (
                        <Text style={styles.apptNote} numberOfLines={1}>{clientNotes[bk.customer_email]}</Text>
                      ) : null}
                    </TouchableOpacity>
                    {bufferMin > 0 && bufferH >= 4 && !cancelled && (() => {
                      const showLabel = bufferH >= 12;
                      return (
                        <TouchableOpacity
                          accessibilityLabel={`${bufferMin} minute buffer after ${bk.customer_name}`}
                          style={[
                            styles.bufferBlock,
                            { top: bufferTop, height: bufferH },
                            laneStyle,
                          ]}
                          activeOpacity={0.7}
                          onPress={(e) => {
                            if (touchStart.current.swiped || dragging) return;
                            bookingTapped.current = true;
                            onBufferPress?.(bk);
                          }}
                        >
                          {showLabel && <Text style={styles.bufferText}>{bufferMin} min</Text>}
                        </TouchableOpacity>
                      );
                    })()}
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
  head: { flexDirection: "row", backgroundColor: C.paper, borderBottomWidth: 1, borderBottomColor: C.line },
  timeColHead: { width: TIME_COL_W, borderRightWidth: 1, borderRightColor: C.line },
  th: {
    flex: 1, paddingVertical: 10, paddingHorizontal: 10,
    borderLeftWidth: 1, borderLeftColor: C.line,
    justifyContent: "center",
  },
  thEmpty: { flex: 1 },
  thText: { fontSize: 13, fontFamily: F.medium, color: C.ink },

  // Body
  body: { flexDirection: "row" },

  // Time labels column — overflow hidden prevents ±bleed into header/footer
  timeCol: { width: TIME_COL_W, position: "relative", backgroundColor: C.paper, borderRightWidth: 1, borderRightColor: C.line, overflow: "hidden" },
  timeLabel: { position: "absolute", right: 6, fontSize: 11, fontFamily: F.mono, color: C.muted, width: 48, textAlign: "right" },

  // Grid area
  cols: {
    flex: 1,
    position: "relative",
    flexDirection: "row",
    overflow: "hidden",
  },

  // ── Google Calendar alternating hour bands ──
  hourBand: { position: "absolute", left: 0, right: 0, height: PX_PER_HOUR, backgroundColor: C.surface, zIndex: 0 },
  hourBandAlt: { backgroundColor: C.surface },

  // Grid lines (above bands)
  hLine: {
    position: "absolute", left: 0, right: 0,
    height: 1, backgroundColor: C.line, zIndex: 2,
  },
  hLineDash: { position: "absolute", left: 0, right: 0, height: 1, borderTopWidth: 1, borderTopColor: C.sunk, borderStyle: "dashed", zIndex: 2 },

  // Now line
  nowLine: {
    position: "absolute", left: 0, right: 0,
    height: 2, backgroundColor: C.blue, zIndex: 8,
  },
  nowDot: {
    position: "absolute", left: -1, top: -4,
    width: 10, height: 10, borderRadius: 5, backgroundColor: C.blue,
  },

  // Barber columns
  col: {
    flex: 1,
    position: "relative",
    borderLeftWidth: 1,
    borderLeftColor: C.line,
    zIndex: 3,
  },
  colEmpty: {
    backgroundColor: "transparent",
  },

  // Blocked time — uniform "off limits" look regardless of reason
  blockedAll: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(14,14,12,0.06)", alignItems: "center", justifyContent: "center", gap: 6, zIndex: 4 },
  blockedSlot: { position: "absolute", left: 3, right: 3, backgroundColor: C.paper, borderWidth: 1, borderStyle: "dashed", borderColor: C.lineStrong, borderRadius: 6, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 7, overflow: "hidden", zIndex: 4 },
  blockedText: { flexShrink: 1, fontFamily: F.medium, fontSize: 11, color: C.muted },

  // Closed day
  closedContainer: {
    flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80,
  },
  closedCard: {
    alignItems: "center", padding: 32, backgroundColor: C.surface,
    borderRadius: 16, borderWidth: 1, borderColor: C.line,
    marginHorizontal: 32, width: 280,
  },
  closedIcon: { marginBottom: 12 },
  closedTitle: { fontSize: 24, fontFamily: F.regular, color: C.ink, letterSpacing: -0.5, marginBottom: 6 },
  closedSub: { fontSize: 15, color: C.muted, fontFamily: F.regular, textAlign: "center", marginBottom: 12 },
  closedHint: { fontFamily: F.regular, fontSize: 13, color: C.muted, textAlign: "center" },
  // Barber off day
  barberOffOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(14,14,12,0.04)", alignItems: "center", paddingTop: 40, zIndex: 6 },
  barberOffText: {
    fontSize: 11, fontFamily: F.monoMedium, color: C.muted,
    textTransform: "uppercase", letterSpacing: 1,
  },

  // Before/after hours band
  closedBand: { position: "absolute", left: 0, right: 0, backgroundColor: C.sunk, opacity: 0.7, zIndex: 1 },

  // Booking blocks
  appt: { position: "absolute", left: 3, right: 3, borderRadius: 6, borderLeftWidth: 3, paddingHorizontal: 7, paddingVertical: 3, overflow: "hidden", zIndex: 5 },
  apptCompact: { paddingVertical: 1, justifyContent: "center" },
  apptStruck: { textDecorationLine: "line-through" },
  apptSvcInline: { fontFamily: F.regular, color: C.muted },
  apptDragging: { opacity: 0.85, zIndex: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 8 },
  apptCancelled: { opacity: 0.45, backgroundColor: "transparent", borderStyle: "dashed", borderWidth: 1, borderColor: C.line },
  apptPast:      { opacity: 0.45 },
  apptTime: { flex: 1, fontSize: 11, fontFamily: F.medium, color: C.ink, lineHeight: 14 },
  apptName: { fontSize: 12, fontFamily: F.medium, color: C.ink, lineHeight: 15 },
  apptBarber: { fontSize: 11, fontFamily: F.regular, color: C.muted, lineHeight: 12 },
  apptNameMuted: { color: C.muted },
  apptSvc: { fontFamily: F.regular, fontSize: 11, color: C.muted, lineHeight: 13, marginTop: 1 },
  apptNote: { fontFamily: F.regular, fontSize: 11, color: C.muted, marginTop: 1 },
  paidIcon: { flexShrink: 0, fontSize: 10, fontFamily: F.medium, color: C.success, backgroundColor: C.surface, borderRadius: 999, paddingHorizontal: 5, paddingVertical: 1, overflow: "hidden" },
  depositIcon: { flexShrink: 0, fontSize: 10, fontFamily: F.medium, color: C.blue, backgroundColor: C.surface, borderRadius: 999, paddingHorizontal: 5, paddingVertical: 1, overflow: "hidden" },

  // Buffer blocks — uniform "cushion" look (icon-only, no text)
  bufferBlock: { position: "absolute", left: 3, right: 3, backgroundColor: C.sunk, opacity: 0.7, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, alignItems: "flex-end", justifyContent: "center", paddingHorizontal: 6, zIndex: 3 },
  bufferText: { fontFamily: F.mono, fontSize: 9, color: C.muted },
  bufferIconWrap: {
    alignItems: "center", justifyContent: "center",
  },
});
