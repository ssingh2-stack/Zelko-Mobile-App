import { Ionicons } from "@expo/vector-icons";
import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  Switch, Alert, Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../lib/api";
import { F, C } from "../../lib/theme";
import { Symbol } from "../../components/Brand";
import AddressAutocomplete from "../../components/AddressAutocomplete";

const { width: SCREEN_W } = Dimensions.get("window");
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const STEPS = [
  { key: "welcome" },
  { key: "shop" },
  { key: "hours" },
  { key: "barber" },
  { key: "service" },
  { key: "done" },
];

export default function OnboardingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Shop
  const [shopName, setShopName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  // Hours
  const [hours, setHours] = useState(() => {
    const h = {};
    DAYS.forEach((d, i) => {
      h[d] = { open: i < 6, open_time: "09:00", close_time: "19:00" };
    });
    return h;
  });

  // Barbers (multiple)
  const [barbers, setBarbers] = useState([{ name: "", email: "" }]);
  const [savedBarbers, setSavedBarbers] = useState(0);

  // Services (multiple)
  const [services, setServices] = useState([{ name: "", price: "", duration: "30" }]);
  const [savedServices, setSavedServices] = useState(0);

  function goNext() {
    const next = step + 1;
    setStep(next);
    scrollRef.current?.scrollTo({ x: next * SCREEN_W, animated: true });
  }

  function goBack() {
    const prev = step - 1;
    setStep(prev);
    scrollRef.current?.scrollTo({ x: prev * SCREEN_W, animated: true });
  }

  async function saveShop() {
    if (!shopName.trim()) { Alert.alert("Required", "Enter your shop name"); return; }
    setSaving(true);
    try {
      await api.adminSaveInfo({ name: shopName.trim(), address: address.trim(), phone: phone.trim() });
      goNext();
    } catch (err) { Alert.alert("Error", err.message); }
    setSaving(false);
  }

  async function saveHours() {
    setSaving(true);
    try {
      await api.adminSaveHours(hours);
      goNext();
    } catch (err) { Alert.alert("Error", err.message); }
    setSaving(false);
  }

  async function saveBarbers() {
    const valid = barbers.filter(b => b.name.trim() && b.email.trim());
    if (valid.length === 0) { Alert.alert("Required", "Add at least one barber"); return; }
    setSaving(true);
    let count = 0;
    for (const b of valid) {
      try {
        await api.adminBarberAdd({ name: b.name.trim(), email: b.email.trim().toLowerCase() });
        count++;
      } catch (err) {
        if (valid.length === 1) { Alert.alert("Error", err.message); setSaving(false); return; }
      }
    }
    setSavedBarbers(count);
    setSaving(false);
    goNext();
  }

  async function saveServices() {
    const valid = services.filter(s => s.name.trim() && s.price.trim());
    if (valid.length === 0) { Alert.alert("Required", "Add at least one service"); return; }
    setSaving(true);
    let count = 0;
    for (const s of valid) {
      try {
        await api.adminAddService({
          name: s.name.trim(),
          price: parseFloat(s.price),
          duration_min: parseInt(s.duration) || 30,
        });
        count++;
      } catch (err) {
        if (valid.length === 1) { Alert.alert("Error", err.message); setSaving(false); return; }
      }
    }
    setSavedServices(count);
    setSaving(false);
    goNext();
  }

  function finish() {
    navigation.reset({ index: 0, routes: [{ name: "AdminTabs" }] });
  }

  function toggleDay(day) {
    const current = hours[day];
    setHours({ ...hours, [day]: { ...current, open: !current.open } });
  }

  function updateBarber(idx, field, val) {
    const updated = [...barbers];
    updated[idx] = { ...updated[idx], [field]: val };
    setBarbers(updated);
  }

  function addBarber() {
    setBarbers([...barbers, { name: "", email: "" }]);
  }

  function removeBarber(idx) {
    if (barbers.length <= 1) return;
    setBarbers(barbers.filter((_, i) => i !== idx));
  }

  function updateService(idx, field, val) {
    const updated = [...services];
    updated[idx] = { ...updated[idx], [field]: val };
    setServices(updated);
  }

  function addService() {
    setServices([...services, { name: "", price: "", duration: "30" }]);
  }

  function removeService(idx) {
    if (services.length <= 1) return;
    setServices(services.filter((_, i) => i !== idx));
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Progress */}
      <View style={styles.progressRow}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.progressDot, i <= step && styles.progressDotActive]} />
        ))}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
      >
        {/* Step 0: Welcome */}
        <View style={[styles.stepWrap, { width: SCREEN_W }]}>
          <View style={styles.welcomeIcon}><Symbol size={64} /></View>
          <Text style={styles.stepTitle}>Welcome to Zelko</Text>
          <Text style={styles.stepSub}>Add your hours, barbers and services. It takes a couple of minutes.</Text>
          <TouchableOpacity style={styles.welcomeBtn} onPress={goNext}>
            <Text style={styles.welcomeBtnText}>Get started</Text>
          </TouchableOpacity>
        </View>

        {/* Step 1: Shop Info */}
        <View style={[styles.stepWrap, { width: SCREEN_W }]}>
          <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.stepTitle}>Your shop</Text>
            <Text style={styles.stepSub}>What's your barbershop called?</Text>
            <Text style={styles.label}>Shop name</Text>
            <TextInput style={styles.input} value={shopName} onChangeText={setShopName} placeholder="Your shop name" placeholderTextColor={C.muted} autoCapitalize="words" />
            <Text style={styles.label}>Address</Text>
            <AddressAutocomplete value={address} onChange={setAddress} />
            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="416-555-0100" placeholderTextColor={C.muted} keyboardType="phone-pad" />
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.backBtn} onPress={goBack}><Text style={styles.backBtnText}>← Back</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.6 }]} onPress={saveShop} disabled={saving}>
                <Text style={styles.primaryBtnText}>{saving ? "Saving…" : "Next"}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>

        {/* Step 2: Hours */}
        <View style={[styles.stepWrap, { width: SCREEN_W }]}>
          <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.stepTitle}>Business hours</Text>
            <Text style={styles.stepSub}>When are you open?</Text>
            {DAYS.map(day => {
              const h = hours[day];
              return (
                <View key={day} style={styles.hourRow}>
                  <Text style={styles.dayName}>{day.slice(0, 3)}</Text>
                  <Switch value={h.open} onValueChange={() => toggleDay(day)} trackColor={{ true: C.blue }} thumbColor="#FFFFFF" activeThumbColor="#FFFFFF" />
                  {h.open ? (
                    <View style={styles.timePair}>
                      <TextInput
                        style={styles.timeInput}
                        value={h.open_time}
                        onChangeText={v => setHours({ ...hours, [day]: { ...h, open_time: v } })}
                        placeholder="09:00"
                        placeholderTextColor={C.muted}
                      />
                      <Text style={styles.timeDash}>–</Text>
                      <TextInput
                        style={styles.timeInput}
                        value={h.close_time}
                        onChangeText={v => setHours({ ...hours, [day]: { ...h, close_time: v } })}
                        placeholder="19:00"
                        placeholderTextColor={C.muted}
                      />
                    </View>
                  ) : (
                    <Text style={styles.closedText}>Closed</Text>
                  )}
                </View>
              );
            })}
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.backBtn} onPress={goBack}><Text style={styles.backBtnText}>← Back</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.6 }]} onPress={saveHours} disabled={saving}>
                <Text style={styles.primaryBtnText}>{saving ? "Saving…" : "Next"}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>

        {/* Step 3: Barbers */}
        <View style={[styles.stepWrap, { width: SCREEN_W }]}>
          <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.stepTitle}>Your team</Text>
            <Text style={styles.stepSub}>Add yourself and your barbers.</Text>
            {barbers.map((b, i) => (
              <View key={i} style={styles.multiCard}>
                {barbers.length > 1 && (
                  <TouchableOpacity style={styles.removeItem} onPress={() => removeBarber(i)}>
                    <Text style={styles.removeItemText}>✕</Text>
                  </TouchableOpacity>
                )}
                <Text style={styles.label}>Name *</Text>
                <TextInput style={styles.input} value={b.name} onChangeText={v => updateBarber(i, "name", v)} placeholder="Marcus Williams" placeholderTextColor={C.muted} autoCapitalize="words" />
                <Text style={styles.label}>Email *</Text>
                <TextInput style={styles.input} value={b.email} onChangeText={v => updateBarber(i, "email", v)} placeholder="marcus@yourshop.com" placeholderTextColor={C.muted} keyboardType="email-address" autoCapitalize="none" />
              </View>
            ))}
            <TouchableOpacity style={styles.addMoreBtn} onPress={addBarber}>
              <Text style={styles.addMoreText}>+ Add another barber</Text>
            </TouchableOpacity>
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.backBtn} onPress={goBack}><Text style={styles.backBtnText}>← Back</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.6 }]} onPress={saveBarbers} disabled={saving}>
                <Text style={styles.primaryBtnText}>{saving ? "Saving…" : "Next"}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>

        {/* Step 4: Services */}
        <View style={[styles.stepWrap, { width: SCREEN_W }]}>
          <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.stepTitle}>Your services</Text>
            <Text style={styles.stepSub}>What do you offer?</Text>
            {services.map((s, i) => (
              <View key={i} style={styles.multiCard}>
                {services.length > 1 && (
                  <TouchableOpacity style={styles.removeItem} onPress={() => removeService(i)}>
                    <Text style={styles.removeItemText}>✕</Text>
                  </TouchableOpacity>
                )}
                <Text style={styles.label}>Service name</Text>
                <TextInput style={styles.input} value={s.name} onChangeText={v => updateService(i, "name", v)} placeholder="Skin fade" placeholderTextColor={C.muted} autoCapitalize="words" />
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Price ($) *</Text>
                    <TextInput style={styles.input} value={s.price} onChangeText={v => updateService(i, "price", v)} placeholder="35" placeholderTextColor={C.muted} keyboardType="numeric" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Duration (min)</Text>
                    <TextInput style={styles.input} value={s.duration} onChangeText={v => updateService(i, "duration", v)} placeholder="30" placeholderTextColor={C.muted} keyboardType="numeric" />
                  </View>
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.addMoreBtn} onPress={addService}>
              <Text style={styles.addMoreText}>+ Add another service</Text>
            </TouchableOpacity>
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.backBtn} onPress={goBack}><Text style={styles.backBtnText}>← Back</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.6 }]} onPress={saveServices} disabled={saving}>
                <Text style={styles.primaryBtnText}>{saving ? "Saving…" : "Next"}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>

        {/* Step 5: Done */}
        <View style={[styles.stepWrap, { width: SCREEN_W }]}>
          <View style={styles.doneIcon}><Ionicons name="checkmark" size={32} color={C.onBlue} /></View>
          <Text style={styles.stepTitle}>You're set up.</Text>
          <Text style={styles.stepSub}>Share your booking link and clients can book straight away.</Text>
          <View style={styles.doneChecks}>
            <Text style={styles.doneCheck}>✓ Shop info saved</Text>
            <Text style={styles.doneCheck}>✓ Business hours set</Text>
            <Text style={styles.doneCheck}>✓ {savedBarbers || barbers.filter(b => b.name.trim()).length} barber{savedBarbers !== 1 ? "s" : ""} added</Text>
            <Text style={styles.doneCheck}>✓ {savedServices || services.filter(s => s.name.trim()).length} service{savedServices !== 1 ? "s" : ""} created</Text>
          </View>
          <TouchableOpacity style={styles.welcomeBtn} onPress={finish}>
            <Text style={styles.welcomeBtnText}>Open today's view</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.paper },
  progressRow: { flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: 16 },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.line },
  progressDotActive: { backgroundColor: C.blue, width: 24 },

  stepWrap: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  formScroll: { flex: 1, width: "100%", paddingHorizontal: 0 },
  welcomeIcon: { marginBottom: 24 },
  doneIcon: { width: 64, height: 64, borderRadius: 18, backgroundColor: C.blue, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  stepTitle: { fontSize: 32, fontFamily: F.regular, color: C.ink, letterSpacing: -1, textAlign: "center", marginBottom: 8 },
  stepSub: { fontFamily: F.regular, fontSize: 16, color: C.muted, textAlign: "center", marginBottom: 28, lineHeight: 23 },

  welcomeBtn: {
    width: 260, paddingVertical: 16, borderRadius: 12,
    backgroundColor: C.blue, alignItems: "center",
  },
  welcomeBtnText: { fontSize: 16, fontFamily: F.semibold, color: C.paper },

  label: { fontSize: 14, fontFamily: F.medium, color: C.ink, marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: F.regular, fontSize: 15, color: C.ink, borderWidth: 1, borderColor: C.line },
  hint: { fontFamily: F.regular, fontSize: 11, color: C.muted, marginTop: 8, fontStyle: "italic" },

  hourRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line },
  dayName: { width: 32, fontSize: 13, fontFamily: F.semibold, color: C.ink },
  timePair: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  timeInput: { flex: 1, backgroundColor: C.surface, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 6, fontFamily: F.regular, fontSize: 13, color: C.ink, borderWidth: 1, borderColor: C.line, textAlign: "center" },
  timeDash: { fontFamily: F.regular, fontSize: 13, color: C.muted },
  closedText: { fontFamily: F.regular, fontSize: 12, color: C.muted, fontStyle: "italic" },

  // Multi-item cards
  multiCard: {
    backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: C.line, position: "relative",
  },
  removeItem: {
    position: "absolute", top: 8, right: 8, zIndex: 1,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: C.dangerSoft, borderWidth: 1, borderColor: C.line,
    alignItems: "center", justifyContent: "center",
  },
  removeItemText: { fontSize: 12, color: C.danger, fontFamily: F.semibold },
  addMoreBtn: {
    paddingVertical: 12, alignItems: "center",
    borderWidth: 1, borderColor: C.line, borderRadius: 12, borderStyle: "dashed",
    marginBottom: 8,
  },
  addMoreText: { fontSize: 13, fontFamily: F.semibold, color: C.blue },

  btnRow: { flexDirection: "row", gap: 10, marginTop: 24, marginBottom: 40 },
  primaryBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: C.blue, alignItems: "center" },
  primaryBtnText: { fontSize: 15, fontFamily: F.semibold, color: C.paper },
  backBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: C.line, alignItems: "center" },
  backBtnText: { fontSize: 14, fontFamily: F.semibold, color: C.muted },

  doneChecks: { marginBottom: 28, alignItems: "flex-start" },
  doneCheck: { fontSize: 16, fontFamily: F.regular, color: C.ink, marginBottom: 10 },
});
