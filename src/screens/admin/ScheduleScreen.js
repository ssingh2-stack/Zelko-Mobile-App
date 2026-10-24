import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Alert, ActivityIndicator, TextInput, Modal,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import ScreenTitle from "../../components/ScreenTitle";
import { F, C, fmtMoney } from "../../lib/theme";
import { success as hapticSuccess, warn as hapticWarn } from "../../lib/haptics";
import { useToast, Toast } from "../../components/Toast";
import BookingDetailModal from "../../components/BookingDetailModal";
import CollectPaymentModal from "../../components/CollectPaymentModal";
import NewBookingModal from "../../components/NewBookingModal";
import { useRole } from "../../lib/RoleContext";
import SwipeableCard from "../../components/SwipeableCard";
import { SkeletonCalendar, SkeletonList } from "../../components/Skeleton";
import ErrorState from "../../components/ErrorState";
import { getCached, setCache } from "../../lib/cache";
import DayCalendarView, {
  DCAL_COLORS, tMin, fmtTime, pxToTimeStr, getNowTop, isNowVisible, PX_PER_HOUR,
} from "../../components/DayCalendarView";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function getMonthGrid(monthOffset = 0) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + monthOffset;
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  // Monday = 0, Sunday = 6
  const startDow = (first.getDay() + 6) % 7;
  const daysInMonth = last.getDate();
  const prevLast = new Date(year, month, 0);
  const daysInPrev = prevLast.getDate();

  const weeks = [];
  let week = [];
  // Fill leading days from previous month
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month, -(i));
    week.push({
      date: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`,
      dayNum: d.getDate(),
      isCurrentMonth: false,
    });
  }
  // Fill current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    week.push({
      date: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`,
      dayNum: day,
      isCurrentMonth: true,
    });
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  // Fill trailing days from next month
  if (week.length > 0) {
    let nextDay = 1;
    while (week.length < 7) {
      const d = new Date(year, month + 1, nextDay++);
      week.push({
        date: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`,
        dayNum: d.getDate(),
        isCurrentMonth: false,
      });
    }
    weeks.push(week);
  }

  const monthDate = new Date(year, month, 1);
  const monthStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth()+1).padStart(2,"0")}`;
  const monthLabel = `${MONTH_NAMES[monthDate.getMonth()]} ${monthDate.getFullYear()}`;

  return { weeks, monthStr, monthLabel };
}

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
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
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
  text: { fontSize: 11, fontFamily: F.monoMedium, textTransform: "uppercase", letterSpacing: 0.5 },
});

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const { role } = useRole();
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
  const [showPayment, setShowPayment] = useState(false);
  const [paymentBooking, setPaymentBooking] = useState(null);
  const [newBookingPrefill, setNewBookingPrefill] = useState({});
  const [nowTop, setNowTop] = useState(getNowTop);
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [shopHours, setShopHours] = useState(null);
  const [barberAvail, setBarberAvail] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState(null);
  const [scheduleMode, setScheduleMode] = useState("week");
  const [monthOffset, setMonthOffset] = useState(0);
  const [monthBookings, setMonthBookings] = useState({});
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [blockModal, setBlockModal] = useState(false);
  const [blockInfo, setBlockInfo] = useState({});
  const [blockDuration, setBlockDuration] = useState(30);
  const [blockReason, setBlockReason] = useState("");
  const [blockSaving, setBlockSaving] = useState(false);
  const calScrollRef = useRef(null);
  const { showToast, toastProps } = useToast();

  const weekDates = getWeekDates(weekOffset);
  const selectedDate = weekDates[dayIdx];
  const _now = new Date();
  const todayStr = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,"0")}-${String(_now.getDate()).padStart(2,"0")}`;
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
      // Load barber availability
      Promise.all(barbers.map(b => api.adminBarberAvailability(b.id).then(a => [b.id, a]).catch(() => [b.id, []]))).then(pairs => {
        const map = {};
        pairs.forEach(([id, a]) => { map[id] = a || []; });
        setBarberAvail(map);
      }).catch(() => {});
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

  // Refresh when tab comes into focus (e.g. after creating booking on Today tab)
  useFocusEffect(useCallback(() => { load(true); }, [weekOffset]));

  useEffect(() => {
    const timer = setInterval(() => setNowTop(getNowTop()), 60000);
    return () => clearInterval(timer);
  }, []);

  const loadMonth = useCallback(async () => {
    setLoadingMonth(true);
    try {
      const { monthStr } = getMonthGrid(monthOffset);
      const data = await api.adminScheduleMonth(monthStr);
      const byDate = {};
      for (const b of (data.bookings || [])) {
        if (!byDate[b.date]) byDate[b.date] = [];
        byDate[b.date].push(b);
      }
      setMonthBookings(byDate);
    } catch (err) {
      // silently ignore month load failure
    } finally {
      setLoadingMonth(false);
    }
  }, [monthOffset]);

  useEffect(() => {
    if (scheduleMode === "month") loadMonth();
  }, [scheduleMode, monthOffset]);

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
  // Barber legend: stable color per barber by index in allBarbersList
  const barberLegend = (allBarbersList || []).map((b, i) => ({
    id: b.id, name: b.name, color: DCAL_COLORS[i % DCAL_COLORS.length].bd,
  }));
  const filteredBookings = barberFilter === "all"
    ? allDayBookings
    : allDayBookings.filter(b => String(b.barber_id) === barberFilter);

  // Stats: show month totals in month mode, day totals in week mode
  const confirmedCount = scheduleMode === "month"
    ? Object.values(monthBookings).flat()
        .filter(b => b.status === "confirmed" && (barberFilter === "all" || String(b.barber_id) === barberFilter))
        .length
    : allDayBookings.filter(b => b.status === "confirmed").length;
  const revenue = scheduleMode === "month"
    ? Object.values(monthBookings).flat()
        .filter(b => b.status === "confirmed" && (barberFilter === "all" || String(b.barber_id) === barberFilter))
        .reduce((s, b) => s + (b.service_price ?? b.price ?? 0), 0)
    : allDayBookings
        .filter(b => b.status === "confirmed")
        .reduce((s, b) => s + (b.service_price ?? b.price ?? 0), 0);
  const noShowCount = scheduleMode === "month"
    ? Object.values(monthBookings).flat()
        .filter(b => b.status === "no_show" && (barberFilter === "all" || String(b.barber_id) === barberFilter))
        .length
    : allDayBookings.filter(b => b.status === "no_show").length;

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
    Alert.alert("Mark no-show", "Mark this booking as a no-show?", [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", style: "destructive", onPress: async () => {
        try { await api.adminNoShow(code); hapticSuccess(); showToast("Marked as no-show"); load(true); }
        catch (err) { Alert.alert("Error", err.message); }
      }},
    ]);
  }

  async function handleCancel(code) {
    hapticWarn();
    Alert.alert("Cancel booking", "Cancel this booking?", [
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

  function handleBlockPress(bl) {
    const reason = bl.reason || "Blocked";
    const range = bl.all_day ? "all day" : `${fmtTime(bl.start_time)}–${fmtTime(bl.end_time)}`;
    const shiftEnd = (deltaMin) => {
      const [h, m] = bl.end_time.split(":").map(Number);
      const total = Math.max(tMin(bl.start_time) + 15, h * 60 + m + deltaMin);
      return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    };
    const buttons = [];
    if (!bl.all_day) {
      buttons.push({ text: "Extend +15 min", onPress: async () => {
        try { await api.adminUpdateBlock(bl.id, { end_time: shiftEnd(15) }); showToast("Block extended"); load(true); }
        catch (err) { Alert.alert("Error", err.message); }
      }});
      buttons.push({ text: "Shorten −15 min", onPress: async () => {
        try { await api.adminUpdateBlock(bl.id, { end_time: shiftEnd(-15) }); showToast("Block shortened"); load(true); }
        catch (err) { Alert.alert("Error", err.message); }
      }});
    }
    buttons.push({ text: "Remove block", style: "destructive", onPress: async () => {
      try { await api.adminDeleteBlock(bl.id); showToast("Block removed"); load(true); }
      catch (err) { Alert.alert("Error", err.message); }
    }});
    buttons.push({ text: "Cancel", style: "cancel" });
    Alert.alert(`Block · ${reason}`, range, buttons);
  }

  function handleBufferPress(bk) {
    const cur = bk.buffer_minutes || 0;
    Alert.alert(
      `Buffer · ${bk.customer_name}`,
      `Currently ${cur} min after this booking.`,
      [
        { text: "Remove buffer", style: "destructive", onPress: async () => {
          try { await api.adminUpdateBooking(bk.confirmation_code, { buffer_override: 0 }); showToast("Buffer removed"); load(true); }
          catch (err) { Alert.alert("Error", err.message); }
        }},
        { text: `Extend +15 min`, onPress: async () => {
          try { await api.adminUpdateBooking(bk.confirmation_code, { buffer_override: cur + 15 }); showToast("Buffer extended"); load(true); }
          catch (err) { Alert.alert("Error", err.message); }
        }},
        { text: "Reset to default", onPress: async () => {
          try { await api.adminUpdateBooking(bk.confirmation_code, { buffer_override: null }); showToast("Buffer reset"); load(true); }
          catch (err) { Alert.alert("Error", err.message); }
        }},
        { text: "Cancel", style: "cancel" },
      ]
    );
  }

  function handleSlotTap({ barberId, barberName, time }) {
    Alert.alert(`${barberName} · ${fmtTime(time)}`, null, [
      { text: "New booking", onPress: () => {
        setNewBookingPrefill({ barberId: String(barberId), time });
        setShowNewBooking(true);
      }},
      { text: "Block time", onPress: () => {
        setBlockInfo({ barberId, barberName, time });
        setBlockDuration(30);
        setBlockReason("");
        setBlockModal(true);
      }},
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function submitBlock() {
    setBlockSaving(true);
    try {
      const startMin = tMin(blockInfo.time);
      const endMin = startMin + blockDuration;
      const endTime = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
      await api.adminBlockTime({
        barber_id: blockInfo.barberId, date: selectedDate, all_day: false,
        start_time: blockInfo.time, end_time: endTime,
        reason: blockReason.trim() || "Blocked",
      });
      hapticSuccess(); showToast("Time blocked");
      setBlockModal(false);
      load(true);
    } catch (err) { Alert.alert("Error", err.message); }
    setBlockSaving(false);
  }

  const sortedBookings = [...filteredBookings].sort((a, b) => tMin(a.start_time) - tMin(b.start_time));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenTitle title="Schedule" right={(
      <View style={styles.modeToggleRow}>
        <TouchableOpacity
          style={[styles.modeToggleBtn, scheduleMode === "week" && styles.modeToggleBtnActive]}
          onPress={() => setScheduleMode("week")}
        >
          <Text style={[styles.modeToggleText, scheduleMode === "week" && styles.modeToggleTextActive]}>Week</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeToggleBtn, scheduleMode === "month" && styles.modeToggleBtnActive]}
          onPress={() => setScheduleMode("month")}
        >
          <Text style={[styles.modeToggleText, scheduleMode === "month" && styles.modeToggleTextActive]}>Month</Text>
        </TouchableOpacity>
      </View>
      )} />

      {/* Day nav (week mode) */}
      {scheduleMode === "week" && (
      <View style={styles.dayNav}>
        <TouchableOpacity style={styles.navBtn} onPress={prevDay}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <View style={styles.navCenter}>
          <Text style={styles.navLabel}>{dayLabel}</Text>
          {!isToday && (
            <TouchableOpacity onPress={goToToday} style={styles.todayPill}>
              <Text style={styles.todayPillText}>Back to today</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.navBtn} onPress={nextDay}>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
      </View>
      )}

      {/* Month nav (month mode) */}
      {scheduleMode === "month" && (() => {
        const { monthLabel } = getMonthGrid(monthOffset);
        return (
          <View style={styles.monthNav}>
            <TouchableOpacity style={styles.navBtn} onPress={() => setMonthOffset(o => o - 1)}>
              <Text style={styles.navArrow}>‹</Text>
            </TouchableOpacity>
            <View style={styles.navCenter}>
              <Text style={styles.navLabel}>{monthLabel}</Text>
              {monthOffset !== 0 && (
                <TouchableOpacity onPress={() => setMonthOffset(0)} style={styles.todayPill}>
                  <Text style={styles.todayPillText}>This month</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={styles.navBtn} onPress={() => setMonthOffset(o => o + 1)}>
              <Text style={styles.navArrow}>›</Text>
            </TouchableOpacity>
          </View>
        );
      })()}

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
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statVal}>{noShowCount}</Text>
            <Text style={styles.statLbl}>No-shows</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.newBtn} onPress={() => { setNewBookingPrefill({}); setShowNewBooking(true); }}>
          <Ionicons name="add" size={18} color={C.onBlue} />
          <Text style={styles.newBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={C.muted} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by client name or phone"
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
        {scheduleMode === "week" && (
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, view === "cal" && styles.toggleBtnActive]}
            onPress={() => setView("cal")}
          >
            <View style={styles.toggleBtnInner}><Ionicons name="calendar-outline" size={14} color={view === "cal" ? C.paper : C.muted} /><Text style={[styles.toggleBtnText, view === "cal" && styles.toggleBtnTextActive]}> Calendar</Text></View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, view === "list" && styles.toggleBtnActive]}
            onPress={() => setView("list")}
          >
            <View style={styles.toggleBtnInner}><Ionicons name="menu" size={14} color={view === "list" ? C.paper : C.muted} /><Text style={[styles.toggleBtnText, view === "list" && styles.toggleBtnTextActive]}> List</Text></View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, view === "week" && styles.toggleBtnActive]}
            onPress={() => setView("week")}
          >
            <View style={styles.toggleBtnInner}><Ionicons name="grid-outline" size={14} color={view === "week" ? C.paper : C.muted} /><Text style={[styles.toggleBtnText, view === "week" && styles.toggleBtnTextActive]}> Week</Text></View>
          </TouchableOpacity>
        </View>
        )}

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
                const active = barberFilter === String(b.id);
                return (
                  <TouchableOpacity
                    key={b.id}
                    style={[styles.pill, active && styles.pillActive]}
                    onPress={() => setBarberFilter(active ? "all" : String(b.id))}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>{b.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>}

      {/* Barber color legend (week mode only) */}
      {scheduleMode === "week" && !loading && barberLegend.length > 1 && sq.length < 2 && (
        <View style={styles.svcLegend}>
          {barberLegend.map((b) => (
            <View key={b.id} style={styles.svcLegendItem}>
              <View style={[styles.svcLegendDot, { backgroundColor: b.color }]} />
              <Text style={styles.svcLegendText} numberOfLines={1}>{b.name}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Month calendar grid */}
      {scheduleMode === "month" && sq.length < 2 ? (() => {
        const { weeks } = getMonthGrid(monthOffset);
        return loadingMonth ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 60 }}>
            <ActivityIndicator size="large" color={C.blue} />
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingTop: 16 }}>
            <View style={styles.monthGridHeader}>
              {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
                <Text key={d} style={styles.monthGridHeaderText}>{d}</Text>
              ))}
            </View>
            {weeks.map((week, wi) => (
              <View key={wi} style={styles.monthGridRow}>
                {week.map((day) => {
                  const isT = day.date === todayStr;
                  const dayBksAll = monthBookings[day.date] || [];
                  const dayBks = barberFilter === "all"
                    ? dayBksAll
                    : dayBksAll.filter(b => String(b.barber_id) === barberFilter);
                  const confirmed = dayBks.filter(b => b.status === "confirmed");
                  const dayRev = confirmed.reduce((s, b) => s + (b.service_price ?? b.price ?? 0), 0);
                  return (
                    <TouchableOpacity
                      key={day.date}
                      style={[
                        styles.monthCell,
                        isT && styles.monthCellToday,
                        !day.isCurrentMonth && styles.monthCellOutside,
                      ]}
                      activeOpacity={0.7}
                      onPress={() => {
                        // Navigate to that day in week mode
                        const targetDate = new Date(day.date + "T12:00:00");
                        const now = new Date();
                        const todayMonday = getMondayOfWeek(0);
                        const targetMonday = new Date(targetDate);
                        targetMonday.setDate(targetDate.getDate() - ((targetDate.getDay() + 6) % 7));
                        targetMonday.setHours(0, 0, 0, 0);
                        const diffWeeks = Math.round((targetMonday - todayMonday) / (7 * 24 * 60 * 60 * 1000));
                        const targetDayIdx = (targetDate.getDay() + 6) % 7;
                        setWeekOffset(diffWeeks);
                        setDayIdx(targetDayIdx);
                        setScheduleMode("week");
                      }}
                    >
                      <Text style={[
                        styles.monthDayNum,
                        isT && styles.monthDayNumToday,
                        !day.isCurrentMonth && styles.monthDayNumOutside,
                      ]}>{day.dayNum}</Text>
                      {confirmed.length > 0 && (
                        <View style={styles.monthCount}>
                          <Text style={styles.monthCountText}>{confirmed.length}</Text>
                        </View>
                      )}
                      {dayRev > 0 && (
                        <Text style={styles.monthRevenue}>{fmtMoney(dayRev)}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
            <View style={{ height: 32 }} />
          </ScrollView>
        );
      })() : sq.length >= 2 ? (
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
                      {b.status === "no_show" && <StatusBadge label="No-show" color={C.danger} />}
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
          onBufferPress={handleBufferPress}
          onBlockPress={handleBlockPress}
          onRefresh={() => { setRefreshing(true); load(true); }}
          refreshing={refreshing}
          date={selectedDate}
          blockedSlots={blockedSlots.filter(b => b.date === selectedDate)}
          shopHours={shopHours}
          onSwipeLeft={nextDay}
          onSwipeRight={prevDay}
          barberAvailability={barberAvail}
        />
      ) : view === "week" ? (
        <ScrollView
          style={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.ink} />}
        >
          {weekDates.map((wd, wi) => {
            const allDayBks = schedule[wd] || [];
            const dayBks = barberFilter === "all" ? allDayBks : allDayBks.filter(b => String(b.barber_id) === barberFilter);
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.ink} />}
        >
          {sortedBookings.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={40} color={C.muted} />
              <Text style={styles.emptyTitle}>No bookings</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => { setNewBookingPrefill({}); setShowNewBooking(true); }}>
                <Text style={styles.emptyBtnText}>New booking</Text>
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
                      {b.status === "no_show" && <StatusBadge label="No-show" color={C.danger} />}
                      {b.status === "cancelled" && <StatusBadge label="Cancelled" color={C.muted} />}
                      {b.status === "confirmed" && isPast && <StatusBadge label="Past" color={C.muted} />}
                    </View>
                    <Text style={[styles.listName, isCancelled && styles.listNameMuted]}>{b.customer_name}</Text>
                    <Text style={styles.listSvc} numberOfLines={1}>{b.service_name}</Text>
                    <View style={styles.listFooter}>
                      <Text style={styles.listPrice}>{fmtMoney(b.service_price ?? b.price ?? 0)}</Text>
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
        onCollectPayment={(bk) => { setShowDetail(false); setPaymentBooking(bk); setShowPayment(true); }}
      />
      <CollectPaymentModal
        booking={paymentBooking}
        visible={showPayment}
        onClose={() => { setShowPayment(false); setPaymentBooking(null); }}
        onSuccess={() => { hapticSuccess(); showToast("Payment collected"); load(true); }}
      />
      <NewBookingModal
        visible={showNewBooking}
        onClose={() => setShowNewBooking(false)}
        onSuccess={() => { hapticSuccess(); showToast("Booking confirmed"); load(true); }}
        prefillDate={newBookingPrefill.date || selectedDate}
        prefillBarberId={newBookingPrefill.barberId}
        prefillTime={newBookingPrefill.time}
        prefillName={newBookingPrefill.prefillName}
        prefillPhone={newBookingPrefill.prefillPhone}
        prefillEmail={newBookingPrefill.prefillEmail}
        staffMode={role === "staff"}
      />
      {/* Block Time Modal */}
      <Modal visible={blockModal} transparent animationType="slide">
        <View style={styles.blockOverlay}>
          <View style={styles.blockContent}>
            <Text style={styles.blockTitle}>Block time</Text>
            <Text style={styles.blockSub}>{blockInfo.barberName} · {fmtTime(blockInfo.time || "00:00")}</Text>

            <Text style={styles.blockLabel}>Duration</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {[15,30,45,60,90,120,150,180,210,240].map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.blockPill, blockDuration === d && styles.blockPillActive]}
                    onPress={() => setBlockDuration(d)}
                  >
                    <Text style={[styles.blockPillText, blockDuration === d && styles.blockPillTextActive]}>
                      {d < 60 ? `${d}m` : d % 60 === 0 ? `${d / 60}h` : `${(d / 60).toFixed(1)}h`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.blockLabel}>Reason (optional)</Text>
            <TextInput
              style={styles.blockInput}
              value={blockReason}
              onChangeText={setBlockReason}
              placeholder="e.g. Lunch, Personal, Break"
              placeholderTextColor={C.muted}
            />

            <View style={styles.blockBtns}>
              <TouchableOpacity style={styles.blockCancelBtn} onPress={() => setBlockModal(false)}>
                <Text style={styles.blockCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.blockSaveBtn, blockSaving && { opacity: 0.6 }]} onPress={submitBlock} disabled={blockSaving}>
                <Text style={styles.blockSaveText}>{blockSaving ? "Blocking…" : "Block"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Toast {...toastProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.paper },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Search
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 12, marginVertical: 8, paddingHorizontal: 12, height: 44, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.lineStrong },
  searchIcon: { fontFamily: F.regular, fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, fontFamily: F.regular, fontSize: 15, color: C.ink, paddingVertical: 8 },
  searchClear: { padding: 6 },
  searchClearText: { fontFamily: F.regular, fontSize: 14, color: C.muted },
  searchCount: { fontSize: 12, fontFamily: F.monoMedium, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 },

  dayNav: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4, paddingVertical: 8, backgroundColor: C.paper },
  navBtn: { width: 48, alignItems: "center", justifyContent: "center", paddingVertical: 4 },
  navArrow: { fontSize: 30, color: C.ink, fontFamily: F.regular, lineHeight: 34 },
  navCenter: { flex: 1, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 },
  navLabel: { fontSize: 20, fontFamily: F.regular, color: C.ink, letterSpacing: -0.4 },
  todayPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: C.blueSoft },
  todayPillText: { fontSize: 12, fontFamily: F.medium, color: C.blue },

  statsBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, gap: 10, backgroundColor: C.paper, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  statsLeft: { flexDirection: "row", alignItems: "center", flexShrink: 1 },
  stat: {},
  statVal: { fontSize: 20, fontFamily: F.regular, color: C.ink, letterSpacing: -0.3, fontVariant: ["tabular-nums"] },
  statLbl: { fontSize: 11, fontFamily: F.monoMedium, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginTop: 2 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: C.line, marginHorizontal: 14 },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: C.blue },
  newBtnText: { fontSize: 14, fontFamily: F.medium, color: C.onBlue },

  controls: { backgroundColor: C.paper, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  controlsRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 6 },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface },
  toggleBtnActive: { backgroundColor: C.blueSoft, borderColor: C.blueSoft },
  toggleBtnInner: { flexDirection: "row", alignItems: "center" },
  toggleBtnText: { fontSize: 13, fontFamily: F.medium, color: C.muted },
  toggleBtnTextActive: { color: C.blue },
  filterScroll: { paddingBottom: 10, marginTop: 12 },
  filterRow: { flexDirection: "row", gap: 6, paddingHorizontal: 10, paddingBottom: 8 },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface },
  pillActive: { backgroundColor: C.blueSoft, borderColor: C.blueSoft },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 13, fontFamily: F.regular, color: C.muted },
  pillTextActive: { color: C.blue, fontFamily: F.medium },

  list: { flex: 1, padding: 12 },
  listCard: { borderRadius: 14, padding: 12, paddingLeft: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderLeftWidth: 4, overflow: "hidden" },
  listCardCancelled: { opacity: 0.4 },
  listCardPast: { opacity: 0.55 },
  listCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 },
  listTime: { fontSize: 12, fontFamily: F.mono, color: C.muted, fontVariant: ["tabular-nums"] },
  listName: { fontSize: 16, fontFamily: F.medium, color: C.ink, marginBottom: 1 },
  listNameMuted: { color: C.muted, textDecorationLine: "line-through" },
  listSvc: { fontFamily: F.regular, fontSize: 14, color: C.muted, marginBottom: 4 },
  listFooter: { flexDirection: "row", alignItems: "center" },
  listPrice: { fontSize: 14, fontFamily: F.medium, color: C.ink, fontVariant: ["tabular-nums"] },
  listMeta: { fontFamily: F.regular, fontSize: 13, color: C.muted },

  // Service legend
  svcLegend: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: C.paper },
  svcLegendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  svcLegendDot: { width: 10, height: 10, borderRadius: 3 },
  svcLegendText: { fontSize: 12, fontFamily: F.regular, color: C.muted },

  // Week view
  weekRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.line,
  },
  weekRowActive: { backgroundColor: C.blueSoft },
  weekLeft: { width: 56 },
  weekDay: { fontSize: 15, fontFamily: F.medium, color: C.ink },
  weekDate: { fontFamily: F.regular, fontSize: 13, color: C.muted, marginTop: 1 },
  weekDayToday: { color: C.blue },
  weekRight: { flex: 1 },
  weekBarTrack: {
    height: 6, backgroundColor: C.line, borderRadius: 3,
    overflow: "hidden", marginBottom: 6,
  },
  weekBarFill: { height: 6, backgroundColor: C.blue, borderRadius: 3 },
  weekStats: { flexDirection: "row", justifyContent: "space-between" },
  weekCount: { fontSize: 12, fontFamily: F.semibold, color: C.ink },
  weekRev: { fontSize: 12, fontFamily: F.semibold, color: C.blue },
  weekClosed: { flex: 1, fontFamily: F.regular, fontSize: 12, color: C.muted, fontStyle: "italic" },

  // Block modal
  blockOverlay: { flex: 1, backgroundColor: "rgba(14,14,12,0.45)", justifyContent: "flex-end" },
  blockContent: { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  blockTitle: { fontSize: 24, fontFamily: F.regular, color: C.ink, letterSpacing: -0.5, marginBottom: 2 },
  blockSub: { fontFamily: F.regular, fontSize: 13, color: C.muted, marginBottom: 18 },
  blockLabel: { fontSize: 14, fontFamily: F.medium, color: C.ink, marginBottom: 8 },
  blockPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface },
  blockPillActive: { backgroundColor: C.blue, borderColor: C.blue },
  blockPillText: { fontSize: 13, fontFamily: F.semibold, color: C.muted },
  blockPillTextActive: { color: C.onBlue },
  blockInput: { backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 12, height: 44, fontFamily: F.regular, fontSize: 15, color: C.ink, borderWidth: 1, borderColor: C.lineStrong, marginBottom: 20 },
  blockBtns: { flexDirection: "row", gap: 10 },
  blockCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: C.line, alignItems: "center" },
  blockCancelText: { fontSize: 14, fontFamily: F.semibold, color: C.muted },
  blockSaveBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: C.blue, alignItems: "center" },
  blockSaveText: { fontSize: 14, fontFamily: F.semibold, color: C.paper },

  // Schedule mode toggle
  modeToggleRow: { flexDirection: "row", backgroundColor: C.sunk, borderRadius: 12, padding: 3 },
  modeToggleBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 9 },
  modeToggleBtnActive: { backgroundColor: C.surface },
  modeToggleText: { fontSize: 14, fontFamily: F.medium, color: C.muted },
  modeToggleTextActive: { color: C.ink },

  // Month nav
  monthNav: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4, paddingVertical: 8, backgroundColor: C.paper },

  // Month grid
  monthGridHeader: { flexDirection: "row", marginBottom: 4 },
  monthGridHeaderText: {
    flex: 1, textAlign: "center", fontSize: 11, fontFamily: F.monoMedium,
    color: C.muted, textTransform: "uppercase", letterSpacing: 1, paddingVertical: 6,
  },
  monthGridRow: { flexDirection: "row" },
  monthCell: {
    flex: 1, minHeight: 72, padding: 6,
    borderWidth: 0.5, borderColor: C.line, borderRadius: 6,
    backgroundColor: C.surface, margin: 1,
  },
  monthCellToday: { backgroundColor: C.blue + "18", borderColor: C.blue + "60" },
  monthCellOutside: { backgroundColor: C.sunk, opacity: 0.5 },
  monthDayNum: { fontSize: 16, fontFamily: F.semibold, color: C.ink, marginBottom: 2 },
  monthDayNumToday: { color: C.blue },
  monthDayNumOutside: { color: C.muted },
  monthCount: {
    alignSelf: "flex-start", paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: 6, backgroundColor: C.blue + "20", marginBottom: 2,
  },
  monthCountText: { fontSize: 11, fontFamily: F.semibold, color: C.blue },
  monthRevenue: { fontSize: 11, fontFamily: F.semibold, color: C.muted },

  empty: { paddingTop: 60, alignItems: "center", gap: 10 },
  emptyIcon: {},
  emptyTitle: { fontSize: 17, fontFamily: F.regular, color: C.muted },
  emptyBtn: { marginTop: 4, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: C.blue, borderRadius: 12 },
  emptyBtnText: { fontSize: 15, fontFamily: F.medium, color: C.onBlue },
});
