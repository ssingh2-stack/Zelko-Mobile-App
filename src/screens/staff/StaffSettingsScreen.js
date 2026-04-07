import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { C, serif } from "../../lib/theme";
import { clearSession } from "../../lib/auth";
import { useNavigation } from "@react-navigation/native";

export default function StaffSettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);

  // Profile
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  // Bio
  const [bio, setBio] = useState("");
  const [yearsExp, setYearsExp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [savingBio, setSavingBio] = useState(false);
  const [bioMsg, setBioMsg] = useState("");

  // Stats
  const [stats, setStats] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const s = await api.staffStats();
      setStats(s);
      // staffStats returns barber info
      setName(s.name || "");
      setHandle(s.handle || "");
      setPhone(s.phone || "");
      setBio(s.bio || "");
      setYearsExp(s.years_exp ? String(s.years_exp) : "");
      setInstagram(s.instagram || "");
    } catch {}
    setLoading(false);
  }

  async function saveProfile() {
    if (!name.trim()) { Alert.alert("Error", "Name is required"); return; }
    setSavingProfile(true); setProfileMsg("");
    try {
      await api.staffUpdateProfile({ name: name.trim(), handle: handle.trim(), phone: phone.trim() });
      setProfileMsg("Saved!");
      setTimeout(() => setProfileMsg(""), 2000);
    } catch (err) { Alert.alert("Error", err.message); }
    setSavingProfile(false);
  }

  async function saveBioInfo() {
    setSavingBio(true); setBioMsg("");
    try {
      await api.staffUpdateBio({ bio: bio.trim(), years_exp: yearsExp.trim(), instagram: instagram.trim() });
      setBioMsg("Saved!");
      setTimeout(() => setBioMsg(""), 2000);
    } catch (err) { Alert.alert("Error", err.message); }
    setSavingBio(false);
  }

  async function handleLogout() {
    Alert.alert("Log Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: async () => {
        try { await api.logout(); } catch {}
        await clearSession();
        navigation.reset({ index: 0, routes: [{ name: "Login" }] });
      }},
    ]);
  }

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.center}><ActivityIndicator color={C.espresso} size="large" /></View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={C.espresso} />}
      >
        <Text style={styles.pageTitle}>Settings</Text>

        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={C.muted} />

            <Text style={styles.label}>Handle</Text>
            <TextInput style={styles.input} value={handle} onChangeText={setHandle} placeholder="@yourhandle" placeholderTextColor={C.muted} autoCapitalize="none" />

            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="416-555-0000" placeholderTextColor={C.muted} keyboardType="phone-pad" />

            <TouchableOpacity style={[styles.saveBtn, savingProfile && { opacity: 0.6 }]} onPress={saveProfile} disabled={savingProfile}>
              <Text style={styles.saveBtnText}>{savingProfile ? "Saving…" : "Save Profile"}</Text>
            </TouchableOpacity>
            {profileMsg ? <Text style={styles.savedMsg}>{profileMsg}</Text> : null}
          </View>
        </View>

        {/* Bio Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About You</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
              value={bio} onChangeText={setBio}
              placeholder="Tell clients about yourself…"
              placeholderTextColor={C.muted}
              multiline
            />

            <Text style={styles.label}>Years of Experience</Text>
            <TextInput style={styles.input} value={yearsExp} onChangeText={setYearsExp} placeholder="e.g. 5" placeholderTextColor={C.muted} keyboardType="number-pad" />

            <Text style={styles.label}>Instagram</Text>
            <TextInput style={styles.input} value={instagram} onChangeText={setInstagram} placeholder="@yourinsta" placeholderTextColor={C.muted} autoCapitalize="none" />

            <TouchableOpacity style={[styles.saveBtn, savingBio && { opacity: 0.6 }]} onPress={saveBioInfo} disabled={savingBio}>
              <Text style={styles.saveBtnText}>{savingBio ? "Saving…" : "Save"}</Text>
            </TouchableOpacity>
            {bioMsg ? <Text style={styles.savedMsg}>{bioMsg}</Text> : null}
          </View>
        </View>

        {/* Stats */}
        {stats && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Stats</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statVal}>{stats.today_count ?? 0}</Text>
                <Text style={styles.statLbl}>Today</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statVal}>{stats.week_count ?? 0}</Text>
                <Text style={styles.statLbl}>This Week</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statVal}>{stats.month_count ?? 0}</Text>
                <Text style={styles.statLbl}>This Month</Text>
              </View>
            </View>
          </View>
        )}

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#DC2626" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { flex: 1 },
  pageTitle: { fontFamily: serif, fontSize: 28, fontWeight: "900", color: C.espresso, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },

  section: { paddingHorizontal: 20, marginBottom: 8 },
  sectionTitle: { fontFamily: serif, fontSize: 16, fontWeight: "700", color: C.espresso, marginBottom: 10 },
  card: { backgroundColor: C.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border },
  label: { fontSize: 10, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: C.surface, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 14, color: C.espresso, borderWidth: 1, borderColor: C.border,
  },
  saveBtn: { backgroundColor: C.espresso, paddingVertical: 13, borderRadius: 10, alignItems: "center", marginTop: 16 },
  saveBtnText: { color: C.cream, fontSize: 14, fontWeight: "700" },
  savedMsg: { fontSize: 12, color: "#059669", fontWeight: "600", textAlign: "center", marginTop: 8 },

  statsGrid: { flexDirection: "row", gap: 8 },
  statCard: { flex: 1, backgroundColor: C.white, borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 1, borderColor: C.border },
  statVal: { fontFamily: serif, fontSize: 22, fontWeight: "900", color: C.espresso },
  statLbl: { fontSize: 9, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginTop: 4 },

  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginHorizontal: 20, marginTop: 20, paddingVertical: 14, borderRadius: 10,
    borderWidth: 1.5, borderColor: "#FCA5A5", backgroundColor: "#FEF2F2",
  },
  logoutText: { fontSize: 14, fontWeight: "700", color: "#DC2626" },
});
