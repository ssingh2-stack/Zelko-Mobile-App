import React, { useEffect, useState } from "react";
import {
  View, Text, Modal, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Linking, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../lib/api";
import { C, serif, fmtMoney } from "../lib/theme";

const TAG_STYLES = {
  vip:     { bg: "rgba(196,104,62,0.08)", text: "#C4683E", border: "rgba(196,104,62,0.25)" },
  new:     { bg: "rgba(17,17,17,0.05)", text: "#333333", border: "rgba(17,17,17,0.15)" },
  regular: { bg: "rgba(107,114,128,0.06)", text: "#6B7280", border: "rgba(107,114,128,0.2)" },
  lapsed:  { bg: "#F3F4F6", text: "#6B7280", border: "#D1D5DB" },
};

function fmtDate(d) {
  if (!d) return "—";
  const [y, mo, day] = d.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(mo)-1]} ${parseInt(day)}, ${y}`;
}
function fmtTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2,"0")} ${h >= 12 ? "PM" : "AM"}`;
}
function initials(name) {
  if (!name || !name.trim()) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0][0].toUpperCase();
}

const STATUS_COLORS = {
  confirmed: { bg: "rgba(17,17,17,0.05)", text: "#333333" },
  cancelled: { bg: "#F3F4F6", text: "#6B7280" },
  no_show:   { bg: "rgba(196,104,62,0.08)", text: "#C4683E" },
};

export default function ClientProfileModal({ client, visible, onClose, onNewBooking, onClientUpdate }) {
  const insets = useSafeAreaInsets();
  const [bookings, setBookings] = useState(null);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [isVip, setIsVip] = useState(false);

  useEffect(() => {
    if (!visible || !client?.email) return;
    setBookings(null);
    setNotes("");
    setIsVip(client.tags?.includes("vip") || false);
    Promise.all([
      api.adminClientBookings(client.email),
      api.adminClientNotes(client.email).catch(() => ({ notes: "" })),
    ]).then(([hist, notesRes]) => {
      setBookings(Array.isArray(hist) ? hist : (hist.bookings || []));
      setNotes(notesRes?.notes || "");
    }).catch(() => setBookings([]));
  }, [visible, client?.email]);

  if (!client) return null;

  const primaryTag = client.tags?.[0];
  const tagStyle = TAG_STYLES[primaryTag];

  const completed = (bookings || []).filter(b => b.status === "confirmed");
  const totalSpent = completed.reduce((s, b) => s + parseFloat(b.service_price || b.price || 0), 0);
  const lastVisit = completed[0]?.date;

  async function toggleVip() {
    const newVal = !isVip;
    setIsVip(newVal);
    try {
      await api.adminClientVip(client.email, newVal);
      onClientUpdate?.();
    } catch { setIsVip(!newVal); }
  }

  async function saveNotes() {
    if (!client.email) return;
    setSavingNotes(true);
    try { await api.adminSaveNotes(client.email, notes); }
    catch {}
    setSavingNotes(false);
  }

  function callClient() {
    if (!client.phone) return;
    Linking.openURL(`tel:${client.phone}`);
  }
  function textClient() {
    if (!client.phone) return;
    Linking.openURL(`sms:${client.phone}`);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={[styles.overlay, { paddingTop: insets.top + 20 }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.avatarWrap}>
              <View style={[styles.avatar, primaryTag && { borderColor: tagStyle?.border || C.border }]}>
                <Text style={styles.avatarText}>{initials(client.name)}</Text>
              </View>
              {primaryTag && tagStyle && (
                <View style={[styles.tag, { backgroundColor: tagStyle.bg, borderColor: tagStyle.border }]}>
                  <Text style={[styles.tagText, { color: tagStyle.text }]}>{primaryTag.toUpperCase()}</Text>
                </View>
              )}
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.clientName}>{client.name}</Text>
              {client.preferred_barber ? (
                <Text style={styles.clientSub}>Prefers {client.preferred_barber}</Text>
              ) : null}
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={toggleVip} style={[styles.vipBtn, isVip && styles.vipBtnActive]}>
                <Text style={[styles.vipBtnText, isVip && styles.vipBtnTextActive]}>{isVip ? "★ VIP" : "☆ VIP"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Stats strip */}
          <View style={styles.statsStrip}>
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{client.visit_count ?? completed.length}</Text>
              <Text style={styles.statLbl}>Visits</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{fmtMoney(client.total_spent ?? totalSpent)}</Text>
              <Text style={styles.statLbl}>Lifetime</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{fmtDate(client.last_visit ?? lastVisit)}</Text>
              <Text style={styles.statLbl}>Last visit</Text>
            </View>
          </View>

          {/* Contact actions */}
          <View style={styles.contactRow}>
            {client.phone ? (
              <>
                <TouchableOpacity style={styles.contactBtn} onPress={callClient}>
                  <Text style={styles.contactBtnIcon}>📞</Text>
                  <Text style={styles.contactBtnText}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contactBtn} onPress={textClient}>
                  <Text style={styles.contactBtnIcon}>💬</Text>
                  <Text style={styles.contactBtnText}>Text</Text>
                </TouchableOpacity>
              </>
            ) : null}
            <TouchableOpacity
              style={[styles.contactBtn, styles.contactBtnPrimary]}
              onPress={() => { onClose(); onNewBooking?.(client); }}
            >
              <Text style={styles.contactBtnIcon}>➕</Text>
              <Text style={[styles.contactBtnText, { color: C.cream }]}>New Booking</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Private notes — shown first for quick access */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Private Notes</Text>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                onBlur={saveNotes}
                multiline
                placeholder="Add notes about this client…"
                placeholderTextColor={C.muted}
                textAlignVertical="top"
              />
              {savingNotes && <Text style={styles.savingText}>Saving…</Text>}
            </View>

            {/* Contact info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contact</Text>
              <View style={styles.contactCard}>
                {client.email && (
                  <View style={styles.contactDetail}>
                    <Text style={styles.contactDetailLabel}>Email</Text>
                    <Text style={styles.contactDetailValue}>{client.email}</Text>
                  </View>
                )}
                {client.phone && (
                  <View style={[styles.contactDetail, { borderTopWidth: client.email ? 1 : 0, borderTopColor: C.border }]}>
                    <Text style={styles.contactDetailLabel}>Phone</Text>
                    <Text style={styles.contactDetailValue}>{client.phone}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Booking history */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Booking History</Text>
              {bookings === null ? (
                <ActivityIndicator color={C.espresso} size="small" style={{ marginVertical: 16 }} />
              ) : bookings.length === 0 ? (
                <Text style={styles.emptyText}>No past bookings</Text>
              ) : (
                bookings.map((b, i) => {
                  const sc = STATUS_COLORS[b.status] || STATUS_COLORS.confirmed;
                  return (
                    <View key={b.confirmation_code || i} style={styles.historyRow}>
                      <View style={styles.historyLeft}>
                        <Text style={styles.historyDate}>{fmtDate(b.date)}</Text>
                        <Text style={styles.historyService}>{b.service_name}</Text>
                        {b.barber_name && <Text style={styles.historyBarber}>{b.barber_name} · {fmtTime(b.start_time)}</Text>}
                      </View>
                      <View style={styles.historyRight}>
                        <Text style={styles.historyPrice}>{fmtMoney(b.service_price ?? b.price ?? 0)}</Text>
                        <View style={[styles.historyStatus, { backgroundColor: sc.bg }]}>
                          <Text style={[styles.historyStatusText, { color: sc.text }]}>
                            {b.status === "no_show" ? "No-show" : b.status}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(44,24,16,0.45)" },
  sheet: {
    backgroundColor: C.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  handle: { width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginTop: 10 },

  // Header
  header: {
    flexDirection: "row", alignItems: "flex-start",
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
    gap: 14,
  },
  avatarWrap: { alignItems: "center", gap: 6 },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.espresso,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: C.border,
  },
  avatarText: { fontFamily: serif, fontSize: 20, fontWeight: "900", color: C.cream },
  tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  tagText: { fontSize: 8, fontWeight: "800", letterSpacing: 0.8 },
  headerInfo: { flex: 1, paddingTop: 4 },
  clientName: { fontFamily: serif, fontSize: 22, fontWeight: "700", color: C.espresso },
  clientSub: { fontSize: 12, color: C.muted, marginTop: 3 },
  headerActions: { alignItems: "flex-end", gap: 6 },
  vipBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1.5, borderColor: "rgba(196,104,62,0.25)", backgroundColor: C.white },
  vipBtnActive: { backgroundColor: "rgba(196,104,62,0.08)", borderColor: "#F59E0B" },
  vipBtnText: { fontSize: 11, fontWeight: "800", color: C.muted },
  vipBtnTextActive: { color: "#C4683E" },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 18, color: C.muted },

  // Stats
  statsStrip: {
    flexDirection: "row",
    backgroundColor: C.espresso,
    paddingVertical: 14,
  },
  statItem: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.12)" },
  statVal: { fontFamily: serif, fontSize: 16, fontWeight: "900", color: C.terra },
  statLbl: { fontSize: 9, fontWeight: "700", color: "rgba(250,250,250,0.4)", textTransform: "uppercase", letterSpacing: 1.2, marginTop: 2 },

  // Contact actions
  contactRow: {
    flexDirection: "row", gap: 8, padding: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
    backgroundColor: C.white,
  },
  contactBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: C.border,
    backgroundColor: C.cream,
  },
  contactBtnPrimary: { backgroundColor: C.espresso, borderColor: C.espresso },
  contactBtnIcon: { fontSize: 14 },
  contactBtnText: { fontSize: 13, fontWeight: "700", color: C.espresso },

  // Body
  body: { paddingHorizontal: 16 },
  section: { marginTop: 20 },
  sectionTitle: { fontFamily: serif, fontSize: 15, fontWeight: "700", color: C.espresso, marginBottom: 10 },

  // Contact info card
  contactCard: {
    backgroundColor: C.white, borderRadius: 12,
    borderWidth: 1, borderColor: C.border, overflow: "hidden",
  },
  contactDetail: { paddingHorizontal: 14, paddingVertical: 10 },
  contactDetailLabel: { fontSize: 10, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 },
  contactDetailValue: { fontSize: 14, fontWeight: "600", color: C.espresso },

  // History
  historyRow: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
    backgroundColor: C.white, borderRadius: 10, padding: 12, marginBottom: 6,
    borderWidth: 1, borderColor: C.border,
  },
  historyLeft: { flex: 1 },
  historyDate: { fontSize: 11, fontWeight: "700", color: C.muted, marginBottom: 2 },
  historyService: { fontSize: 13, fontWeight: "700", color: C.espresso, marginBottom: 1 },
  historyBarber: { fontSize: 11, color: C.muted },
  historyRight: { alignItems: "flex-end", gap: 4 },
  historyPrice: { fontSize: 14, fontWeight: "800", color: C.espresso },
  historyStatus: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  historyStatusText: { fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },

  // Notes
  notesInput: {
    backgroundColor: C.white, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    padding: 12, fontSize: 13, color: C.espresso, minHeight: 80,
  },
  savingText: { fontSize: 11, color: C.muted, marginTop: 4 },
  emptyText: { fontSize: 13, color: C.muted, fontStyle: "italic", paddingVertical: 8 },
});
