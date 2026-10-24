import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { F, C } from "../lib/theme";

export default function ErrorState({ message, onRetry }) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="alert-circle-outline" size={40} color={C.blue} style={styles.icon} />
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.msg}>{message || "Check your connection and try again"}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.btn} onPress={onRetry}>
          <Text style={styles.btnText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  icon: { marginBottom: 12 },
  title: { fontSize: 18, fontFamily: F.regular, color: C.ink, marginBottom: 6 },
  msg: { fontFamily: F.regular, fontSize: 13, color: C.muted, textAlign: "center", lineHeight: 20, marginBottom: 20 },
  btn: {
    paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12,
    backgroundColor: C.blue,
  },
  btnText: { fontSize: 14, fontFamily: F.semibold, color: C.paper },
});
