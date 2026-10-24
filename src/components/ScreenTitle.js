import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { F, C } from "../lib/theme";

/** Large tab title. Size carries the hierarchy, weight stays Regular. */
export default function ScreenTitle({ title, sub, right }) {
  return (
    <View style={styles.wrap}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, backgroundColor: C.paper },
  title: { fontSize: 30, fontFamily: F.regular, color: C.ink, letterSpacing: -0.9 },
  sub: { fontSize: 14, fontFamily: F.regular, color: C.muted, marginTop: 2 },
});
