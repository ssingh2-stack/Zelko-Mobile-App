import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, Modal, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Switch, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";
import { C, serif, fmtMoney } from "../lib/theme";

function Picker({ label, value, onChange, options, loading }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
        <View style={styles.pillRow}>
          {loading ? (
            <ActivityIndicator color={C.espresso} size="small" style={{ marginLeft: 8 }} />
          ) : (
            options.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.pill, value === opt.value && styles.pillActive]}
                onPress={() => onChange(opt.value)}
              >
                <Text style={[styles.pillText, value === opt.value && styles.pillTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function initials(name) {
  if (!name || !name.trim()) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0][0].toUpperCase();
}

export default function NewBookingModal({ visible, onClose, onSuccess, prefillDate, prefillTime, prefillBarberId, startAsWalkin, prefillName, prefillPhone, prefillEmail, staffMode }) {
  const [barbers, setBarbers] = useState([]);
  const [services, setServices] = useState([]);
  const [clients, setClients] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [barberId, setBarberId] = useState(null);
  const [serviceId, setServiceId] = useState(null);
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [isWalkin, setIsWalkin] = useState(false);

  // Client search
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);

  // Manual entry (used when no client selected and not walk-in)
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Recurring
  const [repeatWeeks, setRepeatWeeks] = useState(0); // 0 = no repeat
  const [repeatCount, setRepeatCount] = useState(4); // how many repeats

  const [error, setError] = useState("");
  const searchRef = useRef(null);

  useEffect(() => {
    if (!visible) return;
    setError("");
    setIsWalkin(startAsWalkin || false);
    setName(prefillName || "");
    setPhone(prefillPhone || "");
    setEmail(prefillEmail || "");
    setClientSearch("");
    setSelectedClient(prefillName ? { name: prefillName, phone: prefillPhone || "", email: prefillEmail || "" } : null);
    setSlot("");
    setRepeatWeeks(0);
    setRepeatCount(4);
    autoAdvanceRef.current = false;
    setDate(prefillDate || todayISO());

    if (staffMode) {
      // Staff mode: no barber picker, just load services
      Promise.all([api.adminServices().catch(() => []), api.adminClients().catch(() => [])]).then(([ss, cl]) => {
        setBarbers([]);
        setServices(Array.isArray(ss) ? ss : []);
        const clientList = Array.isArray(cl) ? cl : (cl.clients || []);
        setClients(clientList);
        setBarberId("staff"); // placeholder — staff API auto-assigns barber
        setServiceId(String(ss[0]?.id ?? ""));
        setLoadingMeta(false);
      }).catch(() => setLoadingMeta(false));
    } else {
      Promise.all([api.adminBarbers(), api.adminServices(), api.adminClients()]).then(([bs, ss, cl]) => {
        setBarbers(bs);
        setServices(ss);
        const clientList = Array.isArray(cl) ? cl : (cl.clients || []);
        setClients(clientList);
        const initBarber = prefillBarberId ?? (bs[0]?.id ?? null);
        const initService = ss[0]?.id ?? null;
        setBarberId(String(initBarber));
        setServiceId(String(initService));
        setLoadingMeta(false);
      }).catch(() => setLoadingMeta(false));
    }
  }, [visible]);

  const autoAdvanceRef = useRef(false);

  useEffect(() => {
    if (!visible) return;
    if (!barberId || !serviceId || !date) return;
    setLoadingSlots(true);
    setSlot("");
    const slotsPromise = staffMode
      ? api.staffSlots(serviceId, date)
      : api.adminSlots(date, barberId, serviceId);
    slotsPromise.then(data => {
      const slotList = Array.isArray(data) ? data : (data.slots || []);
      setSlots(slotList);
      if (prefillTime) {
        const match = slotList.find(s => s.time === prefillTime);
        if (match) setSlot(prefillTime);
      } else if (slotList.length) {
        setSlot(slotList[0].time);
      } else if (!prefillDate && !autoAdvanceRef.current) {
        // No slots today and no prefilled date — auto-advance to next day
        autoAdvanceRef.current = true;
        const next = new Date(date + "T12:00:00");
        next.setDate(next.getDate() + 1);
        setDate(next.toISOString().split("T")[0]);
      }
    }).catch(() => setSlots([])).finally(() => setLoadingSlots(false));
  }, [barberId, serviceId, date, visible, staffMode, prefillTime]);

  function todayISO() {
    return new Date().toISOString().split("T")[0];
  }

  function selectClient(c) {
    setSelectedClient(c);
    setClientSearch("");
    setName(c.name || "");
    setPhone(c.phone || "");
    setEmail(c.email || "");
  }

  function clearSelectedClient() {
    setSelectedClient(null);
    setName(""); setPhone(""); setEmail("");
  }

  // Filter clients by name as user types (≥2 chars)
  const searchQuery = clientSearch.trim().toLowerCase();
  const filteredClients = searchQuery.length >= 2
    ? clients.filter(c => c.name?.toLowerCase().includes(searchQuery)).slice(0, 6)
    : [];

  async function submit() {
    setError("");
    const effectiveName = isWalkin ? "Walk-in" : name.trim();
    const effectiveEmail = isWalkin ? "walk-in@getclipd.ca" : email.trim();
    const effectivePhone = isWalkin ? "" : phone.trim();

    if (!isWalkin && !effectiveName) { setError("Customer name is required."); return; }
    if (!isWalkin && !effectivePhone) { setError("Phone number is required."); return; }
    if (!isWalkin && !effectiveEmail) { setError("Email address is required."); return; }
    if (!slot) { setError("Please select a time slot."); return; }

    setSubmitting(true);
    try {
      const bookingData = {
        service_id: parseInt(serviceId),
        date,
        start_time: slot,
        customer_name: effectiveName,
        customer_phone: effectivePhone,
        customer_email: effectiveEmail,
      };
      if (!staffMode) bookingData.barber_id = parseInt(barberId);
      await (staffMode ? api.staffCreateBooking(bookingData) : api.adminCreateBooking(bookingData));

      // Create recurring bookings if repeat is enabled
      if (repeatWeeks > 0 && repeatCount > 0) {
        let failed = 0;
        for (let i = 1; i <= repeatCount; i++) {
          const futureDate = new Date(date + "T12:00:00");
          futureDate.setDate(futureDate.getDate() + repeatWeeks * 7 * i);
          try {
            const futureData = { ...bookingData, date: `${futureDate.getFullYear()}-${String(futureDate.getMonth()+1).padStart(2,"0")}-${String(futureDate.getDate()).padStart(2,"0")}` };
            await (staffMode ? api.staffCreateBooking(futureData) : api.adminCreateBooking(futureData));
          } catch {
            failed++;
          }
        }
        if (failed > 0) {
          Alert.alert("Recurring", `Booked ${repeatCount + 1 - failed} of ${repeatCount + 1}. ${failed} slot(s) were unavailable.`);
        }
      }

      onClose();
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const barberOptions = barbers.map(b => ({ value: String(b.id), label: b.name }));
  const serviceOptions = services.map(s => ({ value: String(s.id), label: `${s.name} — ${fmtMoney(s.price)}` }));
  const slotOptions = slots.map(s => ({ value: s.time, label: s.display || s.time }));

  function changeDate(delta) {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().split("T")[0]);
  }
  const d = new Date(date + "T12:00:00");
  const dateLabel = d.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Text style={styles.title}>New Booking</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.closeX}>✕</Text></TouchableOpacity>
          </View>

          {loadingMeta ? (
            <View style={styles.center}><ActivityIndicator color={C.espresso} /></View>
          ) : (
            <ScrollView style={styles.body} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
              {/* Barber — hidden in staff mode */}
              {!staffMode && <Picker label="Barber" value={barberId} onChange={setBarberId} options={barberOptions} />}

              {/* Service */}
              <Picker label="Service" value={serviceId} onChange={setServiceId} options={serviceOptions} />

              {/* Date */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Date</Text>
                <View style={styles.dateRow}>
                  <TouchableOpacity style={styles.dateArrow} onPress={() => changeDate(-1)}>
                    <Text style={styles.dateArrowText}>‹</Text>
                  </TouchableOpacity>
                  <Text style={styles.dateLabel}>{dateLabel}</Text>
                  <TouchableOpacity style={styles.dateArrow} onPress={() => changeDate(1)}>
                    <Text style={styles.dateArrowText}>›</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Time slot */}
              {loadingSlots ? (
                <View style={styles.fieldWrap}><ActivityIndicator color={C.espresso} /></View>
              ) : slotOptions.length === 0 ? (
                <View style={styles.fieldWrap}>
                  <Text style={styles.fieldLabel}>Time</Text>
                  <Text style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>No available times — try another day →</Text>
                </View>
              ) : (
                <Picker label="Time" value={slot} onChange={setSlot} options={slotOptions} />
              )}

              {/* Walk-in toggle */}
              <View style={styles.walkinRow}>
                <Text style={styles.walkinLabel}>Walk-in</Text>
                <Switch
                  value={isWalkin}
                  onValueChange={v => { setIsWalkin(v); if (v) clearSelectedClient(); }}
                  trackColor={{ true: C.terra }}
                  thumbColor={C.white}
                />
              </View>

              {/* Recurring */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Repeat</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
                  <View style={styles.pillRow}>
                    {[
                      { value: 0, label: "No repeat" },
                      { value: 1, label: "Every week" },
                      { value: 2, label: "Every 2 weeks" },
                      { value: 3, label: "Every 3 weeks" },
                      { value: 4, label: "Every 4 weeks" },
                    ].map(opt => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.pill, repeatWeeks === opt.value && styles.pillActive]}
                        onPress={() => setRepeatWeeks(opt.value)}
                      >
                        <Text style={[styles.pillText, repeatWeeks === opt.value && styles.pillTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                {repeatWeeks > 0 && (
                  <View style={styles.repeatCountRow}>
                    <Text style={styles.repeatCountLabel}>For</Text>
                    {[2, 4, 6, 8, 12].map(n => (
                      <TouchableOpacity
                        key={n}
                        style={[styles.repeatCountBtn, repeatCount === n && styles.repeatCountBtnActive]}
                        onPress={() => setRepeatCount(n)}
                      >
                        <Text style={[styles.repeatCountText, repeatCount === n && styles.repeatCountTextActive]}>{n}</Text>
                      </TouchableOpacity>
                    ))}
                    <Text style={styles.repeatCountLabel}>weeks</Text>
                  </View>
                )}
              </View>

              {/* Customer section */}
              {!isWalkin && (
                <View style={styles.customerSection}>
                  <Text style={styles.fieldLabel}>Customer</Text>

                  {/* ── Selected client chip ── */}
                  {selectedClient ? (
                    <View style={styles.selectedClientRow}>
                      <View style={styles.clientAvatar}>
                        <Text style={styles.clientAvatarText}>{initials(selectedClient.name)}</Text>
                      </View>
                      <View style={styles.clientAvatarInfo}>
                        <Text style={styles.clientAvatarName}>{selectedClient.name}</Text>
                        <Text style={styles.clientAvatarMeta}>{selectedClient.phone}{selectedClient.email ? ` · ${selectedClient.email}` : ""}</Text>
                      </View>
                      <TouchableOpacity style={styles.clientClearBtn} onPress={clearSelectedClient}>
                        <Text style={styles.clientClearText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      {/* ── Search box ── */}
                      <View style={styles.searchWrap}>
                        <Ionicons name="search" size={16} color={C.muted} style={{ marginRight: 8 }} />
                        <TextInput
                          ref={searchRef}
                          style={styles.searchInput}
                          value={clientSearch}
                          onChangeText={setClientSearch}
                          placeholder="Search existing clients by name…"
                          placeholderTextColor={C.muted}
                          autoCapitalize="words"
                        />
                        {clientSearch.length > 0 && (
                          <TouchableOpacity onPress={() => setClientSearch("")} style={styles.searchClear}>
                            <Text style={styles.searchClearText}>✕</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* ── Search results dropdown ── */}
                      {filteredClients.length > 0 && (
                        <View style={styles.dropdown}>
                          {filteredClients.map((c, idx) => (
                            <TouchableOpacity
                              key={c.email || idx}
                              style={[styles.dropdownRow, idx > 0 && styles.dropdownDivider]}
                              onPress={() => selectClient(c)}
                            >
                              <View style={styles.dropdownAvatar}>
                                <Text style={styles.dropdownAvatarText}>{initials(c.name)}</Text>
                              </View>
                              <View style={styles.dropdownInfo}>
                                <Text style={styles.dropdownName}>{c.name}</Text>
                                {c.phone ? <Text style={styles.dropdownMeta}>{c.phone}</Text> : null}
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}

                      {/* No results hint */}
                      {searchQuery.length >= 2 && filteredClients.length === 0 && (
                        <Text style={styles.noResultsText}>No existing clients match — fill in manually below</Text>
                      )}

                      {/* ── Manual entry (new client) ── */}
                      <View style={styles.manualSection}>
                        <Text style={styles.manualOrLabel}>
                          {searchQuery.length < 2 ? "Or enter new client details:" : "New client:"}
                        </Text>
                        <TextInput
                          style={styles.input}
                          value={name}
                          onChangeText={setName}
                          placeholder="Full name"
                          placeholderTextColor={C.muted}
                          autoCapitalize="words"
                        />
                        <TextInput
                          style={[styles.input, { marginTop: 8 }]}
                          value={phone}
                          onChangeText={setPhone}
                          placeholder="Phone number"
                          placeholderTextColor={C.muted}
                          keyboardType="phone-pad"
                        />
                        <TextInput
                          style={[styles.input, { marginTop: 8 }]}
                          value={email}
                          onChangeText={setEmail}
                          placeholder="Email address"
                          placeholderTextColor={C.muted}
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />
                      </View>
                    </>
                  )}
                </View>
              )}

              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={{ height: 16 }} />
            </ScrollView>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={submit} disabled={submitting}>
              <Text style={styles.submitBtnText}>{submitting ? "Booking…" : "Book →"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(44,24,16,0.4)" },
  sheet: { backgroundColor: C.cream, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "92%", paddingBottom: 32 },
  handle: { width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { fontFamily: serif, fontSize: 20, fontWeight: "700", color: C.espresso },
  closeX: { fontSize: 18, color: C.muted, padding: 4 },
  center: { padding: 40, alignItems: "center" },
  body: { paddingHorizontal: 20 },
  fieldWrap: { marginTop: 18 },
  fieldLabel: { fontSize: 10, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 },
  pillScroll: { marginHorizontal: -4 },
  pillRow: { flexDirection: "row", gap: 6, paddingHorizontal: 4 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.white },
  pillActive: { backgroundColor: C.espresso, borderColor: C.espresso },
  pillText: { fontSize: 12, fontWeight: "700", color: C.muted },
  pillTextActive: { color: C.cream },
  dateRow: { flexDirection: "row", alignItems: "center", backgroundColor: C.white, borderRadius: 10, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  dateArrow: { padding: 12, paddingHorizontal: 18 },
  dateArrowText: { fontSize: 22, color: C.espresso, fontWeight: "300", lineHeight: 26 },
  dateLabel: { flex: 1, textAlign: "center", fontSize: 14, fontWeight: "700", color: C.espresso },
  walkinRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 20, paddingVertical: 4 },
  walkinLabel: { fontSize: 14, fontWeight: "700", color: C.espresso },

  // Customer section
  customerSection: { marginTop: 20 },

  // Selected client chip
  selectedClientRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.white, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.espresso,
    padding: 10, marginTop: 8, gap: 10,
  },
  clientAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.espresso,
    alignItems: "center", justifyContent: "center",
  },
  clientAvatarText: { fontSize: 14, fontWeight: "800", color: C.cream },
  clientAvatarInfo: { flex: 1 },
  clientAvatarName: { fontSize: 14, fontWeight: "700", color: C.espresso },
  clientAvatarMeta: { fontSize: 11, color: C.muted, marginTop: 1 },
  clientClearBtn: { padding: 6 },
  clientClearText: { fontSize: 14, color: C.muted },

  // Search
  searchWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.white, borderRadius: 10,
    borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 12, marginTop: 8,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: C.espresso },
  searchClear: { padding: 6 },
  searchClearText: { fontSize: 13, color: C.muted },

  // Dropdown
  dropdown: {
    backgroundColor: C.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: 4,
    overflow: "hidden",
  },
  dropdownRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 10, gap: 10,
  },
  dropdownDivider: {
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  dropdownAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.surface,
    alignItems: "center", justifyContent: "center",
  },
  dropdownAvatarText: { fontSize: 12, fontWeight: "800", color: C.espresso },
  dropdownInfo: { flex: 1 },
  dropdownName: { fontSize: 13, fontWeight: "700", color: C.espresso },
  dropdownMeta: { fontSize: 11, color: C.muted, marginTop: 1 },

  noResultsText: { fontSize: 12, color: C.muted, marginTop: 8, fontStyle: "italic" },

  // Manual entry
  manualSection: { marginTop: 12 },
  manualOrLabel: { fontSize: 11, fontWeight: "600", color: C.muted, marginBottom: 8 },
  input: {
    backgroundColor: C.white, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, color: C.espresso,
  },

  repeatCountRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  repeatCountLabel: { fontSize: 12, color: C.muted, fontWeight: "600" },
  repeatCountBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: C.border, alignItems: "center", justifyContent: "center", backgroundColor: C.white },
  repeatCountBtnActive: { backgroundColor: C.espresso, borderColor: C.espresso },
  repeatCountText: { fontSize: 13, fontWeight: "700", color: C.muted },
  repeatCountTextActive: { color: C.cream },

  error: { fontSize: 13, color: C.terra, fontWeight: "600", marginTop: 12 },
  actions: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 12, gap: 10, borderTopWidth: 1, borderTopColor: C.border },
  cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, alignItems: "center" },
  cancelBtnText: { fontSize: 14, fontWeight: "700", color: C.espresso },
  submitBtn: { flex: 2, paddingVertical: 13, borderRadius: 10, backgroundColor: C.espresso, alignItems: "center" },
  submitBtnText: { fontSize: 14, fontWeight: "800", color: C.cream },
});
