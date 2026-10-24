import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, RefreshControl, Image, Switch, Share,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../lib/api";
import { F, C, DCAL_COLORS } from "../../../lib/theme";
import { success as hapticSuccess, warn as hapticWarn } from "../../../lib/haptics";
import { useToast, Toast } from "../../../components/Toast";

// Use the same color palette as the calendar
const COLORS = [
  "#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#C4683E", "#64509B",
];

export default function BarbersScreen() {
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const { showToast, toastProps } = useToast();
  const [editingId, setEditingId] = useState(null);
  const [editBio, setEditBio] = useState("");
  const [editYears, setEditYears] = useState("");
  const [editIG, setEditIG] = useState("");
  const [savingBio, setSavingBio] = useState(false);
  const [editAvail, setEditAvail] = useState({});
  const [savingAvail, setSavingAvail] = useState(false);
  const [shopHours, setShopHours] = useState({});
  const [allServices, setAllServices] = useState([]);
  const [editBarberServices, setEditBarberServices] = useState([]);
  const [savingServices, setSavingServices] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try { setBarbers(await api.adminBarbers()); }
    catch (err) { Alert.alert("Error", err.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    load();
    api.adminSettings().then(s => { if (s?.hours) setShopHours(s.hours); }).catch(() => {});
    api.adminServices().then(s => setAllServices(Array.isArray(s) ? s : [])).catch(() => {});
  }, []);

  async function addBarber() {
    setAddError("");
    if (!name.trim()) { setAddError("Barber name is required."); return; }
    if (!email.trim()) { setAddError("Email is required."); return; }
    setAdding(true);
    try {
      await api.adminBarberAdd({ name: name.trim(), email: email.trim().toLowerCase() });
      setName(""); setEmail("");
      hapticSuccess(); showToast("Barber added");
      load(true);
    } catch (err) { setAddError(err.message); }
    finally { setAdding(false); }
  }

  async function deleteBarber(id, barberName) {
    Alert.alert(
      "Remove barber?",
      `Remove ${barberName} from your team? Their past bookings won't be affected.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: async () => {
          try { await api.adminBarberDelete(id); hapticSuccess(); showToast("Barber removed"); load(true); }
          catch (err) { Alert.alert("Error", err.message); }
        }},
      ]
    );
  }

  function initials(n) {
    if (!n) return "?";
    const parts = n.trim().split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase()
      : n[0].toUpperCase();
  }

  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  // DB stores day_of_week as Python weekday(): Mon=0..Sun=6
  const DAY_MAP = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6 };

  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editBuffer, setEditBuffer] = useState(0);
  const scrollRef = useRef(null);
  const cardRefs = useRef({});

  function startEditBio(b) {
    // Scroll so this barber's card is at the top of the screen
    setTimeout(() => {
      const ref = cardRefs.current[b.id];
      if (ref && scrollRef.current) {
        ref.measureLayout(scrollRef.current.getInnerViewRef(), (x, y) => {
          scrollRef.current.scrollTo({ y: Math.max(0, y - 8), animated: true });
        }, () => {});
      }
    }, 150);
    setEditingId(b.id);
    setEditBio(b.bio || "");
    setEditYears(b.years_exp ? String(b.years_exp) : "");
    setEditIG(b.instagram || "");
    setEditEmail(b.email || "");
    setEditPhone(b.phone || "");
    setEditBuffer(b.buffer_minutes || 0);
    // Load barber services
    api.adminBarberServices(b.id).then(svcIds => {
      setEditBarberServices(Array.isArray(svcIds) ? svcIds.map(s => s.id || s.service_id || s) : []);
    }).catch(() => setEditBarberServices([]));
    // Load barber availability
    api.adminBarberAvailability(b.id).then(avail => {
      const map = {};
      DAYS.forEach(day => {
        const sh = shopHours[day];
        const dayNum = DAY_MAP[day];
        const existing = (avail || []).find(a => a.day_of_week === dayNum);
        if (existing) {
          map[day] = { on: true, start: existing.start_time, end: existing.end_time };
        } else if (sh?.open) {
          // Default to shop hours
          map[day] = { on: false, start: sh.open_time || "09:00", end: sh.close_time || "19:00" };
        } else {
          map[day] = { on: false, start: "09:00", end: "19:00" };
        }
      });
      setEditAvail(map);
    }).catch(() => {});
  }

  async function saveBio(barberId) {
    setSavingBio(true);
    try {
      await Promise.all([
        api.adminBarberBio(barberId, {
          bio: editBio.trim(),
          years_exp: editYears.trim(),
          instagram: editIG.trim().replace(/^@/, ""),
        }),
        api.adminBarberUpdate(barberId, {
          email: editEmail.trim().toLowerCase(),
          phone: editPhone.trim(),
          buffer_minutes: editBuffer,
        }),
      ]);
      setEditingId(null);
      hapticSuccess(); showToast("Profile saved");
      load(true);
    } catch (err) { Alert.alert("Error", err.message); }
    setSavingBio(false);
  }

  function toggleBarberService(svcId) {
    setEditBarberServices(prev =>
      prev.includes(svcId) ? prev.filter(id => id !== svcId) : [...prev, svcId]
    );
  }

  async function saveBarberServices(barberId) {
    setSavingServices(true);
    try {
      await api.adminSetBarberServices(barberId, editBarberServices);
      hapticSuccess(); showToast("Services updated");
    } catch (err) { Alert.alert("Error", err.message); }
    setSavingServices(false);
  }

  async function saveAvailability(barberId) {
    setSavingAvail(true);
    try {
      const days = [];
      DAYS.forEach(day => {
        const a = editAvail[day];
        if (a?.on) {
          days.push({ day_of_week: DAY_MAP[day], start_time: a.start, end_time: a.end });
        }
      });
      await api.adminSetBarberAvailability(barberId, days);
      hapticSuccess(); showToast("Availability saved");
    } catch (err) { Alert.alert("Error", err.message); }
    setSavingAvail(false);
  }

  function toggleAvailDay(day) {
    setEditAvail(prev => ({
      ...prev,
      [day]: { ...prev[day], on: !prev[day]?.on },
    }));
  }

  function updateAvailTime(day, field, val) {
    setEditAvail(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: val },
    }));
  }

  async function sendInvite(barberId, barberName) {
    try {
      const result = await api.adminBarberInvite(barberId);
      hapticSuccess();
      Alert.alert("Invite sent", `An invite email has been sent to ${barberName}. They can also use this link:\n\n${result.invite_url}`, [
        { text: "Copy link", onPress: () => Share.share({ message: result.invite_url }) },
        { text: "Done" },
      ]);
    } catch (err) { Alert.alert("Error", err.message); }
  }

  async function pickPhoto(barberId) {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    try {
      const asset = result.assets[0];
      await api.adminUpload(asset.uri, "barber", barberId, asset.mimeType);
      hapticSuccess(); showToast("Photo uploaded");
      load(true);
    } catch (err) {
      Alert.alert("Upload failed", err.message);
    }
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.ink} />}
      keyboardShouldPersistTaps="handled"
    >
      {/* Add Barber */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Add barber</Text>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Marcus Williams"
          placeholderTextColor={C.muted}
          autoCapitalize="words"
        />
        <Text style={[styles.label, { marginTop: 12 }]}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="barber@yourshop.com"
          placeholderTextColor={C.muted}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Text style={styles.hint}>They'll receive an invite to create their staff account.</Text>
        {addError ? <Text style={styles.error}>{addError}</Text> : null}
        <TouchableOpacity style={[styles.addBtn, adding && { opacity: 0.6 }]} onPress={addBarber} disabled={adding}>
          <Text style={styles.addBtnText}>{adding ? "Adding…" : "Add barber"}</Text>
        </TouchableOpacity>
      </View>

      {/* Barber list */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your team</Text>
        {loading ? (
          <ActivityIndicator color={C.ink} style={{ marginTop: 20 }} />
        ) : barbers.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No barbers yet — add your first team member above.</Text>
          </View>
        ) : (
          barbers.map((b, i) => {
            const color = COLORS[i % COLORS.length];
            return (
              <View key={b.id} style={styles.barberCard} ref={(r) => { cardRefs.current[b.id] = r; }}>
                <View style={styles.barberRow}>
                  <TouchableOpacity onPress={() => pickPhoto(b.id)} activeOpacity={0.7}>
                    {b.photo_url ? (
                      <Image source={{ uri: b.photo_url }} style={styles.avatarImg} />
                    ) : (
                      <View style={[styles.avatar, { backgroundColor: color + "22", borderColor: color }]}>
                        <Text style={[styles.avatarText, { color }]}>{initials(b.name)}</Text>
                      </View>
                    )}
                    <View style={styles.cameraIcon}><Ionicons name="camera" size={10} color={C.muted} /></View>
                  </TouchableOpacity>
                  <View style={styles.barberInfo}>
                    <Text style={styles.barberName}>{b.name}</Text>
                    <Text style={styles.barberEmail}>{b.email}</Text>
                    {b.bio ? <Text style={styles.barberBio} numberOfLines={1}>{b.bio}</Text> : null}
                    <View style={styles.barberMeta}>
                      {b.years_exp ? <Text style={styles.metaTag}>{b.years_exp}+ yrs</Text> : null}
                      {b.instagram ? <Text style={styles.metaTag}>@{b.instagram}</Text> : null}
                    </View>
                  </View>
                  <View style={styles.barberActions}>
                    <TouchableOpacity style={styles.editBtn} onPress={() => editingId === b.id ? setEditingId(null) : startEditBio(b)}>
                      <Text style={styles.editBtnText}>{editingId === b.id ? "Close" : "Edit"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.removeBtn} onPress={() => deleteBarber(b.id, b.name)}>
                      <Text style={styles.removeBtnText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Expanded edit form */}
                {editingId === b.id && (
                  <View style={styles.editSection}>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.editLabel}>Email</Text>
                        <TextInput
                          style={styles.editInput}
                          value={editEmail}
                          onChangeText={setEditEmail}
                          placeholder="barber@shop.com"
                          placeholderTextColor={C.muted}
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.editLabel}>Phone</Text>
                        <TextInput
                          style={styles.editInput}
                          value={editPhone}
                          onChangeText={setEditPhone}
                          placeholder="416-555-0100"
                          placeholderTextColor={C.muted}
                          keyboardType="phone-pad"
                        />
                      </View>
                    </View>
                    <Text style={styles.editLabel}>Buffer after each booking</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        {[0, 5, 10, 15, 20, 30].map(mins => (
                          <TouchableOpacity
                            key={mins}
                            style={[styles.editPill, editBuffer === mins && styles.editPillActive]}
                            onPress={() => setEditBuffer(mins)}
                          >
                            <Text style={[styles.editPillText, editBuffer === mins && styles.editPillTextActive]}>
                              {mins === 0 ? "None" : `${mins} min`}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                    <Text style={styles.editLabel}>Bio</Text>
                    <TextInput
                      style={[styles.editInput, { minHeight: 60, textAlignVertical: "top" }]}
                      value={editBio}
                      onChangeText={setEditBio}
                      placeholder="A short bio shown on the booking page…"
                      placeholderTextColor={C.muted}
                      multiline
                    />
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.editLabel}>Years of Experience</Text>
                        <TextInput
                          style={styles.editInput}
                          value={editYears}
                          onChangeText={setEditYears}
                          placeholder="e.g. 8"
                          placeholderTextColor={C.muted}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.editLabel}>Instagram handle</Text>
                        <TextInput
                          style={styles.editInput}
                          value={editIG}
                          onChangeText={setEditIG}
                          placeholder="e.g. fadeking"
                          placeholderTextColor={C.muted}
                          autoCapitalize="none"
                        />
                      </View>
                    </View>
                    <TouchableOpacity style={[styles.saveBioBtn, savingBio && { opacity: 0.6 }]} onPress={() => saveBio(b.id)} disabled={savingBio}>
                      <Text style={styles.saveBioBtnText}>{savingBio ? "Saving…" : "Save Profile"}</Text>
                    </TouchableOpacity>

                    {/* Availability */}
                    <View style={styles.availSection}>
                      <Text style={styles.availTitle}>Working hours</Text>
                      <Text style={styles.availHint}>Set when this barber is available for bookings</Text>
                      {DAYS.map(day => {
                        const a = editAvail[day] || {};
                        const sh = shopHours[day];
                        const shopClosed = sh && !sh.open;
                        return (
                          <View key={day} style={[styles.availRow, shopClosed && { opacity: 0.4 }]}>
                            <Text style={styles.availDay}>{day.slice(0, 3)}</Text>
                            <Switch
                              value={!!a.on && !shopClosed}
                              onValueChange={() => !shopClosed && toggleAvailDay(day)}
                              trackColor={{ true: C.blue }}
                              thumbColor="#FFFFFF" activeThumbColor="#FFFFFF"
                              disabled={shopClosed}
                            />
                            {a.on && !shopClosed ? (
                              <View style={styles.availTimes}>
                                <TextInput
                                  style={styles.availInput}
                                  value={a.start}
                                  onChangeText={v => updateAvailTime(day, "start", v)}
                                  placeholder="09:00"
                                  placeholderTextColor={C.muted}
                                />
                                <Text style={styles.availDash}>–</Text>
                                <TextInput
                                  style={styles.availInput}
                                  value={a.end}
                                  onChangeText={v => updateAvailTime(day, "end", v)}
                                  placeholder="19:00"
                                  placeholderTextColor={C.muted}
                                />
                              </View>
                            ) : (
                              <Text style={styles.availOff}>{shopClosed ? "Shop closed" : "Off"}</Text>
                            )}
                          </View>
                        );
                      })}
                      <TouchableOpacity style={[styles.saveBioBtn, savingAvail && { opacity: 0.6 }]} onPress={() => saveAvailability(b.id)} disabled={savingAvail}>
                        <Text style={styles.saveBioBtnText}>{savingAvail ? "Saving…" : "Save Availability"}</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Services offered */}
                    {allServices.length > 0 && (
                      <View style={styles.availSection}>
                        <Text style={styles.availTitle}>Services offered</Text>
                        <Text style={styles.availHint}>Toggle which services this barber performs</Text>
                        {allServices.map(s => {
                          const isOn = editBarberServices.includes(s.id);
                          return (
                            <View key={s.id} style={styles.svcRow}>
                              <Text style={styles.svcRowName}>{s.name}</Text>
                              <Switch
                                value={isOn}
                                onValueChange={() => toggleBarberService(s.id)}
                                trackColor={{ true: C.blue }}
                                thumbColor="#FFFFFF" activeThumbColor="#FFFFFF"
                              />
                            </View>
                          );
                        })}
                        <TouchableOpacity style={[styles.saveBioBtn, savingServices && { opacity: 0.6 }]} onPress={() => saveBarberServices(b.id)} disabled={savingServices}>
                          <Text style={styles.saveBioBtnText}>{savingServices ? "Saving…" : "Save Services"}</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Stripe Connect Status */}
                    <View style={styles.availSection}>
                      <Text style={styles.availTitle}>Stripe Connect</Text>
                      {b.stripe_connect_account_id ? (
                        <View style={styles.stripeStatusRow}>
                          <View style={styles.stripeConnectedDot} />
                          <Text style={styles.stripeConnectedText}>Connected</Text>
                        </View>
                      ) : (
                        <View>
                          <View style={styles.stripeStatusRow}>
                            <View style={styles.stripeDisconnectedDot} />
                            <Text style={styles.stripeDisconnectedText}>Not connected</Text>
                          </View>
                          <Text style={styles.availHint}>Connect via web dashboard to enable direct payouts</Text>
                        </View>
                      )}
                    </View>

                    {/* Staff invite */}
                    <View style={styles.availSection}>
                      <Text style={styles.availTitle}>Staff invite</Text>
                      <Text style={styles.availHint}>Send an invite so this barber can log in to their own staff portal</Text>
                      <TouchableOpacity style={styles.inviteBtn} onPress={() => sendInvite(b.id, b.name)}>
                        <Text style={styles.inviteBtnText}>Send invite</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}
      </View>

      <View style={{ height: 40 }} />
      <Toast {...toastProps} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.paper },
  card: { margin: 16, backgroundColor: C.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.line },
  cardTitle: { fontSize: 17, fontFamily: F.regular, color: C.ink, marginBottom: 14 },
  label: { fontSize: 14, fontFamily: F.medium, color: C.ink, marginBottom: 6 },
  input: { backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontFamily: F.regular, fontSize: 15, color: C.ink, borderWidth: 1, borderColor: C.lineStrong },
  hint: { fontFamily: F.regular, fontSize: 11, color: C.muted, marginTop: 8, marginBottom: 4, fontStyle: "italic" },
  error: { fontSize: 13, color: C.blue, fontFamily: F.semibold, marginBottom: 8 },
  addBtn: { backgroundColor: C.blue, borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: 12 },
  addBtnText: { fontSize: 14, fontFamily: F.semibold, color: C.paper },
  section: { marginHorizontal: 16 },
  sectionTitle: { fontSize: 17, fontFamily: F.regular, color: C.ink, marginBottom: 12 },
  barberCard: {
    backgroundColor: C.surface, borderRadius: 12, marginBottom: 8,
    borderWidth: 1, borderColor: C.line,
  },
  barberRow: {
    flexDirection: "row", alignItems: "center",
    padding: 14, gap: 12,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2,
  },
  avatarImg: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: C.line },
  cameraIcon: {
    position: "absolute", bottom: -2, right: -2,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.line,
    alignItems: "center", justifyContent: "center",
  },
  cameraText: {},
  avatarText: { fontSize: 16, fontFamily: F.regular },
  barberInfo: { flex: 1 },
  barberName: { fontSize: 15, fontFamily: F.semibold, color: C.ink },
  barberEmail: { fontFamily: F.regular, fontSize: 12, color: C.muted, marginTop: 1 },
  barberBio: { fontFamily: F.regular, fontSize: 11, color: C.muted, fontStyle: "italic", marginTop: 2 },
  barberMeta: { flexDirection: "row", gap: 8, marginTop: 3 },
  metaTag: { fontSize: 11, fontFamily: F.semibold, color: C.blue },
  barberActions: { gap: 6 },
  editBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.surface, alignItems: "center" },
  editBtnText: { fontSize: 14, fontFamily: F.medium, color: C.ink },
  editSection: {
    padding: 14, paddingTop: 0,
    borderTopWidth: 1, borderTopColor: C.line,
    marginTop: 0, paddingTop: 14,
  },
  editLabel: { fontSize: 14, fontFamily: F.medium, color: C.ink, marginBottom: 6, marginTop: 10 },
  editInput: { backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontFamily: F.regular, fontSize: 15, color: C.ink, borderWidth: 1, borderColor: C.lineStrong },
  editPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface },
  editPillActive: { backgroundColor: C.blue, borderColor: C.blue },
  editPillText: { fontSize: 12, fontFamily: F.semibold, color: C.muted },
  editPillTextActive: { color: C.onBlue },
  saveBioBtn: { backgroundColor: C.blue, borderRadius: 12, paddingVertical: 11, alignItems: "center", marginTop: 14 },
  saveBioBtnText: { fontSize: 13, fontFamily: F.semibold, color: C.paper },
  // Availability
  availSection: { marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.line },
  availTitle: { fontSize: 15, fontFamily: F.regular, color: C.ink, marginBottom: 2 },
  availHint: { fontFamily: F.regular, fontSize: 11, color: C.muted, marginBottom: 12, fontStyle: "italic" },
  availRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.line },
  availDay: { width: 30, fontSize: 12, fontFamily: F.semibold, color: C.ink },
  availTimes: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  availInput: { flex: 1, backgroundColor: C.surface, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5, fontFamily: F.regular, fontSize: 15, color: C.ink, borderWidth: 1, borderColor: C.lineStrong, textAlign: "center" },
  availDash: { fontFamily: F.regular, fontSize: 12, color: C.muted },
  availOff: { flex: 1, fontFamily: F.regular, fontSize: 11, color: C.muted, fontStyle: "italic" },
  // Service toggles
  svcRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line },
  svcRowName: { fontSize: 13, fontFamily: F.semibold, color: C.ink },
  // Invite
  inviteBtn: { backgroundColor: C.blue, borderRadius: 12, paddingVertical: 11, alignItems: "center", marginTop: 8 },
  inviteBtnText: { fontSize: 13, fontFamily: F.semibold, color: C.paper },
  // Stripe Connect
  stripeStatusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  stripeConnectedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.success },
  stripeConnectedText: { fontSize: 13, fontFamily: F.semibold, color: C.success },
  stripeDisconnectedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.muted },
  stripeDisconnectedText: { fontSize: 13, fontFamily: F.semibold, color: C.muted },
  removeBtn: { paddingHorizontal: 14, paddingVertical: 7, alignItems: "center" },
  removeBtnText: { fontSize: 14, fontFamily: F.medium, color: C.danger },
  empty: { paddingVertical: 24, alignItems: "center" },
  emptyText: { fontFamily: F.regular, fontSize: 13, color: C.muted, textAlign: "center", lineHeight: 20 },
});
