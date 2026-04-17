import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { C, BARBER_PALETTES, fmtMoney } from "../lib/theme";

export default function BookingCard({ booking, paletteIndex, onNoShow, onCancel }) {
  const palette = BARBER_PALETTES[paletteIndex % BARBER_PALETTES.length];
  const isCancelled = booking.status === "cancelled" || booking.status === "no_show";

  return (
    <View style={[
      styles.card,
      { backgroundColor: palette.bg, borderLeftColor: palette.border },
      isCancelled && styles.cardCancelled,
    ]}>
      <Text style={[styles.time, { color: palette.text }]}>
        {booking.start_time} – {booking.end_time}
      </Text>
      <Text style={[styles.name, isCancelled && styles.nameCancelled]}>
        {booking.customer_name}
      </Text>
      <Text style={styles.service} numberOfLines={1}>
        {booking.service_name}
      </Text>
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <Text style={styles.price}>{fmtMoney(booking.service_price ?? booking.price ?? 0)}</Text>
          {booking.duration_min ? <Text style={styles.dur}> · {booking.duration_min}min</Text> : null}
        </View>
        {isCancelled ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{booking.status}</Text>
          </View>
        ) : onNoShow && onCancel ? (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => onNoShow(booking.confirmation_code)}>
              <Text style={styles.actionBtnText}>No-show</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "rgba(196,104,62,0.1)" }]} onPress={() => onCancel(booking.confirmation_code)}>
              <Text style={[styles.actionBtnText, { color: C.terra }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    padding: 10,
    paddingLeft: 11,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "transparent",
    borderLeftWidth: 3,
  },
  cardCancelled: { opacity: 0.45 },
  time: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3, marginBottom: 4 },
  name: { fontSize: 12.5, fontWeight: "700", color: C.espresso, marginBottom: 1, lineHeight: 16 },
  nameCancelled: { textDecorationLine: "line-through", color: C.muted },
  service: { fontSize: 11, color: C.muted, marginBottom: 6 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  footerLeft: { flexDirection: "row", alignItems: "center" },
  price: { fontSize: 12, fontWeight: "700", color: C.espresso },
  dur: { fontSize: 10, color: C.muted },
  badge: { backgroundColor: C.border, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  badgeText: { fontSize: 9, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  actions: { flexDirection: "row", gap: 6 },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: C.surface },
  actionBtnText: { fontSize: 11, fontWeight: "700", color: C.espresso },
});
