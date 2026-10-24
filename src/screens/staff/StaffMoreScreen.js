import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { F, C } from "../../lib/theme";
import { clearSession } from "../../lib/auth";
import { api } from "../../lib/api";

function MenuItem({ icon, label, onPress, color }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.menuIcon, color && { backgroundColor: color + "18" }]}>
        <Ionicons name={icon} size={20} color={color || C.ink} />
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
    Alert.alert("Log out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: async () => {
        await clearSession();
        navigation.reset({ index: 0, routes: [{ name: "Login" }] });
      }},
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert(
      "Delete account",
      "This will permanently delete your staff account and remove your profile. This cannot be undone.\n\nAre you sure?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => {
          Alert.prompt(
            "Confirm Deletion",
            'Type "DELETE" to confirm permanent account deletion.',
            [
              { text: "Cancel", style: "cancel" },
              { text: "Delete forever", style: "destructive", onPress: async (text) => {
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
          <MenuItem icon="person-outline" label="My profile" color={C.blue}
            onPress={() => navigation.navigate("StaffSettings")} />
          <MenuItem icon="notifications-outline" label="Notifications" color={C.blue}
            onPress={() => navigation.navigate("Notifications")} />
          <MenuItem icon="share-social-outline" label="Share your link" color={C.blue}
            onPress={() => navigation.navigate("Share")} />
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color={C.ink} />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
          <Text style={styles.deleteText}>Delete account</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.paper },
  scroll: { flex: 1, padding: 20 },
  title: { fontSize: 30, fontFamily: F.regular, color: C.ink, letterSpacing: -0.9, marginBottom: 20 },
  group: { backgroundColor: C.surface, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, overflow: "hidden", marginBottom: 20 },
  menuItem: { flexDirection: "row", alignItems: "center", padding: 12, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  menuIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: C.blueSoft, marginRight: 14 },
  menuLabel: { flex: 1, fontSize: 16, fontFamily: F.regular, color: C.ink },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 50, borderRadius: 12, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.surface },
  logoutText: { fontSize: 15, fontFamily: F.medium, color: C.ink },
  deleteBtn: { alignItems: "center", paddingVertical: 16, marginTop: 8 },
  deleteText: { fontSize: 15, fontFamily: F.medium, color: C.danger },
});
