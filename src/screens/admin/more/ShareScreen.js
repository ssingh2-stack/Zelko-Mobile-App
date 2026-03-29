import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, Share, Image,
} from "react-native";
import { api } from "../../../lib/api";
import { C, serif } from "../../../lib/theme";

export default function ShareScreen() {
  const [settings, setSettings] = useState(null);
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.adminSettings(), api.adminBarbers()])
      .then(([s, bs]) => { setSettings(s); setBarbers(bs); })
      .catch(err => Alert.alert("Error", err.message))
      .finally(() => setLoading(false));
  }, []);

  async function shareLink(url, label) {
    try {
      await Share.share({ message: `${label}\n${url}`, url });
    } catch {}
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={C.espresso} /></View>;
  if (!settings) return null;

  const slug = settings.slug;
  const shopName = settings.name;
  const bookingUrl = `https://app.getclipd.ca/book/${slug}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(bookingUrl)}&bgcolor=F7F3EE&color=2C1810&margin=10`;
  const shareMsg = `Hey! You can now book your next appointment at ${shopName} online — it only takes 30 seconds. Here's the link: ${bookingUrl}`;

  return (
    <ScrollView style={styles.container}>
      {/* Main booking link */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your Booking Page</Text>
        <Text style={styles.shopName}>{shopName}</Text>
        <Text style={styles.url}>{bookingUrl}</Text>
        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.btn} onPress={() => shareLink(bookingUrl, shopName)}>
            <Text style={styles.btnText}>Share Link</Text>
          </TouchableOpacity>
        </View>

        {/* QR Code */}
        <View style={styles.qrSection}>
          <Text style={styles.qrLabel}>QR Code</Text>
          <Image source={{ uri: qrUrl }} style={styles.qrImage} resizeMode="contain" />
        </View>

        {/* Share message */}
        <View style={styles.msgSection}>
          <Text style={styles.qrLabel}>Ready-to-send message</Text>
          <View style={styles.msgBox}>
            <Text style={styles.msgText}>{shareMsg}</Text>
          </View>
          <TouchableOpacity style={styles.btn} onPress={() => shareLink(bookingUrl, shareMsg)}>
            <Text style={styles.btnText}>Share Message</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Individual barber links */}
      {barbers.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Individual Barber Links</Text>
          {barbers.map(b => {
            const barberUrl = `https://app.getclipd.ca/book/${slug}/${b.handle || b.id}`;
            return (
              <View key={b.id} style={styles.barberRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.barberName}>{b.name}</Text>
                  <Text style={styles.barberUrl} numberOfLines={1}>{barberUrl}</Text>
                </View>
                <TouchableOpacity style={styles.shareIconBtn} onPress={() => shareLink(barberUrl, b.name)}>
                  <Text style={styles.shareIconText}>↑</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: { margin: 16, marginBottom: 0, backgroundColor: C.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border },
  cardTitle: { fontFamily: serif, fontSize: 17, fontWeight: "700", color: C.espresso, marginBottom: 12 },
  shopName: { fontSize: 15, fontWeight: "700", color: C.espresso, marginBottom: 4 },
  url: { fontSize: 13, color: C.terra, fontWeight: "600", marginBottom: 14 },
  btnRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  btn: { paddingHorizontal: 16, paddingVertical: 9, backgroundColor: C.espresso, borderRadius: 9 },
  btnText: { fontSize: 13, fontWeight: "700", color: C.cream },
  qrSection: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 14, marginBottom: 14 },
  qrLabel: { fontSize: 10, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 },
  qrImage: { width: 140, height: 140, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  msgSection: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 14 },
  msgBox: { backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  msgText: { fontSize: 13, color: C.espresso, lineHeight: 20 },
  barberRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  barberName: { fontSize: 14, fontWeight: "700", color: C.espresso },
  barberUrl: { fontSize: 11, color: C.muted, marginTop: 2 },
  shareIconBtn: { width: 34, height: 34, backgroundColor: C.surface, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  shareIconText: { fontSize: 16, fontWeight: "700", color: C.espresso },
});
