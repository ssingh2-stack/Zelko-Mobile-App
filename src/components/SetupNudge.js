import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { api } from "../lib/api";
import { F, C } from "../lib/theme";

const CHECKS = [
  {
    key: "hours",
    check: async () => {
      const s = await api.adminSettings();
      const h = s?.hours || {};
      return Object.values(h).some(d => d.open);
    },
    label: "Set your business hours",
    hint: "Clients can only book when you're open.",
    screen: "Settings",
  },
  {
    key: "barbers",
    check: async () => {
      const b = await api.adminBarbers();
      return (Array.isArray(b) ? b : []).length > 0;
    },
    label: "Add your first barber",
    hint: "You need at least one barber to take bookings.",
    screen: "Barbers",
  },
  {
    key: "services",
    check: async () => {
      const s = await api.adminServices();
      return (Array.isArray(s) ? s : []).length > 0;
    },
    label: "Add a service",
    hint: "Clients pick a service when they book.",
    screen: "Services",
  },
];

export default function SetupNudge({ navigation }) {
  const [nudge, setNudge] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const c of CHECKS) {
        try {
          const ok = await c.check();
          if (!ok && !cancelled) { setNudge(c); return; }
        } catch {}
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!nudge || dismissed) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.content}>
        <Text style={styles.label}>{nudge.label}</Text>
        <Text style={styles.hint}>{nudge.hint}</Text>
      </View>
      <TouchableOpacity
        style={styles.goBtn}
        onPress={() => {
          setDismissed(true);
          navigation?.navigate("More", { screen: nudge.screen });
        }}
      >
        <Text style={styles.goBtnText}>Set up</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.dismiss} onPress={() => setDismissed(true)} accessibilityLabel="Dismiss">
        <Ionicons name="close" size={18} color={C.muted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 12, marginBottom: 8,
    backgroundColor: C.surface, borderRadius: 16,
    paddingVertical: 12, paddingLeft: 16, paddingRight: 4,
    borderWidth: 1, borderColor: C.lineStrong, borderStyle: "dashed",
    gap: 10,
  },
  content: { flex: 1 },
  label: { fontSize: 15, fontFamily: F.medium, color: C.ink, marginBottom: 2 },
  hint: { fontFamily: F.regular, fontSize: 13, color: C.muted },
  goBtn: { paddingHorizontal: 14, paddingVertical: 9, backgroundColor: C.blue, borderRadius: 10 },
  goBtnText: { fontSize: 14, fontFamily: F.medium, color: C.onBlue },
  dismiss: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
});
