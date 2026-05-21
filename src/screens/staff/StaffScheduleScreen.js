import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Alert, ActivityIndicator, Modal, TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { C, serif, fmtMoney } from "../../lib/theme";
import NextUpCard from "../../components/NextUpCard";
import SwipeableCard from "../../components/SwipeableCard";
import DayCalendarView, {
  DCAL_COLORS, tMin, fmtTime, getNowTop, isNowVisible, pxToTimeStr, PX_PER_HOUR,
} from "../../components/DayCalendarView";
import NewBookingModal from "../../components/NewBookingModal";
import { success as hapticSuccess } from "../../lib/haptics";

function localISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
const todayStr = () => localISO(new Date());

function getDayStrip() {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 3 + i);
    return localISO(d);
  });
}

export default function StaffScheduleScreen() {
  const insets = useSafeAreaInsets();
  const [bookings, setBookings] = useState([]);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState("list");
  const [nowTop, setNowTop] = useState(getNowTop);
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [blockModal, setBlockModal] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [blockAllDay, setBlockAllDay] = useState(false);
  const [blockStart, setBlockStart] = useState("09:00");
  const [blockEnd, setBlockEnd] = useState("10:00");
  const [blockSaving, setBlockSaving] = useState(false);
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [newBookingPrefill, setNewBookingPrefill] = useState({});
  const calScrollRef = useRef(null);

  const isViewingToday = selectedDate === todayStr();

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [bData, blocked] = await Promise.all([
        api.staffSchedule(),
        api.staffBlocked(),
      ]);
      // Filter bookings to selected date
      const all = bData.bookings || [];
      setBookings(all.filter(b => b.date === selectedDate));
      const allBlocked = Array.isArray(blocked) ? blocked : (blocked?.blocked || []);
      setBlockedSlots(allBlocked.filter(b => b.date === selectedDate));
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  useEffect(() => { load(); }, [selectedDate]);

  useEffect(() => {
    const timer = setInterval(() => setNowTop(getNowTop()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (view === "cal" && isViewingToday && isNowVisible() && calScrollRef.current) {
      setTimeout(() => {
        calScrollRef.current?.scrollTo({ y: Math.max(0, nowTop - PX_PER_HOUR * 1.5), animated: true });
      }, 300);
    }
  }, [view, selectedDate]);

  async function handleNoShow(code) {
    Alert.alert("Mark No-Show", "Mark this booking as a no-show?", [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", style: "destructive", onPress: async () => {
        try { await api.staffNoShow(code); load(true); }
        catch (err) { Alert.alert("Error", err.message); }
      }},
    ]);
  }

  async function handleCancel(code) {
    Alert.alert("Cancel Booking", "Cancel this booking?", [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", style: "destructive", onPress: async () => {
        try { await api.staffCancelBooking(code); load(true); }
        catch (err) { Alert.alert("Error", err.message); }
      }},
    ]);
  }

  function handleSlotTap({ barberId, barberName, time }) {
    Alert.alert("What would you like to do?", `${time} on ${selectedDate}`, [
      { text: "Cancel", style: "cancel" },
      { text: "Block Time", onPress: () => {
        setBlockStart(time);
        const [h, m] = time.split(":").map(Number);
        const endH = Math.min(h + 1, 21);
        setBlockEnd(`${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
        setBlockAllDay(false);
        setBlockReason("");
        setBlockModal(true);
      }},
      { text: "New Booking", onPress: () => {
        setNewBookingPrefill({ date: selectedDate, time });
        setShowNewBooking(true);
      }},
    ]);
  }

  async function submitBlock() {
    setBlockSaving(true);
    try {
      const payload = { date: selectedDate, reason: blockReason.trim() || "Blocked" };
      if (blockAllDay) {
        payload.all_day = true;
      } else {
        payload.start_time = blockStart;
        payload.end_time = blockEnd;
      }
      await api.staffBlockTime(payload);
      setBlockModal(false);
      load(true);
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setBlockSaving(false);
    }
  }

  const confirmed = bookings.filter(b => b.status === "confirmed");
  const revenue = confirmed.reduce((s, b) => s + (b.service_price ?? b.price ?? 0), 0);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  // Build a single-barber array for DayCalendarView
  // We use barber_id/name from the first booking (all bookings on staff view belong to this staff member)
  const staffBarber = bookings.length > 0
    ? [{ id: bookings[0].barber_id, name: bookings[0].barber_name }]
    : [];

  const dayStrip = getDayStrip();
  const sortedBookings = [...bookings].sort((a, b) => tMin(a.start_time) - tMin(b.start_time));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 7-day strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayStrip} contentContainerStyle={styles.dayStripContent}>
        {dayStrip.map(date => {
          const isSelected = date === selectedDate;
          const isToday = date === todayStr();
          const d = new Date(date + "T12:00:00");
          return (
            <TouchableOpacity
              key={date}
              style={[styles.dayBtn, isSelected && styles.dayBtnActive]}
              onPress={() => setSelectedDate(date)}
            >
              <Text style={[styles.dayWeekday, isSelected && styles.dayWeekdayActive]}>
                {d.toLocaleDateString("en-CA", { weekday: "short" })}
              </Text>
              <View style={[styles.dayNumWrap, isToday && styles.dayNumWrapToday, isSelected && styles.dayNumWrapActive]}>
                <Text style={[styles.dayNum, isSelected && styles.dayNumActive]}>{d.getDate()}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Stats + toggle row */}
      <View style={styles.statsBar}>
        <View style={styles.statsLeft}>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{confirmed.length}</Text>
            <Text style={styles.statLbl}>Cuts today</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statVal}>{fmtMoney(revenue)}</Text>
            <Text style={styles.statLbl}>Revenue</Text>
          </View>
        </View>
        <View style={styles.toggleGroup}>
          <TouchableOpacity
            style={[styles.toggleBtn, view === "cal" && styles.toggleBtnActive]}
            onPress={() => setView("cal")}
          >
            <Ionicons name="calendar-outline" size={14} color={view === "cal" ? C.cream : "rgba(250,250,250,0.6)"} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, view === "list" && styles.toggleBtnActive]}
            onPress={() => setView("list")}
          >
            <Ionicons name="menu" size={14} color={view === "list" ? C.cream : "rgba(250,250,250,0.6)"} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Next Up — only on today */}
      {!loading && isViewingToday && (
        <NextUpCard bookings={bookings} onPress={() => {}} />
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={C.espresso} size="large" /></View>
      ) : view === "cal" ? (
        <DayCalendarView
          bookings={bookings}
          barbers={staffBarber}
          allBarbers={staffBarber}
          nowTop={nowTop}
          scrollRef={calScrollRef}
          onBookingPress={() => {}}
          onSlotPress={handleSlotTap}
          onRefresh={() => { setRefreshing(true); load(true); }}
          refreshing={refreshing}
          date={selectedDate}
          blockedSlots={blockedSlots}
        />
      ) : (
        <ScrollView
          style={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.espresso} />}
        >
          {sortedBookings.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="cut-outline" size={36} color={C.muted} />
              <Text style={styles.emptyTitle}>Nothing booked</Text>
            </View>
          ) : (
            sortedBookings.map((b, i) => {
              const c = DCAL_COLORS[i % DCAL_COLORS.length];
              const isCancelled = b.status === "cancelled" || b.status === "no_show";
              const endMin = b.end_time ? tMin(b.end_time) : tMin(b.start_time) + (b.duration_min || 30);
              const isPast = isViewingToday && endMin < nowMin;

              return (
                <SwipeableCard
                  key={b.confirmation_code}
                  disabled={isCancelled}
                  onNoShow={() => handleNoShow(b.confirmation_code)}
                  onCancel={() => handleCancel(b.confirmation_code)}
                >
                  <View style={[
                    styles.card,
                    { backgroundColor: c.bg, borderLeftColor: c.bd },
                    isCancelled && styles.cardCancelled,
                    isPast && !isCancelled && styles.cardPast,
                  ]}>
                    <View style={styles.cardTop}>
                      <Text style={[styles.cardTime, { color: c.tx }]}>
                        {fmtTime(b.start_time)} – {fmtTime(b.end_time)}
                      </Text>
                      {b.status === "no_show" && <Text style={styles.badgeNoShow}>No-show</Text>}
                      {b.status === "cancelled" && <Text style={styles.badgeCancelled}>Cancelled</Text>}
                      {b.status === "confirmed" && isPast && <Text style={styles.badgePast}>Past</Text>}
                    </View>
                    <Text style={[styles.clientName, isCancelled && styles.clientNameMuted]}>{b.customer_name}</Text>
                    <Text style={styles.serviceName}>{b.service_name}</Text>
                    <View style={styles.cardMeta}>
                      <Text style={styles.cardPrice}>{fmtMoney(b.service_price ?? b.price ?? 0)}</Text>
                      {b.duration_min ? <Text style={styles.cardMetaText}> · {b.duration_min}min</Text> : null}
                      {b.customer_phone ? <Text style={styles.cardMetaText}> · {b.customer_phone}</Text> : null}
                    </View>
                  </View>
                </SwipeableCard>
              );
            })
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* New Booking FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => {
        setNewBookingPrefill({ date: selectedDate });
        setShowNewBooking(true);
      }}>
        <Ionicons name="add" size={26} color={C.cream} />
      </TouchableOpacity>

      {/* Block Time FAB (secondary) */}
      <TouchableOpacity style={[styles.fab, styles.fabSecondary]} onPress={() => {
        setBlockStart("09:00"); setBlockEnd("10:00");
        setBlockAllDay(false); setBlockReason("");
        setBlockModal(true);
      }}>
        <Ionicons name="ban-outline" size={18} color={C.espresso} />
      </TouchableOpacity>

      <NewBookingModal
        visible={showNewBooking}
        onClose={() => setShowNewBooking(false)}
        onSuccess={() => { hapticSuccess(); load(true); }}
        prefillDate={newBookingPrefill.date || selectedDate}
        prefillTime={newBookingPrefill.time}
        staffMode
      />

      {/* Block Time Modal */}
      <Modal visible={blockModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Block Time</Text>
            <Text style={styles.modalDate}>{selectedDate}</Text>

            <TouchableOpacity style={styles.allDayRow} onPress={() => setBlockAllDay(!blockAllDay)}>
              <View style={[styles.checkbox, blockAllDay && styles.checkboxChecked]}>
                {blockAllDay && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.allDayLabel}>All Day</Text>
            </TouchableOpacity>

            {!blockAllDay && (
              <View style={styles.timeRow}>
                <View style={styles.timeField}>
                  <Text style={styles.timeFieldLabel}>Start</Text>
                  <TextInput style={styles.timeInput} value={blockStart} onChangeText={setBlockStart} placeholder="09:00" placeholderTextColor={C.muted} />
                </View>
                <Text style={styles.timeDash}>–</Text>
                <View style={styles.timeField}>
                  <Text style={styles.timeFieldLabel}>End</Text>
                  <TextInput style={styles.timeInput} value={blockEnd} onChangeText={setBlockEnd} placeholder="10:00" placeholderTextColor={C.muted} />
                </View>
              </View>
            )}

            <Text style={styles.timeFieldLabel}>Reason (optional)</Text>
            <TextInput
              style={styles.reasonInput}
              value={blockReason}
              onChangeText={setBlockReason}
              placeholder="e.g. Lunch, Personal"
              placeholderTextColor={C.muted}
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setBlockModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalSaveBtn, blockSaving && { opacity: 0.6 }]} onPress={submitBlock} disabled={blockSaving}>
                <Text style={styles.modalSaveText}>{blockSaving ? "Saving…" : "Block"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  dayStrip: { flexGrow: 0, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  dayStripContent: { paddingHorizontal: 8, paddingVertical: 10 },
  dayBtn: { alignItems: "center", paddingHorizontal: 10, marginHorizontal: 2 },
  dayBtnActive: {},
  dayWeekday: { fontSize: 10, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  dayWeekdayActive: { color: C.terra },
  dayNumWrap: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  dayNumWrapToday: { borderWidth: 1.5, borderColor: C.border },
  dayNumWrapActive: { backgroundColor: C.terra },
  dayNum: { fontSize: 16, fontWeight: "700", color: C.espresso },
  dayNumActive: { color: C.cream },

  statsBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: C.espresso, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
  },
  statsLeft: { flexDirection: "row", alignItems: "center" },
  stat: {},
  statVal: { fontFamily: serif, fontSize: 17, fontWeight: "900", color: C.terra },
  statLbl: { fontSize: 9, fontWeight: "700", color: "rgba(250,250,250,0.4)", textTransform: "uppercase", letterSpacing: 1.2, marginTop: 1 },
  statDivider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.1)", marginHorizontal: 14 },
  toggleGroup: { flexDirection: "row", gap: 4 },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.2)" },
  toggleBtnActive: { backgroundColor: C.terra, borderColor: C.terra },
  toggleBtnText: { fontSize: 14, color: "rgba(250,250,250,0.6)" },
  toggleBtnTextActive: { color: C.cream },

  list: { flex: 1, padding: 12 },
  empty: { paddingTop: 60, alignItems: "center", gap: 10 },
  emptyIcon: {},
  emptyTitle: { fontSize: 16, fontWeight: "700", color: C.muted },

  card: {
    borderRadius: 10, padding: 10, paddingLeft: 12,
    borderWidth: 1, borderColor: "transparent", borderLeftWidth: 3,
  },
  cardCancelled: { opacity: 0.4 },
  cardPast: { opacity: 0.55 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 },
  cardTime: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  badgeNoShow: { fontSize: 9, fontWeight: "800", color: "#F59E0B", textTransform: "uppercase", letterSpacing: 0.5 },
  badgeCancelled: { fontSize: 9, fontWeight: "800", color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  badgePast: { fontSize: 9, fontWeight: "800", color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  clientName: { fontSize: 14, fontWeight: "700", color: C.espresso, marginBottom: 1 },
  clientNameMuted: { color: C.muted, textDecorationLine: "line-through" },
  serviceName: { fontSize: 11, color: C.muted, marginBottom: 5 },
  cardMeta: { flexDirection: "row", alignItems: "center" },
  cardPrice: { fontSize: 12, fontWeight: "700", color: C.espresso },
  cardMetaText: { fontSize: 10, color: C.muted },

  // FAB
  fab: {
    position: "absolute", bottom: 24, right: 20,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: C.espresso, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6,
    elevation: 6,
  },
  fabSecondary: {
    bottom: 84, right: 24, width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border,
  },

  // Block Time Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: C.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalTitle: { fontFamily: serif, fontSize: 20, fontWeight: "800", color: C.espresso, marginBottom: 2 },
  modalDate: { fontSize: 12, color: C.muted, marginBottom: 16 },
  allDayRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  checkbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  checkboxChecked: { backgroundColor: C.terra, borderColor: C.terra },
  checkmark: { color: C.cream, fontSize: 13, fontWeight: "800" },
  allDayLabel: { fontSize: 14, fontWeight: "600", color: C.espresso },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  timeField: { flex: 1 },
  timeFieldLabel: { fontSize: 10, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 },
  timeInput: { backgroundColor: C.surface, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: C.espresso, borderWidth: 1, borderColor: C.border },
  timeDash: { fontSize: 16, color: C.muted, marginTop: 16 },
  reasonInput: { backgroundColor: C.surface, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: C.espresso, borderWidth: 1, borderColor: C.border, marginBottom: 20 },
  modalBtns: { flexDirection: "row", gap: 10 },
  modalCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 9, borderWidth: 1.5, borderColor: C.border, alignItems: "center" },
  modalCancelText: { fontSize: 14, fontWeight: "700", color: C.muted },
  modalSaveBtn: { flex: 1, paddingVertical: 12, borderRadius: 9, backgroundColor: C.espresso, alignItems: "center" },
  modalSaveText: { fontSize: 14, fontWeight: "800", color: C.cream },
});
