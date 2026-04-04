import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Switch, Image, RefreshControl,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { api } from "../../../lib/api";
import { C, serif } from "../../../lib/theme";
import { clearSession } from "../../../lib/auth";
import { success as hapticSuccess } from "../../../lib/haptics";
import AddressAutocomplete from "../../../components/AddressAutocomplete";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function Field({ label, value, onChange, placeholder, keyboardType, secureTextEntry }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
      />
    </View>
  );
}

export default function SettingsScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);

  // Shop info
  const [shopName, setShopName]   = useState("");
  const [address, setAddress]     = useState("");
  const [phone, setPhone]         = useState("");
  const [email, setEmail]         = useState("");
  const [googleUrl, setGoogleUrl] = useState("");
  const [slug, setSlug]           = useState("");
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoMsg, setInfoMsg] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  // Hours
  const [hours, setHours] = useState({});
  const [savingHours, setSavingHours] = useState(false);
  const [hoursMsg, setHoursMsg] = useState("");

  // Password
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw]         = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw]   = useState(false);
  const [pwMsg, setPwMsg]         = useState("");

  useEffect(() => {
    api.adminSettings().then(s => {
      setShopName(s.name || "");
      setAddress(s.address || "");
      setPhone(s.phone || "");
      setEmail(s.email || "");
      setGoogleUrl(s.google_review_url || "");
      setSlug(s.slug || "");
      setLogoUrl(s.logo_url || "");
      setHours(s.hours || {});
    }).catch(err => Alert.alert("Error", err.message))
      .finally(() => setLoading(false));
  }, []);

  async function saveInfo() {
    setSavingInfo(true); setInfoMsg("");
    try {
      await api.adminSaveInfo({ name: shopName, address, phone, email, google_review_url: googleUrl });
      setInfoMsg("Saved!");
      setTimeout(() => setInfoMsg(""), 2000);
    } catch (err) { Alert.alert("Error", err.message); }
    finally { setSavingInfo(false); }
  }

  async function saveHours() {
    setSavingHours(true); setHoursMsg("");
    try {
      await api.adminSaveHours(hours);
      setHoursMsg("Saved!");
      setTimeout(() => setHoursMsg(""), 2000);
    } catch (err) { Alert.alert("Error", err.message); }
    finally { setSavingHours(false); }
  }

  async function savePassword() {
    if (!currentPw) { Alert.alert("Error", "Enter your current password."); return; }
    if (!newPw)     { Alert.alert("Error", "Enter a new password."); return; }
    if (newPw !== confirmPw) { Alert.alert("Error", "Passwords don't match."); return; }
    setSavingPw(true); setPwMsg("");
    try {
      await api.adminSavePassword(currentPw, newPw);
      setPwMsg("Password updated!");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setTimeout(() => setPwMsg(""), 3000);
    } catch (err) { Alert.alert("Error", err.message); }
    finally { setSavingPw(false); }
  }

  async function pickLogo() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    try {
      const res = await api.adminUpload(result.assets[0].uri, "logo");
      setLogoUrl(res.url);
      hapticSuccess();
    } catch (err) { Alert.alert("Upload failed", err.message); }
  }

  async function handleLogout() {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: async () => {
        try { await api.logout(); } catch {}
        await clearSession();
        navigation.reset({ index: 0, routes: [{ name: "Login" }] });
      }},
    ]);
  }

  function toggleDay(day) {
    const current = hours[day] || { open: false, open_time: "09:00", close_time: "19:00" };
    setHours({ ...hours, [day]: { ...current, open: !current.open } });
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={C.espresso} /></View>;

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => { setLoading(true); api.adminSettings().then(s => { setShopName(s.name || ""); setAddress(s.address || ""); setPhone(s.phone || ""); setEmail(s.email || ""); setGoogleUrl(s.google_review_url || ""); setSlug(s.slug || ""); setLogoUrl(s.logo_url || ""); setHours(s.hours || {}); }).finally(() => setLoading(false)); }} tintColor={C.espresso} />}>

      {/* Shop Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Shop Info</Text>

        {/* Logo */}
        <TouchableOpacity style={styles.logoWrap} onPress={pickLogo}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.logoImg} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoPlaceholderText}>+</Text>
            </View>
          )}
          <Text style={styles.logoLabel}>{logoUrl ? "Change logo" : "Upload shop logo"}</Text>
        </TouchableOpacity>

        <Field label="Shop Name" value={shopName} onChange={setShopName} placeholder="Your shop name" />
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Address</Text>
          <AddressAutocomplete value={address} onChange={setAddress} />
        </View>
        <Field label="Phone" value={phone} onChange={setPhone} placeholder="416-555-0100" keyboardType="phone-pad" />
        <Field label="Email" value={email} onChange={setEmail} placeholder="hello@yourshop.com" keyboardType="email-address" />
        <Field label="Google Review Link" value={googleUrl} onChange={setGoogleUrl} placeholder="https://g.page/r/XXXXXXXX/review" keyboardType="url" />
        <View style={styles.noteRow}>
          <Text style={styles.noteText}>Booking URL: <Text style={styles.noteUrl}>app.getclipd.ca/book/{slug}</Text></Text>
        </View>
        <View style={styles.saveRow}>
          <TouchableOpacity style={[styles.saveBtn, savingInfo && { opacity: 0.6 }]} onPress={saveInfo} disabled={savingInfo}>
            <Text style={styles.saveBtnText}>{savingInfo ? "Saving…" : "Save Info"}</Text>
          </TouchableOpacity>
          {infoMsg ? <Text style={styles.savedMsg}>{infoMsg}</Text> : null}
        </View>
      </View>

      {/* Business Hours */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Business Hours</Text>
        {DAYS.map(day => {
          const h = hours[day] || { open: false, open_time: "09:00", close_time: "19:00" };
          return (
            <View key={day} style={styles.hourRow}>
              <Text style={styles.dayName}>{day.slice(0, 3)}</Text>
              <Switch
                value={h.open}
                onValueChange={() => toggleDay(day)}
                trackColor={{ true: C.terra }}
                thumbColor={C.white}
              />
              {h.open && (
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
              )}
              {!h.open && <Text style={styles.closed}>Closed</Text>}
            </View>
          );
        })}
        <View style={styles.saveRow}>
          <TouchableOpacity style={[styles.saveBtn, savingHours && { opacity: 0.6 }]} onPress={saveHours} disabled={savingHours}>
            <Text style={styles.saveBtnText}>{savingHours ? "Saving…" : "Save Hours"}</Text>
          </TouchableOpacity>
          {hoursMsg ? <Text style={styles.savedMsg}>{hoursMsg}</Text> : null}
        </View>
      </View>

      {/* Change Password */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Change Password</Text>
        <Field label="Current Password" value={currentPw} onChange={setCurrentPw} placeholder="••••••••" secureTextEntry />
        <Field label="New Password" value={newPw} onChange={setNewPw} placeholder="Min. 6 characters" secureTextEntry />
        <Field label="Confirm New Password" value={confirmPw} onChange={setConfirmPw} placeholder="Repeat new password" secureTextEntry />
        <View style={styles.saveRow}>
          <TouchableOpacity style={[styles.saveBtn, savingPw && { opacity: 0.6 }]} onPress={savePassword} disabled={savingPw}>
            <Text style={styles.saveBtnText}>{savingPw ? "Updating…" : "Update Password"}</Text>
          </TouchableOpacity>
          {pwMsg ? <Text style={styles.savedMsg}>{pwMsg}</Text> : null}
        </View>
      </View>

      {/* Logout */}
      <View style={[styles.card, { marginTop: 24 }]}>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: { margin: 16, marginBottom: 0, backgroundColor: C.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border },
  cardTitle: { fontFamily: serif, fontSize: 17, fontWeight: "700", color: C.espresso, marginBottom: 14 },
  fieldWrap: { marginBottom: 12 },
  label: { fontSize: 10, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 },
  input: { backgroundColor: C.surface, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.espresso, borderWidth: 1, borderColor: C.border },
  noteRow: { backgroundColor: C.surface, borderRadius: 8, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  noteText: { fontSize: 12, color: C.muted },
  noteUrl: { color: C.espresso, fontWeight: "600" },
  saveRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  saveBtn: { backgroundColor: C.espresso, borderRadius: 9, paddingVertical: 11, paddingHorizontal: 20 },
  saveBtnText: { fontSize: 14, fontWeight: "800", color: C.cream },
  savedMsg: { fontSize: 13, fontWeight: "600", color: "#065F46" },
  hourRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  dayName: { width: 32, fontSize: 13, fontWeight: "700", color: C.espresso },
  timePair: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  timeInput: { flex: 1, backgroundColor: C.surface, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, color: C.espresso, borderWidth: 1, borderColor: C.border, textAlign: "center" },
  timeDash: { fontSize: 13, color: C.muted },
  closed: { fontSize: 12, color: C.muted, fontStyle: "italic" },
  logoWrap: { alignItems: "center", marginBottom: 16 },
  logoImg: { width: 80, height: 80, borderRadius: 14, borderWidth: 2, borderColor: C.border },
  logoPlaceholder: {
    width: 80, height: 80, borderRadius: 14,
    borderWidth: 2, borderColor: C.border, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center", backgroundColor: C.surface,
  },
  logoPlaceholderText: { fontSize: 28, color: C.muted, fontWeight: "300" },
  logoLabel: { fontSize: 11, color: C.terra, fontWeight: "700", marginTop: 6 },
  logoutBtn: {
    paddingVertical: 14, borderRadius: 10,
    backgroundColor: "#FEF2F2", borderWidth: 1.5, borderColor: "#FECACA",
    alignItems: "center",
  },
  logoutText: { fontSize: 15, fontWeight: "800", color: "#DC2626" },
});
