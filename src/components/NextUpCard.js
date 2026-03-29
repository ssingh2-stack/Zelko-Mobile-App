import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { C, serif } from "../lib/theme";
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
          <Text style={styles.badgeActive}>● IN SERVICE</Text>
          <Text style={styles.name}>{inProgress.customer_name}</Text>
          <Text style={styles.meta}>{inProgress.service_name}{inProgress.barber_name ? ` · ${inProgress.barber_name}` : ""}</Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.time}>{fmtTime(inProgress.start_time)}</Text>
          <Text style={styles.timeLabel}>started</Text>
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
        <Text style={styles.badge}>NEXT UP</Text>
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
    backgroundColor: C.espresso,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    position: "relative",
    overflow: "hidden",
  },
  cardActive: {
    backgroundColor: "#1A2E1A",
    borderBottomColor: "rgba(16,185,129,0.3)",
  },
  pulseBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: "#10B981",
  },
  left: { flex: 1 },
  right: { alignItems: "flex-end" },
  badge: {
    fontSize: 9,
    fontWeight: "800",
    color: C.terra,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  badgeActive: {
    fontSize: 9,
    fontWeight: "800",
    color: "#10B981",
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  name: {
    fontFamily: serif,
    fontSize: 17,
    fontWeight: "700",
    color: C.cream,
    marginBottom: 2,
  },
  meta: {
    fontSize: 12,
    color: "rgba(247,243,238,0.5)",
    fontWeight: "500",
  },
  countdown: {
    fontFamily: serif,
    fontSize: 18,
    fontWeight: "900",
    color: C.terra,
  },
  time: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(247,243,238,0.45)",
    marginTop: 2,
  },
  timeLabel: {
    fontSize: 9,
    color: "#10B981",
    fontWeight: "700",
    letterSpacing: 0.5,
    marginTop: 2,
  },
});
