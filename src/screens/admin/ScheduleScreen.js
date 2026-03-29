import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Alert, ActivityIndicator, TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../lib/api";
import { C, serif, fmtMoney } from "../../lib/theme";
import { success as hapticSuccess, warn as hapticWarn } from "../../lib/haptics";
import { useToast, Toast } from "../../components/Toast";
import BookingDetailModal from "../../components/BookingDetailModal";
import NewBookingModal from "../../components/NewBookingModal";
import SwipeableCard from "../../components/SwipeableCard";
import { SkeletonCalendar, SkeletonList } from "../../components/Skeleton";
import ErrorState from "../../components/ErrorState";
import { getCached, setCache } from "../../lib/cache";
import DayCalendarView, {
  DCAL_COLORS, tMin, fmtTime, pxToTimeStr, getNowTop, isNowVisible, PX_PER_HOUR,
} from "../../components/DayCalendarView";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function getMondayOfWeek(offset = 0) {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}
function getWeekDates(offset = 0) {
  const monday = getMondayOfWeek(offset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}
function todayIndex() {
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
}

function StatusBadge({ label, color }) {
  return (
    <View style={[badgeStyles.badge, { borderColor: color + "40", backgroundColor: color + "18" }]}>
      <Text style={[badgeStyles.text, { color }]}>{label}</Text>
    </View>
  );
}
const badgeStyles = StyleSheet.create({
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  text: { fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
});

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const [schedule, setSchedule] = useState({});
  const [allBarbersList, setAllBarbersList] = useState([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [dayIdx, setDayIdx] = useState(todayIndex());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [barberColorMap, setBarberColorMap] = useState({});
  const [barberFilter, setBarberFilter] = useState("all");
  const [view, setView] = useState("cal");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [newBookingPrefill, setNewBookingPrefill] = useState({});
  const [nowTop, setNowTop] = useState(getNowTop);
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [shopHours, setShopHours] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState(null);
  const calScrollRef = useRef(null);
  const { showToast, toastProps } = useToast();

  const weekDates = getWeekDates(weekOffset);
  const selectedDate = weekDates[dayIdx];
  const todayStr = new Date().toISOString().split("T")[0];
  const isToday = selectedDate === todayStr;

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    // Show cached data on cold load
    if (!quiet && Object.keys(schedule).length === 0) {
      const cached = await getCached(`schedule_${weekOffset}`);
      if (cached?.data) {
        setSchedule(cached.data.schedule);
        setBarberColorMap(cached.data.colorMap);
        setAllBarbersList(cached.data.barbers);
        setBlockedSlots(cached.data.blocked || []);
        if (cached.data.shopHours) setShopHours(cached.data.shopHours);
      }
    }
    try {
      const [data, bs] = await Promise.all([api.adminSchedule(weekDates[0]), api.adminBarbers()]);
      const byDate = {};
      const colorMap = {};
      (bs || []).forEach((b, idx) => { colorMap[b.id] = idx; });
      let colorIdx = (bs || []).length;
      for (const b of (data.bookings || [])) {
        if (!byDate[b.date]) byDate[b.date] = [];
        byDate[b.date].push(b);
        if (colorMap[b.barber_id] === undefined) colorMap[b.barber_id] = colorIdx++;
      }
      setSchedule(byDate);
      setBarberColorMap(colorMap);
      const barbers = (bs || []).map(b => ({ id: b.id, name: b.name }));
      setAllBarbersList(barbers);
      const [blocked, settings] = await Promise.all([
        api.adminBlocked().catch(() => []),
        api.adminSettings().catch(() => ({})),
      ]);
      const blockedList = Array.isArray(blocked) ? blocked : (blocked?.blocked || []);
      setBlockedSlots(blockedList);
      if (settings?.hours) setShopHours(settings.hours);
      setError(null);
      setCache(`schedule_${weekOffset}`, { schedule: byDate, colorMap, barbers, blocked: blockedList, shopHours: settings?.hours });
    } catch (err) {
      if (Object.keys(schedule).length === 0) setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [weekOffset]);

  useEffect(() => { load(); }, [weekOffset]);

  useEffect(() => {
    const timer = setInterval(() => setNowTop(getNowTop()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Auto-scroll to now when switching to calendar on today
  useEffect(() => {
    if (view === "cal" && isToday && isNowVisible() && calScrollRef.current) {
      setTimeout(() => {
        calScrollRef.current?.scrollTo({ y: Math.max(0, nowTop - PX_PER_HOUR * 1.5), animated: true });
      }, 300);
    }
  }, [view, selectedDate]);

  function prevDay() {
    if (dayIdx === 0) { setWeekOffset(w => w - 1); setDayIdx(6); }
    else setDayIdx(d => d - 1);
  }
  function nextDay() {
    if (dayIdx === 6) { setWeekOffset(w => w + 1); setDayIdx(0); }
    else setDayIdx(d => d + 1);
  }
  function goToToday() { setWeekOffset(0); setDayIdx(todayIndex()); }

  const allDayBookings = schedule[selectedDate] || [];
  const filteredBookings = barberFilter === "all"
    ? allDayBookings
    : allDayBookings.filter(b => String(b.barber_id) === barberFilter);

  const confirmedCount = allDayBookings.filter(b => b.status === "confirmed").length;
  const revenue = allDayBookings
    .filter(b => b.status === "confirmed")
    .reduce((s, b) => s + (b.service_price ?? b.price ?? 0), 0);

  const d = new Date(selectedDate + "T12:00:00");
  const dayLabel = `${DAYS[dayIdx]}, ${d.toLocaleDateString("en-CA", { month: "short", day: "numeric" })}`;

  // Barbers for DayCalendarView
  const filteredBarbers = barberFilter === "all"
    ? allBarbersList
    : allBarbersList.filter(b => String(b.id) === barberFilter);

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  // Search across all days in the week
  const sq = searchQuery.trim().toLowerCase();
  const searchResults = sq.length >= 2
    ? Object.entries(schedule).flatMap(([date, bks]) =>
        bks.filter(b => b.customer_name?.toLowerCase().includes(sq) || b.customer_phone?.includes(sq))
          .map(b => ({ ...b, date }))
      ).sort((a, b) => a.date.localeCompare(b.date) || tMin(a.start_time) - tMin(b.start_time))
    : [];

  function openDetail(b) { setSelectedBooking(b); setShowDetail(true); }

  async function handleNoShow(code) {
    hapticWarn();
    Alert.alert("Mark No-Show", "Mark this booking as a no-show?", [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", style: "destructive", onPress: async () => {
        try { await api.adminNoShow(code); hapticSuccess(); showToast("Marked as no-show"); load(true); }
        catch (err) { Alert.alert("Error", err.message); }
      }},
    ]);
  }

  async function handleCancel(code) {
    hapticWarn();
    Alert.alert("Cancel Booking", "Cancel this booking?", [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", style: "destructive", onPress: async () => {
        try { await api.adminCancelBooking(code); hapticSuccess(); showToast("Booking cancelled"); load(true); }
        catch (err) { Alert.alert("Error", err.message); }
      }},
    ]);
  }

  function handleReschedule(booking) {
    setNewBookingPrefill({
      barberId: String(booking.barber_id),
      serviceId: String(booking.service_id),
      date: booking.date,
      prefillName: booking.customer_name,
      prefillPhone: booking.customer_phone,
      prefillEmail: booking.customer_email,
    });
    setShowNewBooking(true);
  }

  function handleSlotTap({ barberId, barberName, time }) {
    Alert.alert(`${barberName} · ${fmtTime(time)}`, null, [
      { text: "📅 New Booking", onPress: () => {
        setNewBookingPrefill({ barberId: String(barberId), time });
        setShowNewBooking(true);
      }},
      { text: "🚫 Block Time", onPress: () => {
        Alert.alert("Block Time", "Block this 30-min slot?", [
          { text: "Cancel", style: "cancel" },
          { text: "Block", style: "destructive", onPress: async () => {
            const endMin = tMin(time) + 30;
            const eh = Math.floor(endMin / 60), em = endMin % 60;
            const endTime = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
            try {
              await api.adminBlockTime({ barber_id: barberId, date: selectedDate, all_day: false, start_time: time, end_time: endTime, reason: "Blocked" });
              load(true);
            } catch (err) { Alert.alert("Error", err.message); }
          }},
        ]);
      }},
      { text: "Cancel", style: "cancel" },
    ]);
  }

  const sortedBookings = [...filteredBookings].sort((a, b) => tMin(a.start_time) - tMin(b.start_time));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Day nav */}
      <View style={styles.dayNav}>
        <TouchableOpacity style={styles.navBtn} onPress={prevDay}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <View style={styles.navCenter}>
          <Text style={styles.navLabel}>{dayLabel}</Text>
          {!isToday && (
            <TouchableOpacity onPress={goToToday} style={styles.todayPill}>
              <Text style={styles.todayPillText}>Today</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.navBtn} onPress={nextDay}>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statsLeft}>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{confirmedCount}</Text>
            <Text style={styles.statLbl}>Bookings</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statVal}>{fmtMoney(revenue)}</Text>
            <Text style={styles.statLbl}>Revenue</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.newBtn} onPress={() => { setNewBookingPrefill({}); setShowNewBooking(true); }}>
          <Text style={styles.newBtnText}>+ New Booking</Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search bookings by name or phone…"
          placeholderTextColor={C.muted}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.searchClear}>
            <Text style={styles.searchClearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Controls: toggle + barber filter */}
      {sq.length < 2 && <View style={styles.controls}>
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, view === "cal" && styles.toggleBtnActive]}
            onPress={() => setView("cal")}
          >
            <Text style={[styles.toggleBtnText, view === "cal" && styles.toggleBtnTextActive]}>📅 Calendar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, view === "list" && styles.toggleBtnActive]}
            onPress={() => setView("list")}
          >
            <Text style={[styles.toggleBtnText, view === "list" && styles.toggleBtnTextActive]}>☰ List</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, view === "week" && styles.toggleBtnActive]}
            onPress={() => setView("week")}
          >
            <Text style={[styles.toggleBtnText, view === "week" && styles.toggleBtnTextActive]}>▦ Week</Text>
          </TouchableOpacity>
        </View>

        {allBarbersList.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.pill, barberFilter === "all" && styles.pillActive]}
                onPress={() => setBarberFilter("all")}
              >
                <Text style={[styles.pillText, barberFilter === "all" && styles.pillTextActive]}>All</Text>
              </TouchableOpacity>
              {allBarbersList.map((b) => {
                const ci = barberColorMap[b.id] ?? 0;
                const c = DCAL_COLORS[ci % DCAL_COLORS.length];
                const active = barberFilter === String(b.id);
                return (
                  <TouchableOpacity
                    key={b.id}
                    style={[styles.pill, active && { backgroundColor: c.bd, borderColor: c.bd }]}
                    onPress={() => setBarberFilter(active ? "all" : String(b.id))}
                  >
                    <View style={[styles.pillDot, { backgroundColor: c.bd }]} />
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>{b.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>}

      {/* Search results */}
      {sq.length >= 2 ? (
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {searchResults.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No bookings match "{searchQuery}"</Text>
            </View>
          ) : (
            <>
              <Text style={styles.searchCount}>{searchResults.length} result{searchResults.length !== 1 ? "s" : ""} this week</Text>
              {searchResults.map((b) => {
                const ci = barberColorMap[b.barber_id] ?? 0;
                const c = DCAL_COLORS[ci % DCAL_COLORS.length];
                const bDate = new Date(b.date + "T12:00:00");
                const dateLbl = bDate.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
                return (
                  <TouchableOpacity
                    key={b.confirmation_code}
                    style={[styles.listCard, { backgroundColor: c.bg, borderLeftColor: c.bd }]}
                    onPress={() => { setSearchQuery(""); openDetail(b); }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.listCardHeader}>
                      <Text style={[styles.listTime, { color: c.tx }]}>{dateLbl} · {fmtTime(b.start_time)}</Text>
                      {b.status === "cancelled" && <StatusBadge label="Cancelled" color={C.muted} />}
                      {b.status === "no_show" && <StatusBadge label="No-show" color="#F59E0B" />}
                    </View>
                    <Text style={styles.listName}>{b.customer_name}</Text>
                    <Text style={styles.listSvc} numberOfLines={1}>{b.service_name} · {b.barber_name}</Text>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      ) : error && Object.keys(schedule).length === 0 ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : loading && Object.keys(schedule).length === 0 ? (
        <View style={{ flex: 1, padding: 12 }}>{view === "cal" ? <SkeletonCalendar /> : <SkeletonList count={5} />}</View>
      ) : view === "cal" ? (
        <DayCalendarView
          bookings={allDayBookings}
          barbers={filteredBarbers}
          allBarbers={allBarbersList}
          nowTop={nowTop}
          scrollRef={calScrollRef}
          onBookingPress={openDetail}
          onSlotPress={handleSlotTap}
          onRefresh={() => { setRefreshing(true); load(true); }}
          refreshing={refreshing}
          date={selectedDate}
          blockedSlots={blockedSlots.filter(b => b.date === selectedDate)}
          shopHours={shopHours}
        />
      ) : view === "week" ? (
        <ScrollView
          style={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.espresso} />}
        >
          {weekDates.map((wd, wi) => {
            const dayBks = schedule[wd] || [];
            const confirmed = dayBks.filter(b => b.status === "confirmed");
            const dayRev = confirmed.reduce((s, b) => s + (b.service_price ?? b.price ?? 0), 0);
            const wd_ = new Date(wd + "T12:00:00");
            const dayName = DAYS[wi];
            const isSelected = wd === selectedDate;
            const isT = wd === todayStr;
            const DAY_NAMES_MAP = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
            const dayOfWeek = DAY_NAMES_MAP[wd_.getDay()];
            const dh = shopHours?.[dayOfWeek];
            const dayClosed = dh && !dh.open;
            // Bar width proportional to bookings (max 100%)
            const maxBks = Math.max(...weekDates.map(d => (schedule[d] || []).filter(b => b.status === "confirmed").length), 1);
            const barPct = confirmed.length / maxBks;

            return (
              <TouchableOpacity
                key={wd}
                style={[styles.weekRow, isSelected && styles.weekRowActive]}
                onPress={() => { setDayIdx(wi); setView("cal"); }}
                activeOpacity={0.7}
              >
                <View style={styles.weekLeft}>
                  <Text style={[styles.weekDay, isT && styles.weekDayToday]}>{dayName.slice(0, 3)}</Text>
                  <Text style={[styles.weekDate, isT && styles.weekDayToday]}>
                    {wd_.toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
                  </Text>
                </View>
                {dayClosed ? (
                  <Text style={styles.weekClosed}>Closed</Text>
                ) : (
                  <View style={styles.weekRight}>
                    <View style={styles.weekBarTrack}>
                      <View style={[styles.weekBarFill, { width: `${Math.max(barPct * 100, confirmed.length > 0 ? 8 : 0)}%` }]} />
                    </View>
                    <View style={styles.weekStats}>
                      <Text style={styles.weekCount}>{confirmed.length} booking{confirmed.length !== 1 ? "s" : ""}</Text>
                      <Text style={styles.weekRev}>{fmtMoney(dayRev)}</Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 32 }} />
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.espresso} />}
        >
          {sortedBookings.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📅</Text>
              <Text style={styles.emptyTitle}>No bookings</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => { setNewBookingPrefill({}); setShowNewBooking(true); }}>
                <Text style={styles.emptyBtnText}>+ New Booking</Text>
              </TouchableOpacity>
            </View>
          ) : (
            sortedBookings.map((b) => {
              const ci = barberColorMap[b.barber_id] ?? 0;
              const c = DCAL_COLORS[ci % DCAL_COLORS.length];
              const isCancelled = b.status === "cancelled" || b.status === "no_show";
              const endMin = b.end_time ? tMin(b.end_time) : tMin(b.start_time) + (b.duration_min || 30);
              const isPast = isToday && endMin < nowMin;

              return (
                <SwipeableCard
                  key={b.confirmation_code}
                  disabled={isCancelled}
                  onNoShow={() => handleNoShow(b.confirmation_code)}
                  onCancel={() => handleCancel(b.confirmation_code)}
                >
                  <TouchableOpacity
                    style={[
                      styles.listCard,
                      { backgroundColor: c.bg, borderLeftColor: c.bd },
                      isCancelled && styles.listCardCancelled,
                      isPast && !isCancelled && styles.listCardPast,
                    ]}
                    onPress={() => openDetail(b)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.listCardHeader}>
                      <Text style={[styles.listTime, { color: c.tx }]}>{fmtTime(b.start_time)} – {fmtTime(b.end_time)}</Text>
                      {b.status === "no_show" && <StatusBadge label="No-show" color="#F59E0B" />}
                      {b.status === "cancelled" && <StatusBadge label="Cancelled" color={C.muted} />}
                      {b.status === "confirmed" && isPast && <StatusBadge label="Past" color={C.muted} />}
                    </View>
                    <Text style={[styles.listName, isCancelled && styles.listNameMuted]}>{b.customer_name}</Text>
                    <Text style={styles.listSvc} numberOfLines={1}>{b.service_name}</Text>
                    <View style={styles.listFooter}>
                      <Text style={styles.listPrice}>${b.service_price ?? b.price ?? 0}</Text>
                      {b.duration_min ? <Text style={styles.listMeta}> · {b.duration_min}min</Text> : null}
                      <Text style={styles.listMeta}> · {b.barber_name}</Text>
                    </View>
                  </TouchableOpacity>
                </SwipeableCard>
              );
            })
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      <BookingDetailModal
        booking={selectedBooking}
        visible={showDetail}
        onClose={() => setShowDetail(false)}
        onAction={() => load(true)}
        onReschedule={handleReschedule}
      />
      <NewBookingModal
        visible={showNewBooking}
        onClose={() => setShowNewBooking(false)}
        onSuccess={() => { hapticSuccess(); showToast("Booking confirmed!"); load(true); }}
        prefillDate={newBookingPrefill.date || selectedDate}
        prefillBarberId={newBookingPrefill.barberId}
        prefillTime={newBookingPrefill.time}
        prefillName={newBookingPrefill.prefillName}
        prefillPhone={newBookingPrefill.prefillPhone}
        prefillEmail={newBookingPrefill.prefillEmail}
      />
      <Toast {...toastProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Search
  searchBar: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: C.espresso, paddingVertical: 8 },
  searchClear: { padding: 6 },
  searchClearText: { fontSize: 14, color: C.muted },
  searchCount: { fontSize: 12, fontWeight: "700", color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 },

  dayNav: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 4, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.white,
  },
  navBtn: { width: 48, alignItems: "center", justifyContent: "center", paddingVertical: 4 },
  navArrow: { fontSize: 28, color: C.espresso, fontWeight: "300", lineHeight: 32 },
  navCenter: { flex: 1, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 },
  navLabel: { fontFamily: serif, fontSize: 15, fontWeight: "700", color: C.espresso },
  todayPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, borderWidth: 1.5, borderColor: C.terra },
  todayPillText: { fontSize: 11, fontWeight: "700", color: C.terra },

  statsBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: C.espresso, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
  },
  statsLeft: { flexDirection: "row", alignItems: "center" },
  stat: {},
  statVal: { fontFamily: serif, fontSize: 17, fontWeight: "900", color: C.terra },
  statLbl: { fontSize: 9, fontWeight: "700", color: "rgba(247,243,238,0.4)", textTransform: "uppercase", letterSpacing: 1.5, marginTop: 1 },
  statDivider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.1)", marginHorizontal: 14 },
  newBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: C.terra },
  newBtnText: { fontSize: 12, fontWeight: "800", color: C.cream },

  controls: { backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  controlsRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 6 },
  toggleBtn: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5, borderColor: C.border },
  toggleBtnActive: { backgroundColor: C.espresso, borderColor: C.espresso },
  toggleBtnText: { fontSize: 12, fontWeight: "700", color: C.muted },
  toggleBtnTextActive: { color: C.cream },
  filterScroll: { paddingBottom: 10 },
  filterRow: { flexDirection: "row", gap: 6, paddingHorizontal: 10, paddingBottom: 8 },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.white },
  pillActive: { backgroundColor: C.espresso, borderColor: C.espresso },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 11, fontWeight: "700", color: C.muted },
  pillTextActive: { color: C.cream },

  list: { flex: 1, padding: 12 },
  listCard: {
    borderRadius: 10, padding: 10, paddingLeft: 12,
    borderWidth: 1, borderColor: "transparent", borderLeftWidth: 3,
  },
  listCardCancelled: { opacity: 0.4 },
  listCardPast: { opacity: 0.55 },
  listCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 },
  listTime: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  listName: { fontSize: 13, fontWeight: "700", color: C.espresso, marginBottom: 1 },
  listNameMuted: { color: C.muted, textDecorationLine: "line-through" },
  listSvc: { fontSize: 11, color: C.muted, marginBottom: 5 },
  listFooter: { flexDirection: "row", alignItems: "center" },
  listPrice: { fontSize: 12, fontWeight: "700", color: C.espresso },
  listMeta: { fontSize: 10, color: C.muted },

  // Week view
  weekRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  weekRowActive: { backgroundColor: "#F5F1ED" },
  weekLeft: { width: 56 },
  weekDay: { fontSize: 13, fontWeight: "800", color: C.espresso },
  weekDate: { fontSize: 11, color: C.muted, marginTop: 1 },
  weekDayToday: { color: C.terra },
  weekRight: { flex: 1 },
  weekBarTrack: {
    height: 6, backgroundColor: C.border, borderRadius: 3,
    overflow: "hidden", marginBottom: 6,
  },
  weekBarFill: { height: 6, backgroundColor: C.terra, borderRadius: 3 },
  weekStats: { flexDirection: "row", justifyContent: "space-between" },
  weekCount: { fontSize: 12, fontWeight: "600", color: C.espresso },
  weekRev: { fontSize: 12, fontWeight: "700", color: C.terra },
  weekClosed: { flex: 1, fontSize: 12, color: C.muted, fontStyle: "italic" },

  empty: { paddingTop: 60, alignItems: "center", gap: 10 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: C.muted },
  emptyBtn: { marginTop: 4, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: C.espresso, borderRadius: 10 },
  emptyBtnText: { fontSize: 14, fontWeight: "700", color: C.cream },
});
