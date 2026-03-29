import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, RefreshControl,
} from "react-native";
import { api } from "../../../lib/api";
import { C, serif, DCAL_COLORS } from "../../../lib/theme";

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

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try { setBarbers(await api.adminBarbers()); }
    catch (err) { Alert.alert("Error", err.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  async function addBarber() {
    setAddError("");
    if (!name.trim()) { setAddError("Barber name is required."); return; }
    if (!email.trim()) { setAddError("Email is required."); return; }
    setAdding(true);
    try {
      await api.adminBarberAdd({ name: name.trim(), email: email.trim().toLowerCase() });
      setName(""); setEmail("");
      load(true);
    } catch (err) { setAddError(err.message); }
    finally { setAdding(false); }
  }

  async function deleteBarber(id, barberName) {
    Alert.alert(
      "Remove Barber",
      `Remove ${barberName} from your team? Their past bookings won't be affected.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: async () => {
          try { await api.adminBarberDelete(id); load(true); }
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

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.espresso} />}
      keyboardShouldPersistTaps="handled"
    >
      {/* Add Barber */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Add Barber</Text>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Marcus Johnson"
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
          <Text style={styles.addBtnText}>{adding ? "Adding…" : "Add Barber →"}</Text>
        </TouchableOpacity>
      </View>

      {/* Barber list */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Team</Text>
        {loading ? (
          <ActivityIndicator color={C.espresso} style={{ marginTop: 20 }} />
        ) : barbers.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No barbers yet — add your first team member above.</Text>
          </View>
        ) : (
          barbers.map((b, i) => {
            const color = COLORS[i % COLORS.length];
            return (
              <View key={b.id} style={styles.barberRow}>
                <View style={[styles.avatar, { backgroundColor: color + "22", borderColor: color }]}>
                  <Text style={[styles.avatarText, { color }]}>{initials(b.name)}</Text>
                </View>
                <View style={styles.barberInfo}>
                  <Text style={styles.barberName}>{b.name}</Text>
                  <Text style={styles.barberEmail}>{b.email}</Text>
                </View>
                <TouchableOpacity style={styles.removeBtn} onPress={() => deleteBarber(b.id, b.name)}>
                  <Text style={styles.removeBtnText}>Remove</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  card: { margin: 16, backgroundColor: C.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border },
  cardTitle: { fontFamily: serif, fontSize: 17, fontWeight: "700", color: C.espresso, marginBottom: 14 },
  label: { fontSize: 10, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 },
  input: { backgroundColor: C.surface, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: C.espresso, borderWidth: 1, borderColor: C.border },
  hint: { fontSize: 11, color: C.muted, marginTop: 8, marginBottom: 4, fontStyle: "italic" },
  error: { fontSize: 13, color: C.terra, fontWeight: "600", marginBottom: 8 },
  addBtn: { backgroundColor: C.espresso, borderRadius: 9, paddingVertical: 12, alignItems: "center", marginTop: 12 },
  addBtnText: { fontSize: 14, fontWeight: "800", color: C.cream },
  section: { marginHorizontal: 16 },
  sectionTitle: { fontFamily: serif, fontSize: 17, fontWeight: "700", color: C.espresso, marginBottom: 12 },
  barberRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.white, borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: C.border, gap: 12,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2,
  },
  avatarText: { fontFamily: serif, fontSize: 16, fontWeight: "800" },
  barberInfo: { flex: 1 },
  barberName: { fontSize: 15, fontWeight: "700", color: C.espresso },
  barberEmail: { fontSize: 12, color: C.muted, marginTop: 2 },
  removeBtn: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 7, borderWidth: 1.5, borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
  },
  removeBtnText: { fontSize: 12, fontWeight: "700", color: "#DC2626" },
  empty: { paddingVertical: 24, alignItems: "center" },
  emptyText: { fontSize: 13, color: C.muted, textAlign: "center", lineHeight: 20 },
});
