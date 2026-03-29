import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { C, serif } from "../lib/theme";

export default function ErrorState({ message, onRetry }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>⚠️</Text>
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
  icon: { fontSize: 36, marginBottom: 12 },
  title: { fontFamily: serif, fontSize: 18, fontWeight: "700", color: C.espresso, marginBottom: 6 },
  msg: { fontSize: 13, color: C.muted, textAlign: "center", lineHeight: 20, marginBottom: 20 },
  btn: {
    paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10,
    backgroundColor: C.espresso,
  },
  btnText: { fontSize: 14, fontWeight: "800", color: C.cream },
});
