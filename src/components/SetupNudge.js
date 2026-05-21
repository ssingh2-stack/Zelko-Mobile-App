import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { api } from "../lib/api";
import { C, serif } from "../lib/theme";

const CHECKS = [
  {
    key: "hours",
    check: async () => {
      const s = await api.adminSettings();
      const h = s?.hours || {};
      return Object.values(h).some(d => d.open);
    },
    label: "Set your business hours",
    hint: "Let clients know when you're open",
    screen: "Settings",
  },
  {
    key: "barbers",
    check: async () => {
      const b = await api.adminBarbers();
      return (Array.isArray(b) ? b : []).length > 0;
    },
    label: "Add your first barber",
    hint: "Your team needs at least one barber to accept bookings",
    screen: "Barbers",
  },
  {
    key: "services",
    check: async () => {
      const s = await api.adminServices();
      return (Array.isArray(s) ? s : []).length > 0;
    },
    label: "Add a service",
    hint: "Clients need to know what you offer",
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
        <Text style={styles.goBtnText}>Set up →</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.dismiss} onPress={() => setDismissed(true)}>
        <Text style={styles.dismissText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 12, marginTop: 8, marginBottom: 0,
    backgroundColor: "rgba(196,104,62,0.05)", borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: "rgba(196,104,62,0.25)",
    gap: 10,
  },
  content: { flex: 1 },
  label: { fontSize: 13, fontWeight: "700", color: "#C4683E", marginBottom: 2 },
  hint: { fontSize: 11, color: "#B45309" },
  goBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: C.espresso, borderRadius: 8,
  },
  goBtnText: { fontSize: 12, fontWeight: "800", color: C.cream },
  dismiss: { padding: 10, minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  dismissText: { fontSize: 14, color: "#B45309" },
});
