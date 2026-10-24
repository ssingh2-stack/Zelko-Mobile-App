import React, { useEffect, useState } from "react";
import {
  View, Text, Modal, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api, isWalkinEmail } from "../lib/api";
import { F, C, fmtMoney } from "../lib/theme";
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

// Status pills: word first, colour second (brand/components/StatusBadge).
const STATUS_BADGES = {
  confirmed: { label: "Booked",    bg: C.blueSoft, text: C.blue,   border: C.blueSoft },
  cancelled: { label: "Cancelled", bg: C.sunk,     text: C.muted,  border: C.sunk },
  no_show:   { label: "No-show",   bg: C.surface,  text: C.danger, border: C.line },
};

const PAYMENT_BADGES = {
  paid:         { label: "Paid ✓",       bg: C.surface, text: C.success, border: C.line },
  deposit_paid: { label: "Deposit held", bg: C.blueSoft, text: C.blue,   border: C.blueSoft },
  cash_paid:    { label: "Paid cash ✓",  bg: C.surface, text: C.success, border: C.line },
  card_paid:    { label: "Paid card ✓",  bg: C.surface, text: C.success, border: C.line },
  refunded:     { label: "Refunded",     bg: C.sunk,    text: C.muted,   border: C.sunk },
  unpaid:       { label: "To collect",   bg: C.sunk,    text: C.muted,   border: C.sunk },
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
    if (!isWalkinEmail(email)) {
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
  const statusStyle = STATUS_BADGES[booking.status] || STATUS_BADGES.confirmed;
  const isPaid = ["paid", "cash_paid", "card_paid"].includes(booking.payment_status);
  const isWalkin = isWalkinEmail(booking.customer_email);

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
    Alert.alert("Mark no-show", "Mark this booking as a no-show?", [
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
    Alert.alert("Cancel booking", "Cancel this booking?", [
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
    Alert.alert("Reconfirm booking", "Restore this booking to confirmed?", [
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
      "Refund payment",
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
              <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg, borderColor: statusStyle.border }]}>
                <Text style={[styles.statusText, { color: statusStyle.text }]}>{statusStyle.label}</Text>
              </View>
              {(() => {
                const ps = booking.payment_status || "unpaid";
                const badge = PAYMENT_BADGES[ps] || PAYMENT_BADGES.unpaid;
                return (
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                    <Text style={[styles.statusText, { color: badge.text }]}>{badge.label}</Text>
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
                <TouchableOpacity style={styles.rebookBtn} onPress={() => handleRebook(2)}><Text style={styles.rebookBtnText}>2 weeks</Text></TouchableOpacity>
                <TouchableOpacity style={styles.rebookBtn} onPress={() => handleRebook(3)}><Text style={styles.rebookBtnText}>3 weeks</Text></TouchableOpacity>
                <TouchableOpacity style={styles.rebookBtn} onPress={() => handleRebook(4)}><Text style={styles.rebookBtnText}>4 weeks</Text></TouchableOpacity>
                <TouchableOpacity style={styles.rebookBtnAlt} accessibilityLabel="Pick another date" onPress={() => { onClose(); onReschedule?.({ ...booking, date: undefined }); }}>
                  <Ionicons name="calendar-outline" size={14} color={C.blue} />
                </TouchableOpacity>
              </View>
            )}
            {/* Edit mode */}
            {editing ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Edit booking</Text>
                {editLoading ? (
                  <ActivityIndicator color={C.ink} style={{ marginVertical: 20 }} />
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
                        <Text style={styles.editSaveBtnText}>{editSaving ? "Saving…" : "Save changes"}</Text>
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
                  <TouchableOpacity style={styles.markPaidBtn} onPress={() => setShowPay(true)}>
                    <Text style={styles.markPaidText}>Mark as paid at the shop</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => setShowPay(false)}>
                    <Text style={styles.sectionTitle}>Payment</Text>
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
                        style={[styles.payBtn, styles.payBtnCash, payingMethod === "cash" && { opacity: 0.6 }]}
                        onPress={() => handleMarkPaid("cash")}
                        disabled={!!payingMethod}
                      >
                        <Text style={[styles.payBtnText, { color: C.ink }]}>
                          {payingMethod === "cash" ? "Saving…" : "Paid cash"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.payBtn, styles.payBtnCard, payingMethod === "card" && { opacity: 0.6 }]}
                        onPress={() => handleMarkPaid("card")}
                        disabled={!!payingMethod}
                      >
                        <Text style={[styles.payBtnText, { color: C.onNight }]}>
                          {payingMethod === "card" ? "Saving…" : "Paid by card"}
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
                <Text style={styles.sectionTitle}>Client history</Text>
                {history === null ? (
                  <ActivityIndicator color={C.ink} size="small" style={{ marginVertical: 12 }} />
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
                    {pastVisits.length === 0 && <Text style={styles.emptyText}>This is their first visit.</Text>}
                  </>
                )}

                {/* Notes */}
                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Private notes</Text>
                <TextInput
                  style={styles.notesInput}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  placeholder="Only your team sees these. Preferences, allergies, how they like it."
                  placeholderTextColor={C.muted}
                  onBlur={saveNotes}
                />
                {savingNotes && <Text style={styles.savingText}>Saving…</Text>}
              </View>
            )}

            <View style={{ height: 16 }} />
          </ScrollView>

          {/* Actions: money first, then changes, then the quiet destructive ones */}
          <View style={styles.actions}>
            {!isCancelled && !editing && onCollectPayment && !isPaid && (
              <TouchableOpacity style={styles.chargeBtn} onPress={() => onCollectPayment(booking)}>
                <Text style={styles.chargeBtnText}>Collect {fmtMoney(booking.service_price ?? booking.price ?? 0)}</Text>
              </TouchableOpacity>
            )}
            {!editing && (
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={startEdit}>
                  <Text style={styles.secondaryBtnText}>Edit</Text>
                </TouchableOpacity>
                {!isCancelled && onReschedule && (
                  <TouchableOpacity style={styles.secondaryBtn} onPress={handleReschedule}>
                    <Text style={styles.secondaryBtnText}>Reschedule</Text>
                  </TouchableOpacity>
                )}
                {isCancelled && (
                  <TouchableOpacity style={styles.secondaryBtn} onPress={handleReconfirm}>
                    <Text style={styles.secondaryBtnText}>Reconfirm</Text>
                  </TouchableOpacity>
                )}
                {!isCancelled && isPaid && booking.payment_status !== "refunded" && (
                  <TouchableOpacity style={styles.secondaryBtn} onPress={handleRefund}>
                    <Text style={styles.secondaryBtnText}>Refund</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            {!isCancelled && !editing && (
              <View style={styles.quietRow}>
                <TouchableOpacity onPress={handleNoShow} style={styles.quietBtn}><Text style={styles.quietText}>Mark no-show</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleCancel} style={styles.quietBtn}><Text style={[styles.quietText, { color: C.danger }]}>Cancel booking</Text></TouchableOpacity>
              </View>
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
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(14,14,12,0.45)" },
  sheet: { backgroundColor: C.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "88%", paddingBottom: 28 },
  handle: { width: 36, height: 5, backgroundColor: C.line, borderRadius: 3, alignSelf: "center", marginTop: 10, marginBottom: 4 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  title: { fontSize: 26, fontFamily: F.regular, color: C.ink, letterSpacing: -0.6 },
  sub: { fontFamily: F.regular, fontSize: 14, color: C.muted, marginTop: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  statusText: { fontSize: 12, fontFamily: F.medium },
  body: { paddingHorizontal: 20 },
  section: { marginTop: 18, marginBottom: 4 },
  sectionTitle: { fontSize: 12, fontFamily: F.monoMedium, color: C.muted, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10 },
  detailRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  detailIcon: { marginTop: 1 },
  detailLabel: { fontSize: 12, fontFamily: F.regular, color: C.muted },
  detailValue: { fontSize: 16, fontFamily: F.regular, color: C.ink, marginTop: 1 },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  stat: { flex: 1, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 12 },
  statVal: { fontSize: 18, fontFamily: F.regular, color: C.ink, letterSpacing: -0.3, fontVariant: ["tabular-nums"] },
  statLbl: { fontSize: 11, fontFamily: F.monoMedium, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginTop: 4 },
  historyRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line, gap: 8 },
  histDate: { fontFamily: F.mono, fontSize: 12, color: C.muted, width: 92 },
  histSvc: { flex: 1, fontSize: 15, fontFamily: F.regular, color: C.ink },
  histAmt: { fontSize: 15, fontFamily: F.medium, color: C.ink, fontVariant: ["tabular-nums"] },
  emptyText: { fontFamily: F.regular, fontSize: 14, color: C.muted },
  notesInput: { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.lineStrong, padding: 12, fontFamily: F.regular, fontSize: 15, color: C.ink, minHeight: 80, textAlignVertical: "top" },
  savingText: { fontFamily: F.regular, fontSize: 12, color: C.muted, marginTop: 4 },
  actions: { paddingHorizontal: 16, paddingTop: 12, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  actionRow: { flexDirection: "row", gap: 8 },
  chargeBtn: { height: 52, borderRadius: 12, backgroundColor: C.night, alignItems: "center", justifyContent: "center" },
  chargeBtnText: { fontSize: 16, fontFamily: F.medium, color: C.onNight, fontVariant: ["tabular-nums"] },
  secondaryBtn: { flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { fontSize: 15, fontFamily: F.medium, color: C.ink },
  quietRow: { flexDirection: "row", justifyContent: "center", gap: 28 },
  quietBtn: { paddingVertical: 10, paddingHorizontal: 4 },
  quietText: { fontSize: 14, fontFamily: F.medium, color: C.muted },
  closeBtn: { flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: C.lineStrong, alignItems: "center", justifyContent: "center" },
  closeBtnText: { fontSize: 15, fontFamily: F.medium, color: C.ink },
  editLabel: { fontSize: 14, fontFamily: F.medium, color: C.ink, marginBottom: 4 },
  editCurrent: { fontSize: 14, fontFamily: F.regular, color: C.muted, marginBottom: 8 },
  editPill: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.surface },
  editPillActive: { backgroundColor: C.blue, borderColor: C.blue },
  editPillText: { fontSize: 14, fontFamily: F.medium, color: C.ink },
  editPillTextActive: { color: C.onBlue },
  editSaveBtn: { flex: 2, height: 46, borderRadius: 12, backgroundColor: C.blue, alignItems: "center", justifyContent: "center" },
  editSaveBtnText: { fontSize: 15, fontFamily: F.medium, color: C.onBlue },
  rebookRow: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10, marginTop: 14, marginBottom: 2, borderRadius: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line },
  rebookBtnAlt: { width: 40, height: 38, borderRadius: 10, backgroundColor: C.blueSoft, alignItems: "center", justifyContent: "center" },
  rebookLabel: { fontSize: 14, fontFamily: F.regular, color: C.muted, marginRight: 2 },
  rebookBtn: { flex: 1, height: 38, borderRadius: 10, backgroundColor: C.blueSoft, alignItems: "center", justifyContent: "center" },
  rebookBtnText: { fontSize: 14, fontFamily: F.medium, color: C.blue },
  markPaidBtn: { height: 46, borderRadius: 12, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" },
  markPaidText: { fontSize: 15, fontFamily: F.medium, color: C.ink },
  payBtn: { flex: 1, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  payBtnCash: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.lineStrong },
  payBtnCard: { backgroundColor: C.night },
  payBtnText: { fontSize: 15, fontFamily: F.medium },
});
