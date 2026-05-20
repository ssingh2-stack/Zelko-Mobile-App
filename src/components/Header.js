import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, serif } from "../lib/theme";

export default function Header({ shopName, rightLabel, onRightPress }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.inner}>
        <Text style={styles.logo}>CLIPD</Text>
        <Text style={styles.shopName}>{shopName || "Admin"}</Text>
        {onRightPress ? (
          <TouchableOpacity onPress={onRightPress} style={styles.rightBtn}>
            <Text style={styles.rightBtnText}>{rightLabel || "+"}</Text>
          </TouchableOpacity>
        ) : <View style={styles.rightPlaceholder} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: C.espresso },
  inner: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  logo: { fontSize: 18, fontWeight: "900", color: C.terra, letterSpacing: -0.5 },
  shopName: { fontSize: 11, fontWeight: "700", color: "rgba(247,243,238,0.4)", textTransform: "uppercase", letterSpacing: 2 },
  rightBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: C.terra, borderRadius: 8 },
  rightBtnText: { fontSize: 13, fontWeight: "800", color: C.cream, letterSpacing: 0.3 },
  rightPlaceholder: { width: 60 },
});
