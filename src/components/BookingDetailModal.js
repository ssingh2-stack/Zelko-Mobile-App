import React, { useEffect, useState } from "react";
import {
  View, Text, Modal, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from "react-native";
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

export default function BookingDetailModal({ booking, visible, onClose, onAction, onReschedule }) {
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

  useEffect(() => {
    if (!visible || !booking) return;
    setHistory(null);
    setNotes("");
    setEditing(false);
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
            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusText, { color: statusStyle.text }]}>
                {booking.status === "confirmed" ? "✓ Confirmed" : booking.status === "no_show" ? "No-show" : "Cancelled"}
              </Text>
            </View>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
              <Row icon="✂️" label="Service" value={`${booking.service_name} · ${fmtMoney(booking.service_price ?? booking.price ?? 0)} · ${booking.duration_min}m`} />
              <Row icon="🕐" label="Time" value={`${fmt(booking.start_time)} – ${fmt(booking.end_time)}`} />
              {!isWalkin && <Row icon="📧" label="Contact" value={`${booking.customer_email}${booking.customer_phone ? " · " + booking.customer_phone : ""}`} />}
              {booking.notes && <Row icon="📝" label="Notes" value={booking.notes} />}
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
      <Text style={styles.detailIcon}>{icon}</Text>
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
  warnBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: "#FEF3C7", alignItems: "center" },
  warnBtnText: { fontSize: 12, fontWeight: "700", color: "#92400E" },
  dangerBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: "rgba(196,104,62,0.12)", alignItems: "center" },
  dangerBtnText: { fontSize: 12, fontWeight: "700", color: C.terra },
});
