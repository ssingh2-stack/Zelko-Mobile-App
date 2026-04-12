import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, Switch, Alert, ActivityIndicator, Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../lib/api";
import { C, serif } from "../../../lib/theme";
import {
  registerForPushNotifications,
  getCachedPushToken,
} from "../../../lib/pushNotifications";

export default function NotificationsScreen({ mode = "admin" }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [barbers, setBarbers] = useState([]);
  const [staffPref, setStaffPref] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      if (mode === "admin") {
        const data = await api.adminGetNotifications();
        setBarbers(Array.isArray(data?.barbers) ? data.barbers : []);
      } else {
        const data = await api.staffGetNotifications();
        setStaffPref(!!data?.notify_new_bookings);
      }
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  }

  async function ensureRegistered(barberId) {
    const result = await registerForPushNotifications({ role: mode, barberId });
    if (!result.ok) {
      if (result.reason === "permission_denied") {
        Alert.alert(
          "Notifications blocked",
          "Enable notifications for Clipd in your iPhone Settings to receive new booking alerts.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ]
        );
      } else {
        Alert.alert("Couldn't enable notifications", result.reason || "Please try again.");
      }
      return false;
    }
    return true;
  }

  async function toggleAdminBarber(barber, on) {
    if (busy) return;
    setBusy(true);
    try {
      if (on) {
        const ok = await ensureRegistered(barber.id);
        if (!ok) { setBusy(false); return; }
      }
      await api.adminUpdateNotifications(barber.id, on);
      setBarbers(prev =>
        prev.map(b => b.id === barber.id ? { ...b, notify_new_bookings: on ? 1 : 0 } : b)
      );
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleStaff(on) {
    if (busy) return;
    setBusy(true);
    try {
      if (on) {
        const ok = await ensureRegistered();
        if (!ok) { setBusy(false); return; }
      }
      await api.staffUpdateNotifications(on);
      setStaffPref(on);
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={C.terra} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <View style={styles.headerBox}>
        <View style={styles.headerIcon}>
          <Ionicons name="notifications-outline" size={22} color={C.terra} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Push Notifications</Text>
          <Text style={styles.headerSub}>
            Get an instant alert on this device when a new booking comes in.
          </Text>
        </View>
      </View>

      {mode === "admin" ? (
        <>
          <Text style={styles.sectionLabel}>NOTIFY ME ABOUT BOOKINGS FOR</Text>
          <View style={styles.card}>
            {barbers.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No barbers yet. Add one in Team first.</Text>
              </View>
            ) : (
              barbers.map((b, idx) => (
                <View key={b.id} style={[styles.row, idx < barbers.length - 1 && styles.rowBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>{b.name}</Text>
                    <Text style={styles.rowSub}>New booking alerts</Text>
                  </View>
                  <Switch
                    value={!!b.notify_new_bookings}
                    onValueChange={(v) => toggleAdminBarber(b, v)}
                    trackColor={{ false: C.border, true: C.terra }}
                    thumbColor="#fff"
                    disabled={busy}
                  />
                </View>
              ))
            )}
          </View>
          <Text style={styles.helperText}>
            Turning a barber ON registers this device to receive their new-booking pushes. You can
            enable multiple barbers if you cover for several chairs.
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.sectionLabel}>YOUR ALERTS</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>New bookings</Text>
                <Text style={styles.rowSub}>Push alert when a customer books with you</Text>
              </View>
              <Switch
                value={staffPref}
                onValueChange={toggleStaff}
                trackColor={{ false: C.border, true: C.terra }}
                thumbColor="#fff"
                disabled={busy}
              />
            </View>
          </View>
        </>
      )}

      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={16} color={C.muted} style={{ marginTop: 1 }} />
        <Text style={styles.infoText}>
          Notifications are sent only for confirmed online bookings. Walk-ins and bookings you create
          yourself don't trigger an alert.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  center: { alignItems: "center", justifyContent: "center" },
  headerBox: {
    flexDirection: "row", gap: 12, padding: 18,
    backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerIcon: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: "rgba(196,104,62,0.1)",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  headerTitle: { fontFamily: serif, fontSize: 20, fontWeight: "900", color: C.espresso, marginBottom: 4 },
  headerSub: { fontSize: 12, color: C.muted, lineHeight: 16 },
  sectionLabel: {
    fontSize: 11, fontWeight: "800", color: C.muted, letterSpacing: 1.2,
    marginHorizontal: 20, marginTop: 22, marginBottom: 8,
  },
  card: {
    backgroundColor: C.white, marginHorizontal: 16,
    borderRadius: 12, borderWidth: 1, borderColor: C.border, overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  rowLabel: { fontSize: 15, fontWeight: "700", color: C.espresso },
  rowSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  emptyBox: { padding: 24, alignItems: "center" },
  emptyText: { fontSize: 13, color: C.muted },
  helperText: { fontSize: 11, color: C.muted, lineHeight: 16, marginHorizontal: 20, marginTop: 10 },
  infoBox: {
    flexDirection: "row", gap: 8,
    marginHorizontal: 16, marginTop: 24, padding: 14,
    backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border,
  },
  infoText: { flex: 1, fontSize: 11, color: C.muted, lineHeight: 16 },
});
