import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  Switch, Alert, ActivityIndicator, Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../lib/api";
import { C, serif } from "../../lib/theme";

const { width: SCREEN_W } = Dimensions.get("window");
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const STEPS = [
  { key: "welcome", title: "Welcome to Clipd", sub: "Let's get your shop set up in under 2 minutes." },
  { key: "shop", title: "Your Shop", sub: "What's your barbershop called?" },
  { key: "hours", title: "Business Hours", sub: "When are you open?" },
  { key: "barber", title: "Your First Barber", sub: "Add yourself or a team member." },
  { key: "service", title: "Your First Service", sub: "What's your most popular cut?" },
  { key: "done", title: "You're All Set!", sub: "Your shop is ready to go." },
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

  // Barber
  const [barberName, setBarberName] = useState("");
  const [barberEmail, setBarberEmail] = useState("");

  // Service
  const [serviceName, setServiceName] = useState("");
  const [servicePrice, setServicePrice] = useState("");
  const [serviceDuration, setServiceDuration] = useState("30");

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

  async function saveBarber() {
    if (!barberName.trim()) { Alert.alert("Required", "Enter the barber's name"); return; }
    if (!barberEmail.trim()) { Alert.alert("Required", "Enter an email"); return; }
    setSaving(true);
    try {
      await api.adminBarberAdd({ name: barberName.trim(), email: barberEmail.trim().toLowerCase() });
      goNext();
    } catch (err) { Alert.alert("Error", err.message); }
    setSaving(false);
  }

  async function saveService() {
    if (!serviceName.trim()) { Alert.alert("Required", "Enter a service name"); return; }
    if (!servicePrice.trim()) { Alert.alert("Required", "Enter a price"); return; }
    setSaving(true);
    try {
      await api.adminAddService({
        name: serviceName.trim(),
        price: parseFloat(servicePrice),
        duration: parseInt(serviceDuration) || 30,
      });
      goNext();
    } catch (err) { Alert.alert("Error", err.message); }
    setSaving(false);
  }

  function finish() {
    navigation.reset({ index: 0, routes: [{ name: "AdminTabs" }] });
  }

  function toggleDay(day) {
    const current = hours[day];
    setHours({ ...hours, [day]: { ...current, open: !current.open } });
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
          <Text style={styles.welcomeIcon}>✂️</Text>
          <Text style={styles.stepTitle}>{STEPS[0].title}</Text>
          <Text style={styles.stepSub}>{STEPS[0].sub}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={goNext}>
            <Text style={styles.primaryBtnText}>Get Started →</Text>
          </TouchableOpacity>
        </View>

        {/* Step 1: Shop Info */}
        <View style={[styles.stepWrap, { width: SCREEN_W }]}>
          <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.stepTitle}>{STEPS[1].title}</Text>
            <Text style={styles.stepSub}>{STEPS[1].sub}</Text>
            <Text style={styles.label}>Shop Name *</Text>
            <TextInput style={styles.input} value={shopName} onChangeText={setShopName} placeholder="e.g. Crown Cutz" placeholderTextColor={C.muted} autoCapitalize="words" />
            <Text style={styles.label}>Address</Text>
            <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="123 Main St, Toronto" placeholderTextColor={C.muted} />
            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="416-555-0100" placeholderTextColor={C.muted} keyboardType="phone-pad" />
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.backBtn} onPress={goBack}><Text style={styles.backBtnText}>← Back</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.6 }]} onPress={saveShop} disabled={saving}>
                <Text style={styles.primaryBtnText}>{saving ? "Saving…" : "Next →"}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>

        {/* Step 2: Hours */}
        <View style={[styles.stepWrap, { width: SCREEN_W }]}>
          <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.stepTitle}>{STEPS[2].title}</Text>
            <Text style={styles.stepSub}>{STEPS[2].sub}</Text>
            {DAYS.map(day => {
              const h = hours[day];
              return (
                <View key={day} style={styles.hourRow}>
                  <Text style={styles.dayName}>{day.slice(0, 3)}</Text>
                  <Switch value={h.open} onValueChange={() => toggleDay(day)} trackColor={{ true: C.terra }} thumbColor={C.white} />
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
                <Text style={styles.primaryBtnText}>{saving ? "Saving…" : "Next →"}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>

        {/* Step 3: Barber */}
        <View style={[styles.stepWrap, { width: SCREEN_W }]}>
          <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.stepTitle}>{STEPS[3].title}</Text>
            <Text style={styles.stepSub}>{STEPS[3].sub}</Text>
            <Text style={styles.label}>Name *</Text>
            <TextInput style={styles.input} value={barberName} onChangeText={setBarberName} placeholder="e.g. Marcus Johnson" placeholderTextColor={C.muted} autoCapitalize="words" />
            <Text style={styles.label}>Email *</Text>
            <TextInput style={styles.input} value={barberEmail} onChangeText={setBarberEmail} placeholder="marcus@yourshop.com" placeholderTextColor={C.muted} keyboardType="email-address" autoCapitalize="none" />
            <Text style={styles.hint}>They'll receive an invite to create their staff account.</Text>
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.backBtn} onPress={goBack}><Text style={styles.backBtnText}>← Back</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.6 }]} onPress={saveBarber} disabled={saving}>
                <Text style={styles.primaryBtnText}>{saving ? "Saving…" : "Next →"}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>

        {/* Step 4: Service */}
        <View style={[styles.stepWrap, { width: SCREEN_W }]}>
          <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.stepTitle}>{STEPS[4].title}</Text>
            <Text style={styles.stepSub}>{STEPS[4].sub}</Text>
            <Text style={styles.label}>Service Name *</Text>
            <TextInput style={styles.input} value={serviceName} onChangeText={setServiceName} placeholder="e.g. Classic Haircut" placeholderTextColor={C.muted} autoCapitalize="words" />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Price ($) *</Text>
                <TextInput style={styles.input} value={servicePrice} onChangeText={setServicePrice} placeholder="35" placeholderTextColor={C.muted} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Duration (min)</Text>
                <TextInput style={styles.input} value={serviceDuration} onChangeText={setServiceDuration} placeholder="30" placeholderTextColor={C.muted} keyboardType="numeric" />
              </View>
            </View>
            <Text style={styles.hint}>You can add more services later in Settings.</Text>
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.backBtn} onPress={goBack}><Text style={styles.backBtnText}>← Back</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.6 }]} onPress={saveService} disabled={saving}>
                <Text style={styles.primaryBtnText}>{saving ? "Saving…" : "Next →"}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>

        {/* Step 5: Done */}
        <View style={[styles.stepWrap, { width: SCREEN_W }]}>
          <Text style={styles.doneIcon}>🎉</Text>
          <Text style={styles.stepTitle}>{STEPS[5].title}</Text>
          <Text style={styles.stepSub}>Your shop is configured and ready for bookings.</Text>
          <View style={styles.doneChecks}>
            <Text style={styles.doneCheck}>✓ Shop info saved</Text>
            <Text style={styles.doneCheck}>✓ Business hours set</Text>
            <Text style={styles.doneCheck}>✓ First barber added</Text>
            <Text style={styles.doneCheck}>✓ First service created</Text>
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={finish}>
            <Text style={styles.primaryBtnText}>Open Your Dashboard →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  progressRow: { flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: 16 },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.border },
  progressDotActive: { backgroundColor: C.terra, width: 24 },

  stepWrap: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  formScroll: { flex: 1, width: "100%", paddingHorizontal: 0 },
  welcomeIcon: { fontSize: 56, marginBottom: 20 },
  doneIcon: { fontSize: 56, marginBottom: 20 },
  stepTitle: { fontFamily: serif, fontSize: 28, fontWeight: "900", color: C.espresso, textAlign: "center", marginBottom: 8 },
  stepSub: { fontSize: 14, color: C.muted, textAlign: "center", marginBottom: 28, lineHeight: 20 },

  label: { fontSize: 10, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: C.white, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.espresso, borderWidth: 1, borderColor: C.border },
  hint: { fontSize: 11, color: C.muted, marginTop: 8, fontStyle: "italic" },

  hourRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  dayName: { width: 32, fontSize: 13, fontWeight: "700", color: C.espresso },
  timePair: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  timeInput: { flex: 1, backgroundColor: C.white, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, color: C.espresso, borderWidth: 1, borderColor: C.border, textAlign: "center" },
  timeDash: { fontSize: 13, color: C.muted },
  closedText: { fontSize: 12, color: C.muted, fontStyle: "italic" },

  btnRow: { flexDirection: "row", gap: 10, marginTop: 24, marginBottom: 40 },
  primaryBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: C.espresso, alignItems: "center" },
  primaryBtnText: { fontSize: 15, fontWeight: "800", color: C.cream },
  backBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, alignItems: "center" },
  backBtnText: { fontSize: 14, fontWeight: "700", color: C.muted },

  doneChecks: { marginBottom: 28, alignItems: "flex-start" },
  doneCheck: { fontSize: 15, fontWeight: "600", color: "#065F46", marginBottom: 8 },
});
