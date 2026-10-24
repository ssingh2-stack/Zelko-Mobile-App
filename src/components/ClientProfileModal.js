import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  View, Text, Modal, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Linking, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../lib/api";
import { F, C, fmtMoney, CLIENT_TAGS } from "../lib/theme";

const TAG_STYLES = CLIENT_TAGS;

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
  confirmed: { bg: C.blueSoft, text: C.blue },
  cancelled: { bg: C.sunk, text: C.muted },
  no_show:   { bg: C.surface, text: C.danger },
};

export default function ClientProfileModal({ client, visible, onClose, onNewBooking, onClientUpdate }) {
  const insets = useSafeAreaInsets();
  const [bookings, setBookings] = useState(null);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
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
    try {
      await api.adminSaveNotes(client.email, notes);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    }
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
              <View style={[styles.avatar, primaryTag && { borderColor: tagStyle?.border || C.line }]}>
                <Text style={styles.avatarText}>{initials(client.name)}</Text>
              </View>
              {primaryTag && tagStyle && (
                <View style={[styles.tag, { backgroundColor: tagStyle.bg, borderColor: tagStyle.border }]}>
                  <Text style={[styles.tagText, { color: tagStyle.text }]}>{tagStyle.label}</Text>
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
                <Ionicons name={isVip ? "star" : "star-outline"} size={13} color={isVip ? C.blue : C.muted} />
                <Text style={[styles.vipBtnText, isVip && styles.vipBtnTextActive]}>VIP</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color={C.muted} />
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
                  <Ionicons name="call-outline" size={17} color={C.ink} />
                  <Text style={styles.contactBtnText}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contactBtn} onPress={textClient}>
                  <Ionicons name="chatbubble-outline" size={17} color={C.ink} />
                  <Text style={styles.contactBtnText}>Text</Text>
                </TouchableOpacity>
              </>
            ) : null}
            <TouchableOpacity
              style={[styles.contactBtn, styles.contactBtnPrimary]}
              onPress={() => { onClose(); onNewBooking?.(client); }}
            >
              <Ionicons name="add" size={18} color={C.onBlue} />
              <Text style={[styles.contactBtnText, { color: C.onBlue }]}>Book</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Private notes — shown first for quick access */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Private notes</Text>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                onBlur={saveNotes}
                multiline
                placeholder="Only your team sees these. Preferences, allergies, how they like it."
                placeholderTextColor={C.muted}
                textAlignVertical="top"
              />
              {savingNotes && <Text style={styles.savingText}>Saving…</Text>}
              {notesSaved && !savingNotes && <Text style={styles.savedText}>Saved ✓</Text>}
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
                  <View style={[styles.contactDetail, { borderTopWidth: client.email ? 1 : 0, borderTopColor: C.line }]}>
                    <Text style={styles.contactDetailLabel}>Phone</Text>
                    <Text style={styles.contactDetailValue}>{client.phone}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Booking history */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Booking history</Text>
              {bookings === null ? (
                <ActivityIndicator color={C.ink} size="small" style={{ marginVertical: 16 }} />
              ) : bookings.length === 0 ? (
                <Text style={styles.emptyText}>No bookings yet.</Text>
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
                            {b.status === "no_show" ? "No-show" : b.status === "cancelled" ? "Cancelled" : b.status === "confirmed" ? "Booked" : b.status}
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
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(14,14,12,0.45)" },
  sheet: {
    backgroundColor: C.paper,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  handle: { width: 36, height: 4, backgroundColor: C.line, borderRadius: 2, alignSelf: "center", marginTop: 10 },

  // Header
  header: {
    flexDirection: "row", alignItems: "flex-start",
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: C.line,
    gap: 14,
  },
  avatarWrap: { alignItems: "center", gap: 6 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.blueSoft, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: C.surface },
  avatarText: { fontSize: 20, fontFamily: F.medium, color: C.blue },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  tagText: { fontSize: 12, fontFamily: F.medium },
  headerInfo: { flex: 1, paddingTop: 4 },
  clientName: { fontSize: 26, fontFamily: F.regular, color: C.ink, letterSpacing: -0.6 },
  clientSub: { fontFamily: F.regular, fontSize: 14, color: C.muted, marginTop: 3 },
  headerActions: { alignItems: "flex-end", gap: 6 },
  vipBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.surface },
  vipBtnActive: { backgroundColor: C.blueSoft, borderColor: C.blueSoft },
  vipBtnText: { fontSize: 13, fontFamily: F.medium, color: C.muted },
  vipBtnTextActive: { color: C.blue },
  closeBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  closeBtnText: { fontFamily: F.regular, fontSize: 18, color: C.muted },

  // Stats
  statsStrip: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 4 },
  statItem: { flex: 1, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 12 },
  statDivider: { display: "none" },
  statVal: { fontSize: 18, fontFamily: F.regular, color: C.ink, letterSpacing: -0.3, fontVariant: ["tabular-nums"] },
  statLbl: { fontSize: 11, fontFamily: F.monoMedium, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginTop: 4 },

  // Contact actions
  contactRow: { flexDirection: "row", gap: 8, padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  contactBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 46, borderRadius: 12, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.surface },
  contactBtnPrimary: { backgroundColor: C.blue, borderColor: C.blue },
  contactBtnIcon: { fontFamily: F.regular, fontSize: 14 },
  contactBtnText: { fontSize: 15, fontFamily: F.medium, color: C.ink },

  // Body
  body: { paddingHorizontal: 16 },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 12, fontFamily: F.monoMedium, color: C.muted, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10 },

  // Contact info card
  contactCard: {
    backgroundColor: C.surface, borderRadius: 12,
    borderWidth: 1, borderColor: C.line, overflow: "hidden",
  },
  contactDetail: { paddingHorizontal: 14, paddingVertical: 10 },
  contactDetailLabel: { fontSize: 12, fontFamily: F.regular, color: C.muted, marginBottom: 2 },
  contactDetailValue: { fontSize: 16, fontFamily: F.regular, color: C.ink },

  // History
  historyRow: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
    backgroundColor: C.surface, borderRadius: 10, padding: 12, marginBottom: 6,
    borderWidth: 1, borderColor: C.line,
  },
  historyLeft: { flex: 1 },
  historyDate: { fontSize: 11, fontFamily: F.semibold, color: C.muted, marginBottom: 2 },
  historyService: { fontSize: 13, fontFamily: F.semibold, color: C.ink, marginBottom: 1 },
  historyBarber: { fontFamily: F.regular, fontSize: 11, color: C.muted },
  historyRight: { alignItems: "flex-end", gap: 4 },
  historyPrice: { fontSize: 14, fontFamily: F.semibold, color: C.ink },
  historyStatus: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  historyStatusText: { fontSize: 11, fontFamily: F.monoMedium, textTransform: "uppercase", letterSpacing: 0.5 },

  // Notes
  notesInput: {
    backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.line,
    padding: 12, fontFamily: F.regular, fontSize: 13, color: C.ink, minHeight: 80,
  },
  savingText: { fontFamily: F.regular, fontSize: 11, color: C.muted, marginTop: 4 },
  savedText: { fontSize: 11, color: C.success, fontFamily: F.semibold, marginTop: 4 },
  emptyText: { fontFamily: F.regular, fontSize: 13, color: C.muted, fontStyle: "italic", paddingVertical: 8 },
});
