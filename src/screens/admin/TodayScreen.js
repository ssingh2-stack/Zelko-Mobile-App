import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Alert, ActivityIndicator, Modal, TextInput, Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { api, WALKIN_EMAIL } from "../../lib/api";
import { F, C, fmtMoney, CLIENT_TAGS } from "../../lib/theme";
import { light as hapticLight, success as hapticSuccess, warn as hapticWarn } from "../../lib/haptics";
import { useToast, Toast } from "../../components/Toast";
import Header from "../../components/Header";
import VerifyEmailBanner from "../../components/VerifyEmailBanner";
import BookingDetailModal from "../../components/BookingDetailModal";
import CollectPaymentModal from "../../components/CollectPaymentModal";
import NewBookingModal from "../../components/NewBookingModal";
import { useRole } from "../../lib/RoleContext";
import DayCalendarView, {
  DCAL_COLORS, PX_PER_HOUR, OPEN_HOUR, CLOSE_HOUR, TOTAL_H,
  tMin, fmtTime, pxToTimeStr, getNowTop, isNowVisible,
} from "../../components/DayCalendarView";
import NextUpCard from "../../components/NextUpCard";
import SwipeableCard from "../../components/SwipeableCard";
import { SkeletonCalendar, SkeletonList } from "../../components/Skeleton";
import ErrorState from "../../components/ErrorState";
import SetupNudge from "../../components/SetupNudge";
import { getCached, setCache } from "../../lib/cache";

function clientTagStyle(tag) {
  const t = CLIENT_TAGS[tag] || CLIENT_TAGS.regular;
  return { backgroundColor: t.bg, borderColor: t.border, color: t.text, label: t.label };
}

export default function TodayScreen() {
  const navigation = useNavigation();
  const { role } = useRole();
  const [data, setData] = useState(null);
  const [allBarbers, setAllBarbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState("cal");
  const [barberFilter, setBarberFilter] = useState("all");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentBooking, setPaymentBooking] = useState(null);
  const [newBookingPrefill, setNewBookingPrefill] = useState({});
  const [nowTop, setNowTop] = useState(getNowTop);
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [shopHours, setShopHours] = useState(null);
  const [clientNotes, setClientNotes] = useState({});
  const [clientTags, setClientTags] = useState({});
  const [barberAvail, setBarberAvail] = useState({});
  const [error, setError] = useState(null);
  const [trialExpired, setTrialExpired] = useState(false);
  const [trialUpgradeUrl, setTrialUpgradeUrl] = useState("https://zelko.ca/pricing");
  const [blockModal, setBlockModal] = useState(false);
  const [blockInfo, setBlockInfo] = useState({});
  const [blockDuration, setBlockDuration] = useState(30);
  const [blockReason, setBlockReason] = useState("");
  const [blockSaving, setBlockSaving] = useState(false);
  const calScrollRef = useRef(null);
  const { showToast, toastProps } = useToast();

  useEffect(() => {
    AsyncStorage.getItem("dcal_view").then(v => { if (v) setView(v); });
  }, []);

  function setViewMode(mode) {
    setView(mode);
    AsyncStorage.setItem("dcal_view", mode);
  }

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    // Show cached data immediately
    if (!quiet && !data) {
      const cached = await getCached("today");
      if (cached?.data) {
        setData(cached.data.res);
        setAllBarbers(cached.data.barbers);
        setBlockedSlots(cached.data.blocked);
        if (cached.data.shopHours) setShopHours(cached.data.shopHours);
      }
    }
    try {
      const [res, bs, blocked, settings] = await Promise.all([
        api.adminToday(),
        api.adminBarbers(),
        api.adminBlocked().catch(() => []),
        api.adminSettings().catch(() => ({})),
      ]);
      const barbers = (bs || []).map(b => ({ id: b.id, name: b.name }));
      const allBlocked = Array.isArray(blocked) ? blocked : (blocked?.blocked || []);
      const _n = new Date();
      const _todayLocal = `${_n.getFullYear()}-${String(_n.getMonth()+1).padStart(2,"0")}-${String(_n.getDate()).padStart(2,"0")}`;
      const todayBlocked = allBlocked.filter(b => b.date === _todayLocal);
      setData(res);
      setAllBarbers(barbers);
      setBlockedSlots(todayBlocked);
      if (settings?.hours) setShopHours(settings.hours);
      setError(null);
      // Cache for offline use
      setCache("today", { res, barbers, blocked: todayBlocked, shopHours: settings?.hours });
      // Load barber availability (non-blocking)
      Promise.all(barbers.map(b => api.adminBarberAvailability(b.id).then(a => [b.id, a]).catch(() => [b.id, []]))).then(pairs => {
        const map = {};
        pairs.forEach(([id, a]) => { map[id] = a || []; });
        setBarberAvail(map);
      }).catch(() => {});
      // Load client tags (non-blocking)
      api.adminClients().then(cl => {
        const list = Array.isArray(cl) ? cl : (cl?.clients || []);
        const tagMap = {};
        list.forEach(c => { if (c.email && c.tags?.[0]) tagMap[c.email] = c.tags[0]; });
        setClientTags(tagMap);
      }).catch(() => {});
      // Load client notes (non-blocking)
      const emails = [...new Set((res?.bookings || []).map(b => b.customer_email).filter(Boolean))];
      if (emails.length > 0 && emails.length <= 30) {
        Promise.all(emails.map(e => api.adminClientNotes(e).then(n => [e, n?.notes || n || ""]).catch(() => [e, ""]))).then(pairs => {
          const map = {};
          pairs.forEach(([e, n]) => { if (n) map[e] = typeof n === "string" ? n : ""; });
          setClientNotes(map);
        });
      }
    }
    catch (err) {
      if (err.trialExpired) {
        setTrialExpired(true);
        if (err.upgradeUrl) setTrialUpgradeUrl(err.upgradeUrl);
      } else if (!data) setError(err.message);
    }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  // Refresh when tab comes into focus
  useFocusEffect(useCallback(() => { load(true); }, [load]));

  useEffect(() => {
    const timer = setInterval(() => setNowTop(getNowTop()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (data && view === "cal" && isNowVisible() && calScrollRef.current) {
      setTimeout(() => {
        calScrollRef.current?.scrollTo({ y: Math.max(0, nowTop - PX_PER_HOUR * 1.5), animated: true });
      }, 300);
    }
  }, [data, view]);

  const bookings = data?.bookings || [];
  // Barber legend: stable color per barber by index in allBarbers list
  const barberLegend = (allBarbers || []).map((b, i) => ({
    id: b.id, name: b.name, color: DCAL_COLORS[i % DCAL_COLORS.length].bd,
  }));
  const confirmed = bookings.filter(b => b.status === "confirmed");
  const revenue = confirmed.reduce((sum, b) => sum + (b.service_price ?? b.price ?? 0), 0);
  const noShows = bookings.filter(b => b.status === "no_show").length;
  const filteredBarbers = barberFilter === "all" ? allBarbers : allBarbers.filter(b => String(b.id) === barberFilter);

  // Occupancy: sum of confirmed booking durations / (open hours * 60 * barber count)
  const totalCapMin = TOTAL_H * 60 * Math.max(allBarbers.length, 1);
  const bookedMin = confirmed.reduce((s, b) => s + (b.duration_min || 30), 0);
  const occupancy = Math.min(1, bookedMin / totalCapMin);

  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" });
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const cancelled = bookings.filter(b => b.status === "cancelled").length;

  // End-of-day: show summary if past shop close or past 8pm
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayDayName = DAY_NAMES[today.getDay()];
  const todayHours = shopHours?.[todayDayName];
  const shopCloseMin = todayHours?.close_time ? tMin(todayHours.close_time) : 19 * 60;
  const currentMin = today.getHours() * 60 + today.getMinutes();
  const showEOD = !loading && confirmed.length > 0 && currentMin >= shopCloseMin;

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

  async function handleQuickWalkIn() {
    // 1-tap walk-in: pick the first barber (or current filter), default service, first available slot
    if (!allBarbers || allBarbers.length === 0) {
      Alert.alert("No barbers", "Add a barber before creating a walk-in.");
      return;
    }
    const barber = barberFilter !== "all"
      ? allBarbers.find(b => String(b.id) === barberFilter) || allBarbers[0]
      : allBarbers[0];
    try {
      const services = await api.adminServices();
      if (!services || services.length === 0) {
        Alert.alert("No services", "Add a service before creating a walk-in.");
        return;
      }
      const service = services[0];
      // Fetch actual available slots instead of guessing the next 15-min mark
      const slots = await api.adminSlots(todayStr, barber.id, service.id);
      const slotList = Array.isArray(slots) ? slots : (slots?.slots || []);
      if (!slotList.length) {
        Alert.alert("No slots available", "No open slots today for this barber. Try the + New flow to pick a different barber or date.");
        return;
      }
      // Pick the first available slot (closest to now)
      const time = slotList[0].time;
      await api.adminCreateBooking({
        barber_id: barber.id,
        service_id: service.id,
        date: todayStr,
        start_time: time,
        customer_name: "Walk-in",
        customer_email: WALKIN_EMAIL,
        customer_phone: "",
      });
      hapticSuccess();
      showToast(`Walk-in added for ${barber.name} at ${time}`);
      load(true);
    } catch (err) {
      Alert.alert("Couldn't create walk-in", err.message || "That slot may be taken — try the + New flow.");
    }
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
        { text: "Extend +15 min", onPress: async () => {
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
        barber_id: blockInfo.barberId, date: todayStr, all_day: false,
        start_time: blockInfo.time, end_time: endTime,
        reason: blockReason.trim() || "Blocked",
      });
      hapticSuccess(); showToast("Time blocked");
      setBlockModal(false);
      load(true);
    } catch (err) { Alert.alert("Error", err.message); }
    setBlockSaving(false);
  }

  // Sorted bookings for list view: upcoming first, then past
  const nowMin = today.getHours() * 60 + today.getMinutes();
  const sortedBookings = [...bookings]
    .filter(b => barberFilter === "all" || String(b.barber_id) === barberFilter)
    .sort((a, b) => tMin(a.start_time) - tMin(b.start_time));

  if (trialExpired) {
    return (
      <View style={styles.container}>
        <Header />
        <View style={styles.trialExpiredContainer}>
          <View style={styles.trialExpiredIcon}><Ionicons name="lock-closed-outline" size={26} color={C.blue} /></View>
          <Text style={styles.trialExpiredTitle}>Your free trial has ended</Text>
          <Text style={styles.trialExpiredMsg}>
            Pick a plan to keep your bookings, clients and schedule running. Everything you set up is still here.
          </Text>
          <Text style={[styles.trialExpiredNote, { marginBottom: 20 }]}>
            Essentials, up to 3 barbers: $29/month{"\n"}Pro, unlimited barbers: $49/month
          </Text>
          <TouchableOpacity
            style={styles.trialExpiredBtn}
            onPress={() => Linking.openURL(trialUpgradeUrl)}
          >
            <Text style={styles.trialExpiredBtnText}>See plans</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header />
      <VerifyEmailBanner />

      {/* Today: the day's numbers (brand/components/StatCards) */}
      <View style={styles.strip}>
        <Text style={styles.stripLabel}>Today</Text>
        <Text style={styles.stripDate}>{dateLabel}</Text>
        <View style={styles.statsGroup}>
          <View style={[styles.stat, styles.statNight]}>
            <Text style={[styles.statLbl, styles.statLblNight]}>Revenue</Text>
            <Text style={[styles.statVal, styles.statValNight]} numberOfLines={1} adjustsFontSizeToFit>{fmtMoney(revenue)}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLbl}>Bookings</Text>
            <Text style={styles.statVal}>{confirmed.length}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLbl}>No-shows</Text>
            <Text style={styles.statVal}>{noShows}</Text>
          </View>
        </View>
        {/* Payment breakdown */}
        {confirmed.length > 0 && (() => {
          const cashPaid = confirmed.filter(b => b.payment_status === "cash_paid");
          const cardPaid = confirmed.filter(b => b.payment_status === "paid" || b.payment_status === "card_paid");
          const depositPaid = confirmed.filter(b => b.payment_status === "deposit_paid");
          const unpaid = confirmed.filter(b => !b.payment_status || b.payment_status === "unpaid");
          const cashTotal = cashPaid.reduce((s, b) => s + (b.amount_paid ? b.amount_paid / 100 : (b.service_price || 0)), 0);
          const cardTotal = cardPaid.reduce((s, b) => s + (b.amount_paid ? b.amount_paid / 100 : (b.service_price || 0)), 0);
          const parts = [];
          if (cardPaid.length) parts.push(`Card ${fmtMoney(cardTotal)}`);
          if (cashPaid.length) parts.push(`Cash ${fmtMoney(cashTotal)}`);
          if (depositPaid.length) parts.push(`${depositPaid.length} deposit${depositPaid.length !== 1 ? "s" : ""} held`);
          if (unpaid.length) parts.push(`${unpaid.length} to collect`);
          return <Text style={styles.paymentBreakdown}>{parts.join("  ·  ")}</Text>;
        })()}
        {/* Occupancy bar */}
        <View style={styles.occRow}>
          <View style={styles.occTrack}>
            <View style={[styles.occFill, { width: `${Math.round(occupancy * 100)}%` }]} />
          </View>
          <Text style={styles.occLabel}>{Math.round(occupancy * 100)}% booked</Text>
        </View>
      </View>

      {/* Setup nudge */}
      {!loading && <SetupNudge navigation={navigation} />}

      {/* Next Up */}
      {!loading && !showEOD && <NextUpCard bookings={bookings} onPress={openDetail} />}

      {/* End-of-day summary */}
      {showEOD && (
        <View style={styles.eodCard}>
          <Text style={styles.eodTitle}>End of day</Text>
          <View style={styles.eodGrid}>
            <View style={styles.eodStat}>
              <Text style={styles.eodStatVal}>{confirmed.length}</Text>
              <Text style={styles.eodStatLbl}>Completed</Text>
            </View>
            <View style={styles.eodStat}>
              <Text style={styles.eodStatVal}>{fmtMoney(revenue)}</Text>
              <Text style={styles.eodStatLbl}>Revenue</Text>
            </View>
            <View style={styles.eodStat}>
              <Text style={styles.eodStatVal}>{noShows}</Text>
              <Text style={styles.eodStatLbl}>No-shows</Text>
            </View>
            <View style={styles.eodStat}>
              <Text style={[styles.eodStatVal, cancelled > 0 && { color: C.danger }]}>{cancelled}</Text>
              <Text style={styles.eodStatLbl}>Cancelled</Text>
            </View>
          </View>
          {/* Cash & Card Summary */}
          {(() => {
            const cashBookings = confirmed.filter(b => b.payment_status === "cash_paid");
            const cardBookings = confirmed.filter(b => b.payment_status === "paid" || b.payment_status === "card_paid");
            const cashTotal = cashBookings.reduce((s, b) => s + (b.amount_paid ? b.amount_paid / 100 : (b.service_price || b.price || 0)), 0);
            const cardTotal = cardBookings.reduce((s, b) => s + (b.amount_paid ? b.amount_paid / 100 : (b.service_price || b.price || 0)), 0);
            return (cashBookings.length > 0 || cardBookings.length > 0) ? (
              <View style={styles.eodCashRow}>
                {cashBookings.length > 0 && (
                  <Text style={styles.eodCashText}>
                    Cash in register: {fmtMoney(cashTotal)} across {cashBookings.length} payment{cashBookings.length !== 1 ? "s" : ""}
                  </Text>
                )}
                {cardBookings.length > 0 && (
                  <Text style={styles.eodCashText}>
                    Card collected: {fmtMoney(cardTotal)} across {cardBookings.length} payment{cardBookings.length !== 1 ? "s" : ""}
                  </Text>
                )}
              </View>
            ) : null;
          })()}
          <Text style={styles.eodOcc}>{Math.round(occupancy * 100)}% of chair time booked today</Text>
        </View>
      )}

      {/* Controls row */}
      <View style={styles.controls}>
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, view === "cal" && styles.toggleBtnActive]}
            onPress={() => setViewMode("cal")}
          >
            <View style={styles.toggleBtnInner}><Ionicons name="calendar-outline" size={14} color={view === "cal" ? C.blue : C.muted} /><Text style={[styles.toggleBtnText, view === "cal" && styles.toggleBtnTextActive]}> Calendar</Text></View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, view === "list" && styles.toggleBtnActive]}
            onPress={() => setViewMode("list")}
          >
            <View style={styles.toggleBtnInner}><Ionicons name="menu" size={14} color={view === "list" ? C.blue : C.muted} /><Text style={[styles.toggleBtnText, view === "list" && styles.toggleBtnTextActive]}> List</Text></View>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            style={styles.walkInBtn}
            onPress={handleQuickWalkIn}
            onLongPress={() => { setNewBookingPrefill({ walkin: true }); setShowNewBooking(true); }}
            delayLongPress={400}
          >
            <Text style={styles.walkInBtnText}>Walk-in</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.newBtn} onPress={() => { setNewBookingPrefill({}); setShowNewBooking(true); }}>
            <Text style={styles.newBtnText}>New booking</Text>
          </TouchableOpacity>
        </View>

        {/* Barber filter */}
        {allBarbers.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.pill, barberFilter === "all" && styles.pillActive]}
                onPress={() => setBarberFilter("all")}
              >
                <Text style={[styles.pillText, barberFilter === "all" && styles.pillTextActive]}>All</Text>
              </TouchableOpacity>
              {allBarbers.map((b) => {
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
      </View>

      {/* Barber color legend */}
      {!loading && barberLegend.length > 1 && (
        <View style={styles.svcLegend}>
          {barberLegend.map((b) => (
            <View key={b.id} style={styles.svcLegendItem}>
              <View style={[styles.svcLegendDot, { backgroundColor: b.color }]} />
              <Text style={styles.svcLegendText} numberOfLines={1}>{b.name}</Text>
            </View>
          ))}
        </View>
      )}

      {error && !data ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : loading ? (
        <View style={{ flex: 1, padding: 12 }}>{view === "cal" ? <SkeletonCalendar /> : <SkeletonList count={5} />}</View>
      ) : view === "cal" ? (
        <DayCalendarView
          bookings={bookings}
          barbers={filteredBarbers}
          allBarbers={allBarbers}
          nowTop={nowTop}
          scrollRef={calScrollRef}
          onBookingPress={openDetail}
          onSlotPress={handleSlotTap}
          onBufferPress={handleBufferPress}
          onBlockPress={handleBlockPress}
          onRefresh={() => { setRefreshing(true); load(true); }}
          refreshing={refreshing}
          date={todayStr}
          blockedSlots={blockedSlots}
          shopHours={shopHours}
          clientNotes={clientNotes}
          barberAvailability={barberAvail}
        />
      ) : (
        <ScrollView
          style={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.ink} />}
        >
          {sortedBookings.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={40} color={C.muted} />
              <Text style={styles.emptyTitle}>No bookings yet today.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => { setNewBookingPrefill({ date: todayStr }); setShowNewBooking(true); }}>
                <Text style={styles.emptyBtnText}>New booking</Text>
              </TouchableOpacity>
            </View>
          ) : (
            sortedBookings.map((b) => {
              const barberIdx = allBarbers.findIndex(ab => ab.id === b.barber_id);
              const c = DCAL_COLORS[barberIdx % DCAL_COLORS.length] || DCAL_COLORS[0];
              const isCancelled = b.status === "cancelled" || b.status === "no_show";
              const endMin = b.end_time ? tMin(b.end_time) : tMin(b.start_time) + (b.duration_min || 30);
              const isPast = endMin < nowMin;

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
                      { borderLeftColor: c.bd },
                      isCancelled && styles.listCardCancelled,
                      isPast && !isCancelled && styles.listCardPast,
                    ]}
                    onPress={() => openDetail(b)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.listCardHeader}>
                      <Text style={styles.listTime}>{fmtTime(b.start_time)} – {fmtTime(b.end_time)}</Text>
                      {b.status === "no_show" && <StatusBadge label="No-show" color={C.danger} />}
                      {b.status === "cancelled" && <StatusBadge label="Cancelled" color={C.muted} />}
                      {b.status === "confirmed" && isPast && <StatusBadge label="Past" color={C.muted} />}
                    </View>
                    <View style={styles.listNameRow}>
                      <Text style={[styles.listName, isCancelled && styles.listNameMuted]}>{b.customer_name}</Text>
                      {clientTags[b.customer_email] && (
                        <View style={[styles.clientTag, clientTagStyle(clientTags[b.customer_email])]}>
                          <Text style={[styles.clientTagText, { color: clientTagStyle(clientTags[b.customer_email]).color }]}>
                            {clientTagStyle(clientTags[b.customer_email]).label}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.listSvc} numberOfLines={1}>{b.service_name}</Text>
                    {clientNotes[b.customer_email] ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginBottom: 4, overflow: "hidden" }}>
                        <Ionicons name="document-text-outline" size={10} color={C.blue} style={{ flexShrink: 0 }} />
                        <Text style={styles.listNote} numberOfLines={1}>{clientNotes[b.customer_email]}</Text>
                      </View>
                    ) : null}
                    <View style={styles.listFooter}>
                      <Text style={styles.listPrice}>{fmtMoney(b.service_price ?? b.price ?? 0)}</Text>
                      {b.duration_min ? <Text style={styles.listMeta}> · {b.duration_min}min</Text> : null}
                      {b.barber_name ? <Text style={styles.listMeta}> · {b.barber_name}</Text> : null}
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
        onClose={() => setShowPayment(false)}
        onSuccess={() => { showToast("Payment collected"); load(true); }}
      />
      <NewBookingModal
        visible={showNewBooking}
        onClose={() => setShowNewBooking(false)}
        onSuccess={() => { hapticSuccess(); showToast("Booking confirmed"); load(true); }}
        prefillDate={newBookingPrefill.date || todayStr}
        prefillBarberId={newBookingPrefill.barberId}
        prefillTime={newBookingPrefill.time}
        startAsWalkin={newBookingPrefill.walkin}
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
              placeholder="Lunch"
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

// Word first, colour second (brand/components/StatusBadge).
function StatusBadge({ label, color }) {
  const tone = color === C.danger
    ? { backgroundColor: C.surface, borderColor: C.line, color: C.danger }
    : { backgroundColor: C.sunk, borderColor: C.sunk, color: C.muted };
  return (
    <View style={[badgeStyles.badge, { backgroundColor: tone.backgroundColor, borderColor: tone.borderColor }]}>
      <Text style={[badgeStyles.text, { color: tone.color }]}>{label}</Text>
    </View>
  );
}
const badgeStyles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  text: { fontSize: 12, fontFamily: F.medium },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.paper },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Trial expired
  trialExpiredContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  trialExpiredIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: C.blueSoft, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  trialExpiredTitle: { fontSize: 28, fontFamily: F.regular, color: C.ink, letterSpacing: -0.7, marginBottom: 10, textAlign: "center" },
  trialExpiredMsg: { fontFamily: F.regular, fontSize: 15, color: C.muted, lineHeight: 22, textAlign: "center", marginBottom: 28 },
  trialExpiredBtn: { backgroundColor: C.blue, paddingVertical: 16, paddingHorizontal: 40, borderRadius: 12, marginBottom: 16 },
  trialExpiredBtnText: { color: C.onBlue, fontSize: 16, fontFamily: F.medium },
  trialExpiredNote: { fontFamily: F.regular, fontSize: 12, color: C.muted, textAlign: "center" },

  // Strip
  strip: { backgroundColor: C.paper, paddingHorizontal: 16, paddingBottom: 14, paddingTop: 2 },
  stripLabel: { fontSize: 12, fontFamily: F.monoMedium, color: C.muted, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 2 },
  stripDate: { fontSize: 28, fontFamily: F.regular, color: C.ink, letterSpacing: -0.8, marginBottom: 14 },
  statsGroup: { flexDirection: "row", gap: 8, marginBottom: 10 },
  stat: { flex: 1, backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 12 },
  statVal: { fontSize: 24, fontFamily: F.regular, color: C.ink, letterSpacing: -0.5, marginTop: 6, fontVariant: ["tabular-nums"] },
  statLbl: { fontSize: 11, fontFamily: F.monoMedium, color: C.muted, textTransform: "uppercase", letterSpacing: 1 },
  statNight: { flex: 1.4, backgroundColor: C.night, borderColor: C.night },
  statLblNight: { color: C.nightMuted },
  statValNight: { color: C.onNight },
  statDivider: { display: "none" },

  // Occupancy bar
  paymentBreakdown: { fontSize: 13, fontFamily: F.regular, color: C.muted, marginBottom: 8 },
  occRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  occTrack: { flex: 1, height: 6, backgroundColor: C.sunk, borderRadius: 3, overflow: "hidden" },
  occFill: { height: 6, backgroundColor: C.blue, borderRadius: 3, minWidth: 6 },
  occLabel: { fontSize: 13, fontFamily: F.medium, color: C.ink, width: 84, textAlign: "right", fontVariant: ["tabular-nums"] },

  // Service legend
  svcLegend: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: C.paper },
  svcLegendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  svcLegendDot: { width: 10, height: 10, borderRadius: 3 },
  svcLegendText: { fontSize: 12, fontFamily: F.regular, color: C.muted },

  // End-of-day summary
  eodCard: { marginHorizontal: 12, marginBottom: 8, backgroundColor: C.night, borderRadius: 16, padding: 16 },
  eodTitle: { fontSize: 20, fontFamily: F.regular, color: C.onNight, letterSpacing: -0.4, marginBottom: 12 },
  eodGrid: {
    flexDirection: "row", justifyContent: "space-between", marginBottom: 12,
  },
  eodStat: { alignItems: "center", flex: 1 },
  eodStatVal: { fontSize: 22, fontFamily: F.regular, color: C.onNight, marginBottom: 2, fontVariant: ["tabular-nums"] },
  eodStatLbl: { fontSize: 11, fontFamily: F.mono, color: C.nightMuted, textTransform: "uppercase", letterSpacing: 1 },
  eodCashRow: { marginBottom: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(243,241,236,0.15)" },
  eodCashText: { fontSize: 13, fontFamily: F.regular, color: C.onNight, marginBottom: 4 },
  eodOcc: { fontSize: 12, fontFamily: F.regular, color: C.nightMuted, textAlign: "center" },

  // Controls
  controls: { backgroundColor: C.paper, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  controlsRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface },
  toggleBtnActive: { backgroundColor: C.blueSoft, borderColor: C.blueSoft },
  toggleBtnInner: { flexDirection: "row", alignItems: "center" },
  toggleBtnText: { fontSize: 13, fontFamily: F.medium, color: C.muted },
  toggleBtnTextActive: { color: C.blue },
  walkInBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.surface },
  walkInBtnText: { fontSize: 13, fontFamily: F.medium, color: C.ink },
  newBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: C.blue },
  newBtnText: { fontSize: 13, fontFamily: F.medium, color: C.onBlue },
  filterScroll: { paddingBottom: 10 },
  filterRow: { flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingBottom: 2 },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface },
  pillActive: { backgroundColor: C.blueSoft, borderColor: C.blueSoft },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 13, fontFamily: F.regular, color: C.muted },
  pillTextActive: { color: C.blue, fontFamily: F.medium },

  // List view
  list: { flex: 1, padding: 12 },
  listCard: { borderRadius: 14, padding: 12, paddingLeft: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderLeftWidth: 4, overflow: "hidden" },
  listCardCancelled: { opacity: 0.4 },
  listCardPast: { opacity: 0.55 },
  listCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 },
  listTime: { fontSize: 12, fontFamily: F.mono, color: C.muted, fontVariant: ["tabular-nums"] },
  listNameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 1 },
  listName: { fontSize: 16, fontFamily: F.medium, color: C.ink },
  clientTag: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 999, borderWidth: 1 },
  clientTagText: { fontSize: 11, fontFamily: F.medium },
  listNameMuted: { color: C.muted, textDecorationLine: "line-through" },
  listSvc: { fontFamily: F.regular, fontSize: 14, color: C.muted, marginBottom: 4 },
  listNote: { fontFamily: F.regular, fontSize: 12, color: C.muted, flex: 1 },
  listFooter: { flexDirection: "row", alignItems: "center" },
  listPrice: { fontSize: 14, fontFamily: F.medium, color: C.ink, fontVariant: ["tabular-nums"] },
  listMeta: { fontFamily: F.regular, fontSize: 13, color: C.muted },

  // Block modal
  blockOverlay: { flex: 1, backgroundColor: "rgba(14,14,12,0.45)", justifyContent: "flex-end" },
  blockContent: { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  blockTitle: { fontSize: 24, fontFamily: F.regular, color: C.ink, letterSpacing: -0.5, marginBottom: 2 },
  blockSub: { fontFamily: F.regular, fontSize: 13, color: C.muted, marginBottom: 18 },
  blockLabel: { fontSize: 14, fontFamily: F.medium, color: C.ink, marginBottom: 8 },
  blockPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.surface },
  blockPillActive: { backgroundColor: C.blue, borderColor: C.blue },
  blockPillText: { fontSize: 14, fontFamily: F.medium, color: C.ink },
  blockPillTextActive: { color: C.onBlue },
  blockInput: { backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 12, height: 44, fontFamily: F.regular, fontSize: 15, color: C.ink, borderWidth: 1, borderColor: C.lineStrong, marginBottom: 20 },
  blockBtns: { flexDirection: "row", gap: 10 },
  blockCancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: C.lineStrong, alignItems: "center" },
  blockCancelText: { fontSize: 15, fontFamily: F.medium, color: C.ink },
  blockSaveBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: C.blue, alignItems: "center" },
  blockSaveText: { fontSize: 15, fontFamily: F.medium, color: C.onBlue },

  // Empty
  empty: { paddingTop: 60, alignItems: "center", gap: 10 },
  emptyIcon: {},
  emptyTitle: { fontSize: 17, fontFamily: F.regular, color: C.muted },
  emptyBtn: { marginTop: 4, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: C.blue, borderRadius: 12 },
  emptyBtnText: { fontSize: 15, fontFamily: F.medium, color: C.onBlue },
});
