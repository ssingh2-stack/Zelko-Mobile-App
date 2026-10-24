import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { C } from "../lib/theme";

function SkeletonPulse({ style }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return <Animated.View style={[styles.bone, style, { opacity }]} />;
}

export function SkeletonCard({ lines = 3 }) {
  return (
    <View style={styles.card}>
      <SkeletonPulse style={styles.cardAccent} />
      <SkeletonPulse style={{ width: "40%", height: 10, marginBottom: 10 }} />
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonPulse
          key={i}
          style={{ width: i === lines - 1 ? "60%" : "90%", height: 10, marginBottom: 8 }}
        />
      ))}
    </View>
  );
}

export function SkeletonList({ count = 4 }) {
  return (
    <View style={styles.listWrap}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.listRow}>
          <SkeletonPulse style={styles.avatar} />
          <View style={styles.listLines}>
            <SkeletonPulse style={{ width: "65%", height: 12, marginBottom: 8 }} />
            <SkeletonPulse style={{ width: "45%", height: 10 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function SkeletonCalendar() {
  return (
    <View style={styles.calWrap}>
      {/* Header bar */}
      <View style={styles.calHeader}>
        <SkeletonPulse style={{ width: 56, height: 14 }} />
        <SkeletonPulse style={{ width: 80, height: 14 }} />
        <SkeletonPulse style={{ width: 80, height: 14 }} />
      </View>
      {/* Time rows */}
      {Array.from({ length: 6 }, (_, i) => (
        <View key={i} style={styles.calRow}>
          <SkeletonPulse style={{ width: 36, height: 10 }} />
          <View style={styles.calSlots}>
            {i % 2 === 0 && <SkeletonPulse style={[styles.calBlock, { width: "45%" }]} />}
            {i % 3 === 0 && <SkeletonPulse style={[styles.calBlock, { width: "35%", marginLeft: "50%" }]} />}
          </View>
        </View>
      ))}
    </View>
  );
}

export function SkeletonKPI() {
  return (
    <View style={styles.kpiGrid}>
      {[0, 1, 2, 3].map(i => (
        <View key={i} style={styles.kpiCard}>
          <SkeletonPulse style={{ width: 24, height: 24, borderRadius: 12, marginBottom: 10 }} />
          <SkeletonPulse style={{ width: "70%", height: 20, marginBottom: 6 }} />
          <SkeletonPulse style={{ width: "50%", height: 8 }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bone: { backgroundColor: C.line, borderRadius: 4 },

  // Card
  card: {
    backgroundColor: C.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: C.line, marginBottom: 10, overflow: "hidden",
  },
  cardAccent: { position: "absolute", top: 0, left: 0, right: 0, height: 3, borderRadius: 0 },

  // List
  listWrap: { gap: 8 },
  listRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  listLines: { flex: 1 },

  // Calendar
  calWrap: { padding: 12 },
  calHeader: { flexDirection: "row", gap: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  calRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.line },
  calSlots: { flex: 1, flexDirection: "row", height: 32 },
  calBlock: { height: 32, borderRadius: 6 },

  // KPI
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiCard: {
    width: "47%", backgroundColor: C.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: C.line,
  },
});
