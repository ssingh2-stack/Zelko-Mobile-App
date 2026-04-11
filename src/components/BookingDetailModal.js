import React, { useEffect, useState } from "react";
import {
  View, Text, Modal, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";
import { C, serif, fmtMoney } from "../lib/theme";
import { success as hapticSuccess, warn as hapticWarn } from "../lib/haptics";

function fmt(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${period}`;
}

function fmtDate(d) {
  if (!d) return "—";
  const [y, mo, day] = d.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(mo)-1]} ${parseInt(day)}, ${y}`;
}

const STATUS_COLORS = {
  confirmed: { bg: "#D1FAE5", text: "#065F46" },
  cancelled: { bg: "#F3F4F6", text: "#6B7280" },
  no_show:   { bg: "#FEF3C7", text: "#92400E" },
};

const PAYMENT_BADGES = {
  paid:         { label: "Paid",         bg: "#D1FAE5", text: "#065F46" },
  deposit_paid: { label: "Deposit Paid", bg: "#FEF3C7", text: "#92400E" },
  cash_paid:    { label: "Cash",         bg: "#D1FAE5", text: "#065F46" },
  card_paid:    { label: "Card",         bg: "#D1FAE5", text: "#065F46" },
  refunded:     { label: "Refunded",     bg: "#FEE2E2", text: "#DC2626" },
  unpaid:       { label: "Unpaid",       bg: "#F3F4F6", text: "#6B7280" },
};

export default function BookingDetailModal({ booking, visible, onClose, onAction, onReschedule, onCollectPayment }) {
  const [history, setHistory] = useState(null);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editServices, setEditServices] = useState([]);
  const [editSlots, setEditSlots] = useState([]);
  const [editServiceId, setEditServiceId] = useState(null);
  const [editSlot, setEditSlot] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [tipAmount, setTipAmount] = useState("");
  const [payingMethod, setPayingMethod] = useState(null);

  useEffect(() => {
    if (!visible || !booking) return;
    setHistory(null);
    setNotes("");
    setEditing(false);
    setShowPay(false);
    setTipAmount("");
    setPayingMethod(null);
    const email = booking.customer_email;
    if (email && email !== "walk-in@getclipd.ca") {
      Promise.all([
        api.adminClientBookings(email),
        api.adminClientNotes(email).catch(() => ({ notes: "" })),
      ]).then(([hist, notesRes]) => {
        setHistory(hist);
        setNotes(notesRes?.notes || "");
      }).catch(() => setHistory([]));
    }
  }, [visible, booking?.confirmation_code]);

  if (!booking) return null;

  const isCancelled = booking.status === "cancelled" || booking.status === "no_show";
  const statusStyle = STATUS_COLORS[booking.status] || STATUS_COLORS.confirmed;
  const isWalkin = !booking.customer_email || booking.customer_email === "walk-in@getclipd.ca";

  const pastVisits = (history || []).filter(
    h => h.status !== "cancelled" && h.confirmation_code !== booking.confirmation_code
  );
  const totalSpent = pastVisits.reduce((s, h) => s + parseFloat(h.service_price || 0), 0);

  async function saveNotes() {
    if (isWalkin) return;
    setSavingNotes(true);
    try { await api.adminSaveNotes(booking.customer_email, notes); }
    catch {}
    setSavingNotes(false);
  }

  async function handleNoShow() {
    hapticWarn();
    Alert.alert("Mark No-Show", "Mark this booking as a no-show?", [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", style: "destructive", onPress: async () => {
        try {
          await api.adminNoShow(booking.confirmation_code);
          hapticSuccess();
          onAction();
          onClose();
        } catch (err) { Alert.alert("Error", err.message); }
      }},
    ]);
  }

  async function handleCancel() {
    hapticWarn();
    Alert.alert("Cancel Booking", "Cancel this booking?", [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", style: "destructive", onPress: async () => {
        try {
          await api.adminCancelBooking(booking.confirmation_code);
          hapticSuccess();
          onAction();
          onClose();
        } catch (err) { Alert.alert("Error", err.message); }
      }},
    ]);
  }

  function handleReschedule() {
    onClose();
    onReschedule?.(booking);
  }

  async function handleRebook(weeksAhead) {
    // Compute new date = booking.date + N weeks (same weekday + same time)
    const [y, mo, d] = booking.date.split("-").map(Number);
    const dt = new Date(y, mo - 1, d);
    dt.setDate(dt.getDate() + weeksAhead * 7);
    const newDate = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
    try {
      await api.adminCreateBooking({
        barber_id: booking.barber_id,
        service_id: booking.service_id,
        date: newDate,
        start_time: booking.start_time,
        customer_name: booking.customer_name,
        customer_email: booking.customer_email,
        customer_phone: booking.customer_phone || "",
      });
      hapticSuccess();
      Alert.alert("Rebooked", `${booking.customer_name} is booked for ${fmtDate(newDate)} at ${fmt(booking.start_time)}.`);
      onAction();
      onClose();
    } catch (err) {
      // If the slot is taken, fall back to the reschedule flow with prefill
      Alert.alert(
        "That slot is taken",
        "The same time on that day isn't available. Pick another time?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Pick a time", onPress: () => {
            onClose();
            onReschedule?.({
              ...booking,
              date: newDate,
              customer_name: booking.customer_name,
              customer_phone: booking.customer_phone,
              customer_email: booking.customer_email,
            });
          }},
        ]
      );
    }
  }

  async function handleReconfirm() {
    Alert.alert("Reconfirm Booking", "Restore this booking to confirmed?", [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", onPress: async () => {
        try {
          await api.adminUpdateBooking(booking.confirmation_code, { status: "confirmed" });
          hapticSuccess();
          onAction();
          onClose();
        } catch (err) { Alert.alert("Error", err.message); }
      }},
    ]);
  }

  async function handleMarkPaid(method) {
    setPayingMethod(method);
    try {
      const amount = Math.round(parseFloat(booking.service_price ?? booking.price ?? 0) * 100);
      const tip = tipAmount ? Math.round(parseFloat(tipAmount) * 100) : 0;
      await api.adminMarkPaid(booking.confirmation_code, { method, amount, tip });
      hapticSuccess();
      setShowPay(false);
      setTipAmount("");
      onAction();
      onClose();
    } catch (err) {
      Alert.alert("Error", err.message);
    }
    setPayingMethod(null);
  }

  async function handleRefund() {
    const amount = booking.amount_paid || Math.round(parseFloat(booking.service_price ?? booking.price ?? 0) * 100);
    const displayAmount = fmtMoney(amount / 100);
    hapticWarn();
    Alert.alert(
      "Refund Payment",
      `Refund ${displayAmount} to ${booking.customer_name}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Refund", style: "destructive", onPress: async () => {
          try {
            await api.adminRefund(booking.confirmation_code, { amount, reason: "Refund requested" });
            hapticSuccess();
            onAction();
            onClose();
          } catch (err) { Alert.alert("Error", err.message); }
        }},
      ]
    );
  }

  async function startEdit() {
    setEditing(true);
    setEditLoading(true);
    setEditServiceId(String(booking.service_id || ""));
    setEditSlot(booking.start_time);
    try {
      const [services, slots] = await Promise.all([
        api.adminServices(),
        api.adminSlots(booking.date, booking.barber_id, booking.service_id),
      ]);
      setEditServices(services || []);
      const slotList = Array.isArray(slots) ? slots : (slots?.slots || []);
      // Include current time even if not in available slots
      const hasCurrentSlot = slotList.some(s => s.time === booking.start_time);
      if (!hasCurrentSlot) slotList.unshift({ time: booking.start_time, display: fmt(booking.start_time) + " (current)" });
      setEditSlots(slotList);
    } catch (err) {
      Alert.alert("Error", err.message);
      setEditing(false);
    }
    setEditLoading(false);
  }

  async function saveEdit() {
    setEditSaving(true);
    try {
      const updates = {};
      if (editServiceId !== String(booking.service_id)) updates.service_id = parseInt(editServiceId);
      if (editSlot !== booking.start_time) updates.start_time = editSlot;
      if (Object.keys(updates).length === 0) { setEditing(false); setEditSaving(false); return; }
      await api.adminUpdateBooking(booking.confirmation_code, updates);
      hapticSuccess();
      setEditing(false);
      onAction();
      onClose();
    } catch (err) {
      Alert.alert("Error", err.message);
    }
    setEditSaving(false);
  }

  async function onEditServiceChange(sId) {
    setEditServiceId(sId);
    // Reload slots for new service
    try {
      const slots = await api.adminSlots(booking.date, booking.barber_id, sId);
      const slotList = Array.isArray(slots) ? slots : (slots?.slots || []);
      setEditSlots(slotList);
      if (slotList.length && !slotList.some(s => s.time === editSlot)) {
        setEditSlot(slotList[0].time);
      }
    } catch {}
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Title */}
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{booking.customer_name}</Text>
              <Text style={styles.sub}>{fmt(booking.start_time)} · {booking.barber_name} · {fmtDate(booking.date)}</Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 4, marginLeft: 8, marginTop: 2 }}>
              <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg, marginLeft: 0, marginTop: 0 }]}>
                <Text style={[styles.statusText, { color: statusStyle.text }]}>
                  {booking.status === "confirmed" ? "✓ Confirmed" : booking.status === "no_show" ? "No-show" : "Cancelled"}
                </Text>
              </View>
              {(() => {
                const ps = booking.payment_status || "unpaid";
                const badge = PAYMENT_BADGES[ps] || PAYMENT_BADGES.unpaid;
                return (
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg, marginLeft: 0, marginTop: 0 }]}>
                    <Text style={[styles.statusText, { color: badge.text }]}>
                      {ps === "unpaid" ? "$ Unpaid" : `$ ${badge.label}`}
                    </Text>
                  </View>
                );
              })()}
            </View>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Rebook quick row — high-frequency action pinned at the top */}
            {!isCancelled && !editing && (
              <View style={styles.rebookRow}>
                <Text style={styles.rebookLabel}>Rebook in</Text>
                <TouchableOpacity style={styles.rebookBtn} onPress={() => handleRebook(2)}><Text style={styles.rebookBtnText}>2 wks</Text></TouchableOpacity>
                <TouchableOpacity style={styles.rebookBtn} onPress={() => handleRebook(3)}><Text style={styles.rebookBtnText}>3 wks</Text></TouchableOpacity>
                <TouchableOpacity style={styles.rebookBtn} onPress={() => handleRebook(4)}><Text style={styles.rebookBtnText}>4 wks</Text></TouchableOpacity>
                <TouchableOpacity style={styles.rebookBtnAlt} onPress={() => { onClose(); onReschedule?.({ ...booking, date: undefined }); }}>
                  <Ionicons name="calendar-outline" size={14} color={C.terra} />
                </TouchableOpacity>
              </View>
            )}
            {/* Edit mode */}
            {editing ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Edit Booking</Text>
                {editLoading ? (
                  <ActivityIndicator color={C.espresso} style={{ marginVertical: 20 }} />
                ) : (
                  <>
                    <Text style={styles.editLabel}>Service</Text>
                    <Text style={styles.editCurrent}>{booking.service_name}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        {editServices.map(s => {
                          const isActive = String(s.id) === editServiceId;
                          return (
                            <TouchableOpacity
                              key={s.id}
                              style={[styles.editPill, isActive && styles.editPillActive]}
                              onPress={() => onEditServiceChange(String(s.id))}
                            >
                              <Text style={[styles.editPillText, isActive && styles.editPillTextActive]}>
                                {s.name} · {fmtMoney(s.price)}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ScrollView>
                    <Text style={styles.editLabel}>Time</Text>
                    <Text style={styles.editCurrent}>{fmt(booking.start_time)} – {fmt(booking.end_time)}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        {editSlots.map(s => (
                          <TouchableOpacity
                            key={s.time}
                            style={[styles.editPill, editSlot === s.time && styles.editPillActive]}
                            onPress={() => setEditSlot(s.time)}
                          >
                            <Text style={[styles.editPillText, editSlot === s.time && styles.editPillTextActive]}>
                              {s.display || fmt(s.time)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                      <TouchableOpacity style={styles.closeBtn} onPress={() => setEditing(false)}>
                        <Text style={styles.closeBtnText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.editSaveBtn, editSaving && { opacity: 0.6 }]} onPress={saveEdit} disabled={editSaving}>
                        <Text style={styles.editSaveBtnText}>{editSaving ? "Saving…" : "Save Changes"}</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            ) : (
            /* Details */
            <View style={styles.section}>
              <Row icon="cut-outline" label="Service" value={`${booking.service_name} · ${fmtMoney(booking.service_price ?? booking.price ?? 0)} · ${booking.duration_min}m`} />
              <Row icon="time-outline" label="Time" value={`${fmt(booking.start_time)} – ${fmt(booking.end_time)}`} />
              {!isWalkin && <Row icon="mail-outline" label="Contact" value={`${booking.customer_email}${booking.customer_phone ? " · " + booking.customer_phone : ""}`} />}
              {booking.notes && <Row icon="document-text-outline" label="Notes" value={booking.notes} />}
              {(booking.payment_status === "cash_paid" || booking.payment_status === "card_paid" || booking.payment_status === "paid") && (
                <Row icon="card-outline" label="Payment" value={
                  `${(PAYMENT_BADGES[booking.payment_status] || {}).label || "Paid"}` +
                  (booking.amount_paid ? ` · ${fmtMoney(booking.amount_paid / 100)}` : "") +
                  (booking.tip_amount ? ` · Tip ${fmtMoney(booking.tip_amount / 100)}` : "")
                } />
              )}
            </View>
            )}

            {/* Mark as Paid */}
            {!isCancelled && !editing && booking.payment_status !== "paid" && booking.payment_status !== "cash_paid" && booking.payment_status !== "card_paid" && (
              <View style={styles.section}>
                {!showPay ? (
                  <TouchableOpacity
                    style={{ backgroundColor: C.espresso, paddingVertical: 14, borderRadius: 10, alignItems: "center" }}
                    onPress={() => setShowPay(true)}
                  >
                    <Text style={{ color: C.cream, fontSize: 15, fontWeight: "700" }}>Mark as Paid</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => setShowPay(false)}>
                    <Text style={styles.sectionTitle}>Payment ▾</Text>
                  </TouchableOpacity>
                )}
                {showPay && (
                  <View>
                    <Text style={styles.editLabel}>Tip</Text>
                    <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
                      {[5, 10, 15, 20].map(t => (
                        <TouchableOpacity
                          key={t}
                          style={[styles.editPill, tipAmount === String(t) && styles.editPillActive]}
                          onPress={() => setTipAmount(tipAmount === String(t) ? "" : String(t))}
                        >
                          <Text style={[styles.editPillText, tipAmount === String(t) && styles.editPillTextActive]}>${t}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TextInput
                      style={[styles.notesInput, { minHeight: 38, marginBottom: 10 }]}
                      value={tipAmount}
                      onChangeText={setTipAmount}
                      placeholder="Custom tip amount"
                      placeholderTextColor={C.muted}
                      keyboardType="decimal-pad"
                    />
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity
                        style={[styles.payBtn, { backgroundColor: "#D1FAE5" }, payingMethod === "cash" && { opacity: 0.6 }]}
                        onPress={() => handleMarkPaid("cash")}
                        disabled={!!payingMethod}
                      >
                        <Text style={[styles.payBtnText, { color: "#065F46" }]}>
                          {payingMethod === "cash" ? "Saving…" : "💵 Cash"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.payBtn, { backgroundColor: "rgba(59,130,246,0.1)" }, payingMethod === "card" && { opacity: 0.6 }]}
                        onPress={() => handleMarkPaid("card")}
                        disabled={!!payingMethod}
                      >
                        <Text style={[styles.payBtnText, { color: "#1D4ED8" }]}>
                          {payingMethod === "card" ? "Saving…" : "💳 Card"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Client history */}
            {!isWalkin && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Client History</Text>
                {history === null ? (
                  <ActivityIndicator color={C.espresso} size="small" style={{ marginVertical: 12 }} />
                ) : (
                  <>
                    <View style={styles.statsRow}>
                      <View style={styles.stat}>
                        <Text style={styles.statVal}>{pastVisits.length}</Text>
                        <Text style={styles.statLbl}>Visits</Text>
                      </View>
                      <View style={styles.stat}>
                        <Text style={styles.statVal}>{fmtMoney(totalSpent)}</Text>
                        <Text style={styles.statLbl}>Lifetime</Text>
                      </View>
                      {pastVisits[0] && (
                        <View style={styles.stat}>
                          <Text style={styles.statVal}>{fmtDate(pastVisits[0].date)}</Text>
                          <Text style={styles.statLbl}>Last visit</Text>
                        </View>
                      )}
                    </View>
                    {pastVisits.slice(0, 3).map((h, i) => (
                      <View key={i} style={styles.historyRow}>
                        <Text style={styles.histDate}>{fmtDate(h.date)}</Text>
                        <Text style={styles.histSvc}>{h.service_name}</Text>
                        <Text style={styles.histAmt}>{fmtMoney(h.service_price || 0)}</Text>
                      </View>
                    ))}
                    {pastVisits.length === 0 && <Text style={styles.emptyText}>First visit</Text>}
                  </>
                )}

                {/* Notes */}
                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Private Notes</Text>
                <TextInput
                  style={styles.notesInput}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  placeholder="Add notes about this client..."
                  placeholderTextColor={C.muted}
                  onBlur={saveNotes}
                />
                {savingNotes && <Text style={styles.savingText}>Saving…</Text>}
              </View>
            )}

            <View style={{ height: 16 }} />
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
            {!editing && (
              <TouchableOpacity style={styles.editBtn} onPress={startEdit}>
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            )}
            {!isCancelled && !editing && (booking.payment_status === "card_paid" || booking.payment_status === "cash_paid" || booking.payment_status === "paid") && booking.payment_status !== "refunded" && (
              <TouchableOpacity style={[styles.warnBtn, { backgroundColor: "#FEE2E2" }]} onPress={handleRefund}>
                <Text style={[styles.warnBtnText, { color: "#DC2626" }]}>Refund</Text>
              </TouchableOpacity>
            )}
            {!isCancelled && !editing && onCollectPayment && booking.payment_status !== "card_paid" && booking.payment_status !== "cash_paid" && booking.payment_status !== "paid" && (
              <TouchableOpacity style={[styles.rescheduleBtn, { backgroundColor: "rgba(5,150,105,0.1)" }]} onPress={() => onCollectPayment(booking)}>
                <Text style={[styles.rescheduleBtnText, { color: "#059669" }]}>Collect $</Text>
              </TouchableOpacity>
            )}
            {isCancelled && !editing && (
              <TouchableOpacity style={styles.rescheduleBtn} onPress={handleReconfirm}>
                <Text style={styles.rescheduleBtnText}>Reconfirm</Text>
              </TouchableOpacity>
            )}
            {!isCancelled && onReschedule && !editing && (
              <TouchableOpacity style={styles.rescheduleBtn} onPress={handleReschedule}>
                <Text style={styles.rescheduleBtnText}>Reschedule</Text>
              </TouchableOpacity>
            )}
            {!isCancelled && !editing && (
              <>
                <TouchableOpacity style={styles.warnBtn} onPress={handleNoShow}>
                  <Text style={styles.warnBtnText}>No-show</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dangerBtn} onPress={handleCancel}>
                  <Text style={styles.dangerBtnText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Row({ icon, label, value }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={18} color={C.muted} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(44,24,16,0.4)" },
  sheet: {
    backgroundColor: C.cream,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "87%",
    paddingBottom: 32,
  },
  handle: { width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 4 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { fontFamily: serif, fontSize: 20, fontWeight: "700", color: C.espresso },
  sub: { fontSize: 12, color: C.muted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginLeft: 8, marginTop: 2 },
  statusText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  body: { paddingHorizontal: 20 },
  section: { marginTop: 16, marginBottom: 4 },
  sectionTitle: { fontFamily: serif, fontSize: 14, fontWeight: "700", color: C.espresso, marginBottom: 10 },
  detailRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  detailIcon: { fontSize: 16, marginTop: 1 },
  detailLabel: { fontSize: 10, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 1 },
  detailValue: { fontSize: 13, fontWeight: "600", color: C.espresso, marginTop: 1 },
  statsRow: { flexDirection: "row", gap: 20, marginBottom: 12 },
  stat: {},
  statVal: { fontSize: 18, fontWeight: "800", color: C.espresso },
  statLbl: { fontSize: 10, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 1 },
  historyRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border, gap: 8 },
  histDate: { fontSize: 11, color: C.muted, width: 80 },
  histSvc: { flex: 1, fontSize: 12, fontWeight: "600", color: C.espresso },
  histAmt: { fontSize: 12, fontWeight: "700", color: C.espresso },
  emptyText: { fontSize: 12, color: C.muted, fontStyle: "italic" },
  notesInput: {
    backgroundColor: C.white, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    padding: 12, fontSize: 13, color: C.espresso, minHeight: 72, textAlignVertical: "top",
  },
  savingText: { fontSize: 11, color: C.muted, marginTop: 4 },
  actions: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 12, gap: 6, borderTopWidth: 1, borderTopColor: C.border },
  closeBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, alignItems: "center" },
  closeBtnText: { fontSize: 12, fontWeight: "700", color: C.espresso },
  editBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border, alignItems: "center" },
  editBtnText: { fontSize: 12, fontWeight: "700", color: C.espresso },
  editLabel: { fontSize: 10, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 4 },
  editCurrent: { fontSize: 13, fontWeight: "600", color: C.espresso, marginBottom: 8 },
  editPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.white },
  editPillActive: { backgroundColor: C.espresso, borderColor: C.espresso },
  editPillText: { fontSize: 12, fontWeight: "700", color: C.muted },
  editPillTextActive: { color: C.cream },
  editSaveBtn: { flex: 2, paddingVertical: 12, borderRadius: 10, backgroundColor: C.espresso, alignItems: "center" },
  editSaveBtnText: { fontSize: 13, fontWeight: "800", color: C.cream },
  rescheduleBtn: { flex: 1.3, paddingVertical: 12, borderRadius: 10, backgroundColor: "rgba(59,130,246,0.1)", alignItems: "center" },
  rescheduleBtnText: { fontSize: 12, fontWeight: "700", color: "#1D4ED8" },
  rebookRow: { flexDirection: "row", alignItems: "center", gap: 6, padding: 12, marginTop: 12, marginBottom: 4, marginHorizontal: -4, borderRadius: 10, backgroundColor: "rgba(196,104,62,0.12)", borderWidth: 1, borderColor: "rgba(196,104,62,0.25)" },
  rebookBtnAlt: { width: 36, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "rgba(196,104,62,0.4)", backgroundColor: "rgba(196,104,62,0.05)", alignItems: "center", justifyContent: "center" },
  rebookLabel: { fontSize: 11, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginRight: 4 },
  rebookBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: "rgba(196,104,62,0.1)", borderWidth: 1, borderColor: "rgba(196,104,62,0.25)", alignItems: "center" },
  rebookBtnText: { fontSize: 12, fontWeight: "800", color: C.terra },
  warnBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: "#FEF3C7", alignItems: "center" },
  warnBtnText: { fontSize: 12, fontWeight: "700", color: "#92400E" },
  dangerBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: "rgba(196,104,62,0.12)", alignItems: "center" },
  dangerBtnText: { fontSize: 12, fontWeight: "700", color: C.terra },
  payBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  payBtnText: { fontSize: 13, fontWeight: "800" },
});
