import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, RefreshControl, Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { C, serif } from "../../lib/theme";

const DAYS = [
  { label: "Monday", dow: 0 }, { label: "Tuesday", dow: 1 }, { label: "Wednesday", dow: 2 },
  { label: "Thursday", dow: 3 }, { label: "Friday", dow: 4 }, { label: "Saturday", dow: 5 },
  { label: "Sunday", dow: 6 },
];

export default function StaffSettingsScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);

  // Profile
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [phone, setPhone] = useState("");
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  // Bio
  const [bio, setBio] = useState("");
  const [yearsExp, setYearsExp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [savingBio, setSavingBio] = useState(false);
  const [bioMsg, setBioMsg] = useState("");

  // Availability
  const [availability, setAvailability] = useState([]);
  const [savingAvail, setSavingAvail] = useState(false);
  const [availMsg, setAvailMsg] = useState("");
  const [barberId, setBarberId] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [s, settings] = await Promise.all([
        api.staffStats(),
        api.adminSettings().catch(() => ({})),
      ]);
      setName(s.name || "");
      setHandle(s.handle || "");
      setPhone(s.phone || "");
      setBufferMinutes(s.buffer_minutes || 0);
      setBio(s.bio || "");
      setYearsExp(s.years_exp ? String(s.years_exp) : "");
      setInstagram(s.instagram || "");

      // Load availability for this barber
      const bid = settings.staff_barber_id;
      if (bid) {
        setBarberId(bid);
        const avail = await api.adminBarberAvailability(bid).catch(() => []);
        setAvailability(Array.isArray(avail) ? avail : []);
      }
    } catch {}
    setLoading(false);
  }

  async function saveProfile() {
    if (!name.trim()) { Alert.alert("Error", "Name is required"); return; }
    setSavingProfile(true); setProfileMsg("");
    try {
      await api.staffUpdateProfile({ name: name.trim(), handle: handle.trim(), phone: phone.trim(), buffer_minutes: bufferMinutes });
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

  function getAvailForDay(dow) {
    return availability.find(a => a.day_of_week === dow);
  }

  function toggleDay(dow) {
    const existing = getAvailForDay(dow);
    if (existing) {
      setAvailability(availability.filter(a => a.day_of_week !== dow));
    } else {
      setAvailability([...availability, { day_of_week: dow, start_time: "09:00", end_time: "19:00" }]);
    }
  }

  function updateDayTime(dow, field, value) {
    setAvailability(availability.map(a =>
      a.day_of_week === dow ? { ...a, [field]: value } : a
    ));
  }

  async function saveAvailability() {
    if (!barberId) return;
    setSavingAvail(true); setAvailMsg("");
    try {
      await api.adminSetBarberAvailability(barberId, availability);
      setAvailMsg("Saved!");
      setTimeout(() => setAvailMsg(""), 2000);
    } catch (err) { Alert.alert("Error", err.message); }
    setSavingAvail(false);
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
        <Text style={styles.pageTitle}>My Profile</Text>

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

            <Text style={styles.label}>Buffer After Each Booking</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {[0, 5, 10, 15, 20, 30].map(mins => (
                  <TouchableOpacity
                    key={mins}
                    style={[styles.bufferPill, bufferMinutes === mins && styles.bufferPillActive]}
                    onPress={() => setBufferMinutes(mins)}
                  >
                    <Text style={[styles.bufferPillText, bufferMinutes === mins && styles.bufferPillTextActive]}>
                      {mins === 0 ? "None" : `${mins} min`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

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

        {/* Availability Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Hours</Text>
          <View style={styles.card}>
            {DAYS.map(({ label, dow }) => {
              const avail = getAvailForDay(dow);
              const isOn = !!avail;
              return (
                <View key={dow} style={styles.availRow}>
                  <View style={styles.availDayRow}>
                    <Text style={[styles.availDay, !isOn && { color: C.muted }]}>{label}</Text>
                    <Switch
                      value={isOn}
                      onValueChange={() => toggleDay(dow)}
                      trackColor={{ false: C.border, true: C.terra }}
                      thumbColor={C.white}
                    />
                  </View>
                  {isOn && (
                    <View style={styles.availTimes}>
                      <TextInput
                        style={styles.timeInput}
                        value={avail.start_time}
                        onChangeText={v => updateDayTime(dow, "start_time", v)}
                        placeholder="09:00"
                        placeholderTextColor={C.muted}
                      />
                      <Text style={styles.timeDash}>–</Text>
                      <TextInput
                        style={styles.timeInput}
                        value={avail.end_time}
                        onChangeText={v => updateDayTime(dow, "end_time", v)}
                        placeholder="19:00"
                        placeholderTextColor={C.muted}
                      />
                    </View>
                  )}
                </View>
              );
            })}
            <TouchableOpacity style={[styles.saveBtn, savingAvail && { opacity: 0.6 }]} onPress={saveAvailability} disabled={savingAvail}>
              <Text style={styles.saveBtnText}>{savingAvail ? "Saving…" : "Save Hours"}</Text>
            </TouchableOpacity>
            {availMsg ? <Text style={styles.savedMsg}>{availMsg}</Text> : null}
          </View>
        </View>

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
  bufferPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.white },
  bufferPillActive: { backgroundColor: C.espresso, borderColor: C.espresso },
  bufferPillText: { fontSize: 12, fontWeight: "700", color: C.muted },
  bufferPillTextActive: { color: C.cream },
  saveBtn: { backgroundColor: C.espresso, paddingVertical: 13, borderRadius: 10, alignItems: "center", marginTop: 16 },
  saveBtnText: { color: C.cream, fontSize: 14, fontWeight: "700" },
  savedMsg: { fontSize: 12, color: "#059669", fontWeight: "600", textAlign: "center", marginTop: 8 },

  // Availability
  availRow: { borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 12 },
  availDayRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  availDay: { fontSize: 14, fontWeight: "600", color: C.espresso },
  availTimes: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  timeInput: {
    flex: 1, backgroundColor: C.surface, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 14, color: C.espresso, borderWidth: 1, borderColor: C.border, textAlign: "center",
  },
  timeDash: { fontSize: 16, color: C.muted },
});
