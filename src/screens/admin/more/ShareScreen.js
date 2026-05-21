import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, Share, RefreshControl,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../lib/api";
import { C, serif } from "../../../lib/theme";
import { useRole } from "../../../lib/RoleContext";

export default function ShareScreen() {
  const { role } = useRole();
  const [settings, setSettings] = useState(null);
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    Promise.all([api.adminSettings(), api.adminBarbers()])
      .then(([s, bs]) => { setSettings(s); setBarbers(bs); })
      .catch(err => Alert.alert("Error", err.message))
      .finally(() => { setLoading(false); setRefreshing(false); });
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
  const isStaff = role === "staff";

  // For staff, use their personal barber link as the main link
  const myBarber = isStaff && barbers.length > 0 ? barbers[0] : null;
  const bookingUrl = myBarber
    ? `https://app.getclipd.ca/book/${slug}/${myBarber.handle || myBarber.id}`
    : `https://app.getclipd.ca/book/${slug}`;
  const displayName = myBarber ? myBarber.name : shopName;
  const shareMsg = `Hey! You can now book your next appointment with ${displayName} online — it only takes 30 seconds. Here's the link: ${bookingUrl}`;

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); Promise.all([api.adminSettings(), api.adminBarbers()]).then(([s, bs]) => { setSettings(s); setBarbers(bs); }).finally(() => { setRefreshing(false); }); }} tintColor={C.espresso} />}>
      {/* Main booking link */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{isStaff ? "My Booking Link" : "Your Booking Page"}</Text>
        <Text style={styles.shopName}>{displayName}</Text>
        <Text style={styles.url}>{bookingUrl}</Text>
        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.btn} onPress={() => shareLink(bookingUrl, displayName)}>
            <Text style={styles.btnText}>Share Link</Text>
          </TouchableOpacity>
        </View>

        {/* QR Code */}
        <View style={styles.qrSection}>
          <Text style={styles.qrLabel}>QR Code — print for mirrors, cards, windows</Text>
          <View style={styles.qrWrap}>
            <QRCode
              value={bookingUrl}
              size={180}
              color="#111111"
              backgroundColor="#FAFAFA"
              quietZone={12}
            />
          </View>
          <Text style={styles.qrHint}>Screenshot to save and print</Text>
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

      {/* Individual barber links — admin only */}
      {!isStaff && barbers.length > 0 && (
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
                  <Ionicons name="share-outline" size={16} color={C.espresso} />
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
  qrWrap: { backgroundColor: "#FAFAFA", padding: 16, borderRadius: 14, borderWidth: 1, borderColor: C.border, alignSelf: "center" },
  qrHint: { fontSize: 11, color: C.muted, fontStyle: "italic", marginTop: 8, textAlign: "center" },
  msgSection: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 14 },
  msgBox: { backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  msgText: { fontSize: 13, color: C.espresso, lineHeight: 20 },
  barberRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  barberName: { fontSize: 14, fontWeight: "700", color: C.espresso },
  barberUrl: { fontSize: 11, color: C.muted, marginTop: 2 },
  shareIconBtn: { width: 34, height: 34, backgroundColor: C.surface, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  shareIconText: { fontSize: 16, fontWeight: "700", color: C.espresso },
});
