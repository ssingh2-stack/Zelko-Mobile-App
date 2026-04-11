import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { C, serif } from "../../lib/theme";
import { clearSession } from "../../lib/auth";
import { api } from "../../lib/api";

function MenuItem({ icon, label, onPress, color }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.menuIcon, color && { backgroundColor: color + "18" }]}>
        <Ionicons name={icon} size={20} color={color || C.espresso} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={C.muted} />
    </TouchableOpacity>
  );
}

export default function StaffMoreScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  async function handleLogout() {
    Alert.alert("Log Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: async () => {
        await clearSession();
        navigation.reset({ index: 0, routes: [{ name: "Login" }] });
      }},
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your staff account and remove your profile. This cannot be undone.\n\nAre you sure?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => {
          Alert.prompt(
            "Confirm Deletion",
            'Type "DELETE" to confirm permanent account deletion.',
            [
              { text: "Cancel", style: "cancel" },
              { text: "Delete Forever", style: "destructive", onPress: async (text) => {
                if (text !== "DELETE") {
                  Alert.alert("Error", 'You must type "DELETE" to confirm.');
                  return;
                }
                try {
                  await api.deleteAccount("DELETE");
                  await clearSession();
                  navigation.reset({ index: 0, routes: [{ name: "Login" }] });
                } catch (err) {
                  Alert.alert("Error", err.message);
                }
              }},
            ],
            "plain-text"
          );
        }},
      ]
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView style={styles.scroll}>
        <Text style={styles.title}>More</Text>

        <View style={styles.group}>
          <MenuItem icon="person-outline" label="My Profile" color="#6366F1"
            onPress={() => navigation.navigate("StaffSettings")} />
          <MenuItem icon="notifications-outline" label="Notifications" color="#C4683E"
            onPress={() => navigation.navigate("Notifications")} />
          <MenuItem icon="share-social-outline" label="Share Booking Link" color="#059669"
            onPress={() => navigation.navigate("Share")} />
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#DC2626" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.logoutBtn, { marginTop: 12, borderColor: "#E5E7EB", backgroundColor: C.white }]} onPress={handleDeleteAccount}>
          <Ionicons name="trash-outline" size={18} color="#9CA3AF" />
          <Text style={[styles.logoutText, { color: "#9CA3AF" }]}>Delete Account</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  scroll: { flex: 1, padding: 20 },
  title: { fontFamily: serif, fontSize: 28, fontWeight: "900", color: C.espresso, marginBottom: 20 },
  group: {
    backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    overflow: "hidden", marginBottom: 20,
  },
  menuItem: {
    flexDirection: "row", alignItems: "center", padding: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  menuIcon: {
    width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center",
    backgroundColor: C.surface, marginRight: 12,
  },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: C.espresso },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 14, borderRadius: 10,
    borderWidth: 1.5, borderColor: "#FCA5A5", backgroundColor: "#FEF2F2",
  },
  logoutText: { fontSize: 14, fontWeight: "700", color: "#DC2626" },
});
