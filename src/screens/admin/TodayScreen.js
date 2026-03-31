import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Alert, ActivityIndicator, Modal, TextInput, Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { C, serif, fmtMoney } from "../../lib/theme";
import { light as hapticLight, success as hapticSuccess, warn as hapticWarn } from "../../lib/haptics";
import { useToast, Toast } from "../../components/Toast";
import Header from "../../components/Header";
import BookingDetailModal from "../../components/BookingDetailModal";
import NewBookingModal from "../../components/NewBookingModal";
import DayCalendarView, {
  DCAL_COLORS, PX_PER_HOUR, OPEN_HOUR, CLOSE_HOUR, TOTAL_H,
  tMin, fmtTime, pxToTimeStr, getNowTop, isNowVisible, buildServiceColorMap,
} from "../../components/DayCalendarView";
import NextUpCard from "../../components/NextUpCard";
import SwipeableCard from "../../components/SwipeableCard";
import { SkeletonCalendar, SkeletonList } from "../../components/Skeleton";
import ErrorState from "../../components/ErrorState";
import SetupNudge from "../../components/SetupNudge";
import { getCached, setCache } from "../../lib/cache";

const CLIENT_TAG_STYLES = {
  vip:     { backgroundColor: "#FEF3C7", borderColor: "#FDE68A", color: "#92400E" },
  new:     { backgroundColor: "#D1FAE5", borderColor: "#6EE7B7", color: "#065F46" },
  regular: { backgroundColor: "#EDE9FE", borderColor: "#C4B5FD", color: "#5B21B6" },
  lapsed:  { backgroundColor: "#F3F4F6", borderColor: "#D1D5DB", color: "#6B7280" },
};
function clientTagStyle(tag) { return CLIENT_TAG_STYLES[tag] || CLIENT_TAG_STYLES.regular; }

export default function TodayScreen() {
  const navigation = useNavigation();
  const [data, setData] = useState(null);
  const [allBarbers, setAllBarbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState("cal");
  const [barberFilter, setBarberFilter] = useState("all");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [newBookingPrefill, setNewBookingPrefill] = useState({});
  const [nowTop, setNowTop] = useState(getNowTop);
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [shopHours, setShopHours] = useState(null);
  const [clientNotes, setClientNotes] = useState({});
  const [clientTags, setClientTags] = useState({});
  const [barberAvail, setBarberAvail] = useState({});
  const [error, setError] = useState(null);
  const [trialExpired, setTrialExpired] = useState(false);
  const [trialUpgradeUrl, setTrialUpgradeUrl] = useState("https://getclipd.ca/pricing");
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
      const todayBlocked = allBlocked.filter(b => b.date === new Date().toISOString().split("T")[0]);
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
  const serviceColorMap = buildServiceColorMap(bookings);
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
  const todayStr = today.toISOString().split("T")[0];
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
      { text: "New Booking", onPress: () => {
        setNewBookingPrefill({ barberId: String(barberId), time });
        setShowNewBooking(true);
      }},
      { text: "Block Time", onPress: () => {
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
          <Text style={styles.trialExpiredIcon}>&#128274;</Text>
          <Text style={styles.trialExpiredTitle}>Your free trial has ended</Text>
          <Text style={styles.trialExpiredMsg}>
            Your 14-day trial is over. Subscribe to keep managing your bookings, clients, and schedule.
          </Text>
          <Text style={[styles.trialExpiredNote, { marginBottom: 20 }]}>
            Essentials (up to 3 barbers) $29/mo{"\n"}Pro (unlimited barbers) $49/mo
          </Text>
          <TouchableOpacity
            style={styles.trialExpiredBtn}
            onPress={() => Linking.openURL(trialUpgradeUrl)}
          >
            <Text style={styles.trialExpiredBtnText}>View Plans at getclipd.ca →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header />

      {/* Today strip */}
      <View style={styles.strip}>
        <View style={styles.stripRow}>
          <View>
            <Text style={styles.stripLabel}>Today</Text>
            <Text style={styles.stripDate}>{dateLabel}</Text>
          </View>
          <View style={styles.statsGroup}>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{confirmed.length}</Text>
              <Text style={styles.statLbl}>Bookings</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statVal}>{fmtMoney(revenue)}</Text>
              <Text style={styles.statLbl}>Revenue</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statVal}>{noShows}</Text>
              <Text style={styles.statLbl}>No-shows</Text>
            </View>
          </View>
        </View>
        {/* Payment breakdown */}
        {confirmed.length > 0 && (() => {
          const cashPaid = confirmed.filter(b => b.payment_status === "cash_paid");
          const cardPaid = confirmed.filter(b => b.payment_status === "paid" || b.payment_status === "card_paid");
          const depositPaid = confirmed.filter(b => b.payment_status === "deposit_paid");
          const unpaid = confirmed.filter(b => !b.payment_status || b.payment_status === "unpaid");
          const cashTotal = cashPaid.reduce((s, b) => s + (b.amount_paid || b.service_price || 0), 0);
          const cardTotal = cardPaid.reduce((s, b) => s + (b.amount_paid || b.service_price || 0), 0);
          return (
            <Text style={styles.paymentBreakdown}>
              {cashPaid.length > 0 ? `Cash: ${fmtMoney(cashTotal)}` : ""}
              {cashPaid.length > 0 && cardPaid.length > 0 ? "  ·  " : ""}
              {cardPaid.length > 0 ? `Card: ${fmtMoney(cardTotal)}` : ""}
              {(cashPaid.length > 0 || cardPaid.length > 0) && unpaid.length > 0 ? "  ·  " : ""}
              {unpaid.length > 0 ? `Unpaid: ${unpaid.length}` : ""}
              {cashPaid.length === 0 && cardPaid.length === 0 && unpaid.length > 0 ? `${unpaid.length} unpaid` : ""}
              {depositPaid.length > 0 ? `  ·  ${depositPaid.length} deposit` : ""}
            </Text>
          );
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
          <Text style={styles.eodTitle}>Day Wrap-Up</Text>
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
              <Text style={[styles.eodStatVal, noShows > 0 && { color: "#F59E0B" }]}>{noShows}</Text>
              <Text style={styles.eodStatLbl}>No-shows</Text>
            </View>
            <View style={styles.eodStat}>
              <Text style={[styles.eodStatVal, cancelled > 0 && { color: "#DC2626" }]}>{cancelled}</Text>
              <Text style={styles.eodStatLbl}>Cancelled</Text>
            </View>
          </View>
          <Text style={styles.eodOcc}>{Math.round(occupancy * 100)}% chair utilization today</Text>
        </View>
      )}

      {/* Controls row */}
      <View style={styles.controls}>
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, view === "cal" && styles.toggleBtnActive]}
            onPress={() => setViewMode("cal")}
          >
            <View style={styles.toggleBtnInner}><Ionicons name="calendar-outline" size={14} color={view === "cal" ? C.cream : C.muted} /><Text style={[styles.toggleBtnText, view === "cal" && styles.toggleBtnTextActive]}> Calendar</Text></View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, view === "list" && styles.toggleBtnActive]}
            onPress={() => setViewMode("list")}
          >
            <View style={styles.toggleBtnInner}><Ionicons name="menu" size={14} color={view === "list" ? C.cream : C.muted} /><Text style={[styles.toggleBtnText, view === "list" && styles.toggleBtnTextActive]}> List</Text></View>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            style={styles.walkInBtn}
            onPress={() => { setNewBookingPrefill({ walkin: true }); setShowNewBooking(true); }}
          >
            <Text style={styles.walkInBtnText}>Walk-in</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.newBtn} onPress={() => { setNewBookingPrefill({}); setShowNewBooking(true); }}>
            <Text style={styles.newBtnText}>+ New</Text>
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

      {/* Service color legend */}
      {!loading && Object.keys(serviceColorMap).length > 1 && (
        <View style={styles.svcLegend}>
          {Object.entries(serviceColorMap).map(([name, color]) => (
            <View key={name} style={styles.svcLegendItem}>
              <View style={[styles.svcLegendDot, { backgroundColor: color }]} />
              <Text style={styles.svcLegendText} numberOfLines={1}>{name}</Text>
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
          onRefresh={() => { setRefreshing(true); load(true); }}
          refreshing={refreshing}
          date={todayStr}
          blockedSlots={blockedSlots}
          shopHours={shopHours}
          clientNotes={clientNotes}
          serviceColors={serviceColorMap}
          showBarberName={barberFilter === "all" && allBarbers.length > 1}
          barberAvailability={barberAvail}
        />
      ) : (
        <ScrollView
          style={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.espresso} />}
        >
          {sortedBookings.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={40} color={C.muted} />
              <Text style={styles.emptyTitle}>No bookings today</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => { setNewBookingPrefill({}); setShowNewBooking(true); }}>
                <Text style={styles.emptyBtnText}>+ New Booking</Text>
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
                    <View style={styles.listNameRow}>
                      <Text style={[styles.listName, isCancelled && styles.listNameMuted]}>{b.customer_name}</Text>
                      {clientTags[b.customer_email] && (
                        <View style={[styles.clientTag, clientTagStyle(clientTags[b.customer_email])]}>
                          <Text style={[styles.clientTagText, { color: clientTagStyle(clientTags[b.customer_email]).color }]}>
                            {clientTags[b.customer_email]}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.listSvc} numberOfLines={1}>{b.service_name}</Text>
                    {clientNotes[b.customer_email] ? (
                      <Text style={styles.listNote} numberOfLines={1}>📝 {clientNotes[b.customer_email]}</Text>
                    ) : null}
                    <View style={styles.listFooter}>
                      <Text style={styles.listPrice}>${b.service_price ?? b.price ?? 0}</Text>
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
      />
      <NewBookingModal
        visible={showNewBooking}
        onClose={() => setShowNewBooking(false)}
        onSuccess={() => { hapticSuccess(); showToast("Booking confirmed!"); load(true); }}
        prefillDate={newBookingPrefill.date || todayStr}
        prefillBarberId={newBookingPrefill.barberId}
        prefillTime={newBookingPrefill.time}
        startAsWalkin={newBookingPrefill.walkin}
        prefillName={newBookingPrefill.prefillName}
        prefillPhone={newBookingPrefill.prefillPhone}
        prefillEmail={newBookingPrefill.prefillEmail}
      />
      {/* Block Time Modal */}
      <Modal visible={blockModal} transparent animationType="slide">
        <View style={styles.blockOverlay}>
          <View style={styles.blockContent}>
            <Text style={styles.blockTitle}>Block Time</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Trial expired
  trialExpiredContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  trialExpiredIcon: { fontSize: 48, marginBottom: 16 },
  trialExpiredTitle: { fontFamily: serif, fontSize: 24, fontWeight: "900", color: C.espresso, marginBottom: 12, textAlign: "center" },
  trialExpiredMsg: { fontSize: 15, color: C.muted, lineHeight: 22, textAlign: "center", marginBottom: 28 },
  trialExpiredBtn: { backgroundColor: C.terra, paddingVertical: 16, paddingHorizontal: 40, borderRadius: 12, marginBottom: 16 },
  trialExpiredBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  trialExpiredNote: { fontSize: 12, color: C.muted, textAlign: "center" },

  // Strip
  strip: {
    backgroundColor: C.espresso,
    paddingHorizontal: 16, paddingBottom: 12, paddingTop: 6,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
  },
  stripRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 },
  stripLabel: { fontSize: 11, fontWeight: "700", color: "rgba(247,243,238,0.45)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 2 },
  stripDate: { fontFamily: serif, fontSize: 16, fontWeight: "700", color: C.cream },
  statsGroup: { flexDirection: "row", alignItems: "center" },
  stat: { alignItems: "flex-end" },
  statVal: { fontFamily: serif, fontSize: 17, fontWeight: "900", color: C.terra },
  statLbl: { fontSize: 9, fontWeight: "700", color: "rgba(247,243,238,0.4)", textTransform: "uppercase", letterSpacing: 1.2, marginTop: 1 },
  statDivider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.1)", marginHorizontal: 12 },

  // Occupancy bar
  paymentBreakdown: { fontSize: 10, fontWeight: "600", color: "rgba(247,243,238,0.45)", marginBottom: 6, marginTop: 2 },
  occRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  occTrack: { flex: 1, height: 4, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 2, overflow: "hidden" },
  occFill: { height: 4, backgroundColor: C.terra, borderRadius: 2, minWidth: 4 },
  occLabel: { fontSize: 10, fontWeight: "700", color: "rgba(247,243,238,0.4)", width: 68, textAlign: "right" },

  // Service legend
  svcLegend: {
    flexDirection: "row", flexWrap: "wrap", gap: 8,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  svcLegendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  svcLegendDot: { width: 8, height: 8, borderRadius: 2 },
  svcLegendText: { fontSize: 10, fontWeight: "600", color: C.muted },

  // End-of-day summary
  eodCard: {
    margin: 12, marginBottom: 0, backgroundColor: C.espresso, borderRadius: 14, padding: 16,
  },
  eodTitle: {
    fontFamily: serif, fontSize: 16, fontWeight: "800", color: C.cream, marginBottom: 12,
  },
  eodGrid: {
    flexDirection: "row", justifyContent: "space-between", marginBottom: 12,
  },
  eodStat: { alignItems: "center", flex: 1 },
  eodStatVal: {
    fontFamily: serif, fontSize: 22, fontWeight: "900", color: C.terra, marginBottom: 2,
  },
  eodStatLbl: {
    fontSize: 9, fontWeight: "700", color: "rgba(247,243,238,0.5)", textTransform: "uppercase", letterSpacing: 1,
  },
  eodOcc: {
    fontSize: 11, fontWeight: "600", color: "rgba(247,243,238,0.4)", textAlign: "center",
  },

  // Controls
  controls: { backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  controlsRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 10 },
  toggleBtn: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5, borderColor: C.border },
  toggleBtnActive: { backgroundColor: C.espresso, borderColor: C.espresso },
  toggleBtnInner: { flexDirection: "row", alignItems: "center" },
  toggleBtnText: { fontSize: 12, fontWeight: "700", color: C.muted },
  toggleBtnTextActive: { color: C.cream },
  walkInBtn: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5, borderColor: C.border },
  walkInBtnText: { fontSize: 12, fontWeight: "700", color: C.espresso },
  newBtn: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 8, backgroundColor: C.terra },
  newBtnText: { fontSize: 12, fontWeight: "800", color: C.cream },
  filterScroll: { paddingBottom: 10 },
  filterRow: { flexDirection: "row", gap: 6, paddingHorizontal: 10, paddingBottom: 2 },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.white },
  pillActive: { backgroundColor: C.espresso, borderColor: C.espresso },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 11, fontWeight: "700", color: C.muted },
  pillTextActive: { color: C.cream },

  // List view
  list: { flex: 1, padding: 12 },
  listCard: {
    borderRadius: 10, padding: 10, paddingLeft: 12,
    borderWidth: 1, borderColor: "transparent", borderLeftWidth: 3,
  },
  listCardCancelled: { opacity: 0.4 },
  listCardPast: { opacity: 0.55 },
  listCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 },
  listTime: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  listNameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 1 },
  listName: { fontSize: 13, fontWeight: "700", color: C.espresso },
  clientTag: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1 },
  clientTagText: { fontSize: 8, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  listNameMuted: { color: C.muted, textDecorationLine: "line-through" },
  listSvc: { fontSize: 11, color: C.muted, marginBottom: 3 },
  listNote: { fontSize: 10, color: "#92400E", fontStyle: "italic", marginBottom: 4 },
  listFooter: { flexDirection: "row", alignItems: "center" },
  listPrice: { fontSize: 12, fontWeight: "700", color: C.espresso },
  listMeta: { fontSize: 10, color: C.muted },

  // Block modal
  blockOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  blockContent: { backgroundColor: C.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  blockTitle: { fontFamily: serif, fontSize: 20, fontWeight: "800", color: C.espresso, marginBottom: 2 },
  blockSub: { fontSize: 13, color: C.muted, marginBottom: 18 },
  blockLabel: { fontSize: 10, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 },
  blockPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.white },
  blockPillActive: { backgroundColor: C.espresso, borderColor: C.espresso },
  blockPillText: { fontSize: 13, fontWeight: "700", color: C.muted },
  blockPillTextActive: { color: C.cream },
  blockInput: { backgroundColor: C.surface, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: C.espresso, borderWidth: 1, borderColor: C.border, marginBottom: 20 },
  blockBtns: { flexDirection: "row", gap: 10 },
  blockCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 9, borderWidth: 1.5, borderColor: C.border, alignItems: "center" },
  blockCancelText: { fontSize: 14, fontWeight: "700", color: C.muted },
  blockSaveBtn: { flex: 1, paddingVertical: 12, borderRadius: 9, backgroundColor: C.espresso, alignItems: "center" },
  blockSaveText: { fontSize: 14, fontWeight: "800", color: C.cream },

  // Empty
  empty: { paddingTop: 60, alignItems: "center", gap: 10 },
  emptyIcon: {},
  emptyTitle: { fontSize: 16, fontWeight: "700", color: C.muted },
  emptyBtn: { marginTop: 4, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: C.espresso, borderRadius: 10 },
  emptyBtnText: { fontSize: 14, fontWeight: "700", color: C.cream },
});
