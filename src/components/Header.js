import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { F, C } from "../lib/theme";
import { Wordmark } from "./Brand";

export default function Header({ shopName, rightLabel, onRightPress }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.inner}>
        <Wordmark height={20} />
        {onRightPress ? (
          <TouchableOpacity onPress={onRightPress} style={styles.rightBtn} accessibilityRole="button">
            <Text style={styles.rightBtnText}>{rightLabel || "Add"}</Text>
          </TouchableOpacity>
        ) : <Text style={styles.shopName} numberOfLines={1}>{shopName || "Owner"}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: C.paper },
  inner: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  shopName: { fontSize: 12, fontFamily: F.monoMedium, color: C.muted, textTransform: "uppercase", letterSpacing: 1.2, maxWidth: "60%" },
  rightBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.blue, borderRadius: 10 },
  rightBtnText: { fontSize: 14, fontFamily: F.medium, color: C.onBlue },
});
