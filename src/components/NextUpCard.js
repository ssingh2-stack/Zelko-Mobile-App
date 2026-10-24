import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { F, C } from "../lib/theme";
import { fmtTime, tMin } from "./DayCalendarView";

function getCountdown(startTime) {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = tMin(startTime);
  const diff = startMin - nowMin;
  if (diff <= 0) return null; // already started or past
  if (diff < 60) return `in ${diff} min`;
  const h = Math.floor(diff / 60), m = diff % 60;
  return m > 0 ? `in ${h}h ${m}m` : `in ${h}h`;
}

function getNextBooking(bookings) {
  if (!bookings?.length) return null;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const upcoming = bookings
    .filter(b => b.status === "confirmed" && tMin(b.start_time) > nowMin)
    .sort((a, b) => tMin(a.start_time) - tMin(b.start_time));
  return upcoming[0] || null;
}

function getInProgressBooking(bookings) {
  if (!bookings?.length) return null;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return bookings.find(b => {
    if (b.status !== "confirmed") return false;
    const start = tMin(b.start_time);
    const end = b.end_time ? tMin(b.end_time) : start + (b.duration_min || 30);
    return nowMin >= start && nowMin < end;
  }) || null;
}

export default function NextUpCard({ bookings, onPress }) {
  const [, forceUpdate] = useState(0);

  // Refresh countdown every 30s
  useEffect(() => {
    const timer = setInterval(() => forceUpdate(n => n + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const inProgress = getInProgressBooking(bookings);
  const next = getNextBooking(bookings);

  if (inProgress) {
    return (
      <TouchableOpacity style={[styles.card, styles.cardActive]} onPress={() => onPress?.(inProgress)} activeOpacity={0.85}>
        <View style={styles.pulseBar} />
        <View style={styles.left}>
          <Text style={styles.badgeActive}>In the chair</Text>
          <Text style={[styles.name, { color: C.onNight }]}>{inProgress.customer_name}</Text>
          <Text style={[styles.meta, { color: C.nightMuted }]}>{inProgress.service_name}{inProgress.barber_name ? ` · ${inProgress.barber_name}` : ""}</Text>
        </View>
        <View style={styles.right}>
          <Text style={[styles.time, { color: C.onNight }]}>{fmtTime(inProgress.start_time)}</Text>
          <Text style={styles.timeLabel}>Started</Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (!next) {
    const allConfirmed = bookings?.filter(b => b.status === "confirmed") || [];
    const allPast = allConfirmed.every(b => {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const end = b.end_time ? tMin(b.end_time) : tMin(b.start_time) + (b.duration_min || 30);
      return end <= nowMin;
    });
    if (allConfirmed.length === 0 || allPast) return null;
    return null;
  }

  const countdown = getCountdown(next.start_time);
  if (!countdown) return null;

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress?.(next)} activeOpacity={0.85}>
      <View style={styles.left}>
        <Text style={styles.badge}>Next up</Text>
        <Text style={styles.name}>{next.customer_name}</Text>
        <Text style={styles.meta}>{next.service_name}{next.barber_name ? ` · ${next.barber_name}` : ""}</Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.countdown}>{countdown}</Text>
        <Text style={styles.time}>{fmtTime(next.start_time)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    position: "relative",
    overflow: "hidden",
  },
  // In the chair reads as night, like its status badge.
  cardActive: { backgroundColor: C.night, borderColor: C.night },
  pulseBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4, backgroundColor: C.blue },
  left: { flex: 1 },
  right: { alignItems: "flex-end" },
  badge: { fontSize: 11, fontFamily: F.monoMedium, color: C.blue, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 },
  badgeActive: { fontSize: 11, fontFamily: F.monoMedium, color: C.onNight, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 },
  name: { fontSize: 18, fontFamily: F.medium, color: C.ink, marginBottom: 2 },
  meta: { fontSize: 14, color: C.muted, fontFamily: F.regular },
  countdown: { fontSize: 20, fontFamily: F.regular, color: C.ink, letterSpacing: -0.3, fontVariant: ["tabular-nums"] },
  time: { fontSize: 13, fontFamily: F.regular, color: C.muted, marginTop: 2, fontVariant: ["tabular-nums"] },
  timeLabel: { fontSize: 12, color: C.nightMuted, fontFamily: F.regular, marginTop: 2 },
});
