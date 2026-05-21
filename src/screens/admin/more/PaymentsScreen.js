import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, Switch, Linking, TextInput, RefreshControl,
} from "react-native";
import { api } from "../../../lib/api";
import { C, serif } from "../../../lib/theme";

export default function PaymentsScreen() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setSettings(await api.adminPaymentSettings()); }
    catch (err) { Alert.alert("Error", err.message); }
    finally { setLoading(false); setRefreshing(false); }
  }

  async function save() {
    setSaving(true); setMsg("");
    try {
      await api.adminSavePaymentSettings({
        payments_enabled: settings.payments_enabled,
        payment_type:     settings.payment_type,
        deposit_amount:   settings.deposit_amount,
        deposit_type:     settings.deposit_type || "flat",
      });
      setMsg("Saved!");
      setTimeout(() => setMsg(""), 2000);
    } catch (err) { Alert.alert("Error", err.message); }
    finally { setSaving(false); }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={C.espresso} /></View>;
  if (!settings) return null;

  const connected = settings.stripe_connected;

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.espresso} />}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Accept payments online</Text>
        <Text style={styles.cardSub}>
          Connect your Stripe account to collect deposits or full payments when customers book. Money goes directly to your Stripe account — Clipd never touches your funds.
        </Text>

        {!connected ? (
          <View style={styles.connectSection}>
            <TouchableOpacity
              style={styles.stripeBtn}
              onPress={() => Linking.openURL("https://app.getclipd.ca/connect/stripe")}
            >
              <Text style={styles.stripeBtnText}>Connect Stripe →</Text>
            </TouchableOpacity>
            <Text style={styles.stripeNote}>
              You'll be taken to Stripe to securely connect your account. Takes under a minute.{" "}
              <Text style={styles.learnMore} onPress={() => Linking.openURL("https://getclipd.ca/payments")}>
                Learn how it works →
              </Text>
            </Text>
          </View>
        ) : (
          <View>
            <View style={styles.connectedRow}>
              <View style={styles.connectedDot} />
              <Text style={styles.connectedText}>Stripe connected</Text>
            </View>

            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Require payment to book</Text>
                <Text style={styles.settingDesc}>Customers must pay before their booking is confirmed</Text>
              </View>
              <Switch
                value={settings.payments_enabled}
                onValueChange={v => setSettings({ ...settings, payments_enabled: v })}
                trackColor={{ true: C.terra }}
                thumbColor={C.white}
              />
            </View>

            {settings.payments_enabled && (
              <View style={styles.payTypeSection}>
                <Text style={styles.payTypeLabel}>What to charge</Text>
                <TouchableOpacity
                  style={styles.radioRow}
                  onPress={() => setSettings({ ...settings, payment_type: "deposit" })}
                >
                  <View style={[styles.radio, settings.payment_type === "deposit" && styles.radioActive]} />
                  <Text style={styles.radioLabel}>Deposit (fixed amount)</Text>
                </TouchableOpacity>
                {settings.payment_type === "deposit" && (
                  <View>
                    <View style={styles.depositTypeRow}>
                      <TouchableOpacity
                        style={[styles.depositTypePill, (settings.deposit_type || "flat") === "flat" && styles.depositTypePillActive]}
                        onPress={() => setSettings({ ...settings, deposit_type: "flat" })}
                      >
                        <Text style={[styles.depositTypePillText, (settings.deposit_type || "flat") === "flat" && styles.depositTypePillTextActive]}>Flat $</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.depositTypePill, settings.deposit_type === "percent" && styles.depositTypePillActive]}
                        onPress={() => setSettings({ ...settings, deposit_type: "percent" })}
                      >
                        <Text style={[styles.depositTypePillText, settings.deposit_type === "percent" && styles.depositTypePillTextActive]}>% of service</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.depositRow}>
                      <Text style={styles.dollarSign}>{settings.deposit_type === "percent" ? "%" : "$"}</Text>
                      <TextInput
                        style={styles.depositInput}
                        value={String(settings.deposit_amount || "")}
                        onChangeText={v => setSettings({ ...settings, deposit_amount: parseFloat(v) || 0 })}
                        keyboardType="decimal-pad"
                        placeholder={settings.deposit_type === "percent" ? "25" : "20"}
                        placeholderTextColor={C.muted}
                      />
                      <Text style={styles.perBooking}>
                        {settings.deposit_type === "percent" ? "of service price" : "per booking"}
                      </Text>
                    </View>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.radioRow}
                  onPress={() => setSettings({ ...settings, payment_type: "full" })}
                >
                  <View style={[styles.radio, settings.payment_type === "full" && styles.radioActive]} />
                  <Text style={styles.radioLabel}>Full service price</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.saveRow}>
              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
                <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save"}</Text>
              </TouchableOpacity>
              {msg ? <Text style={styles.savedMsg}>{msg}</Text> : null}
            </View>
          </View>
        )}
      </View>
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: { margin: 16, backgroundColor: C.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border },
  cardTitle: { fontFamily: serif, fontSize: 17, fontWeight: "700", color: C.espresso, marginBottom: 8 },
  cardSub: { fontSize: 13, color: C.muted, lineHeight: 20, marginBottom: 20 },
  connectSection: {},
  stripeBtn: { backgroundColor: C.espresso, borderRadius: 9, paddingVertical: 12, paddingHorizontal: 20, alignSelf: "flex-start", marginBottom: 12 },
  stripeBtnText: { fontSize: 14, fontWeight: "800", color: C.cream },
  stripeNote: { fontSize: 12, color: C.muted, lineHeight: 18 },
  learnMore: { color: C.terra, fontWeight: "600" },
  connectedRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20 },
  connectedDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#10B981" },
  connectedText: { fontSize: 13, fontWeight: "700", color: C.espresso },
  settingRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  settingLabel: { fontSize: 14, fontWeight: "700", color: C.espresso },
  settingDesc: { fontSize: 12, color: C.muted, marginTop: 2 },
  payTypeSection: { backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 16 },
  payTypeLabel: { fontSize: 10, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 },
  radioRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: C.border },
  radioActive: { borderColor: C.terra, backgroundColor: C.terra },
  radioLabel: { fontSize: 13, fontWeight: "600", color: C.espresso },
  depositTypeRow: { flexDirection: "row", gap: 6, paddingLeft: 28, marginBottom: 10 },
  depositTypePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1.5, borderColor: C.border },
  depositTypePillActive: { backgroundColor: C.espresso, borderColor: C.espresso },
  depositTypePillText: { fontSize: 12, fontWeight: "700", color: C.muted },
  depositTypePillTextActive: { color: C.cream },
  depositRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 28, marginBottom: 4 },
  dollarSign: { fontSize: 14, fontWeight: "700", color: C.espresso },
  depositInput: { width: 70, padding: 8, borderWidth: 1.5, borderColor: C.border, borderRadius: 8, fontSize: 14, fontWeight: "700", color: C.espresso },
  perBooking: { fontSize: 13, color: C.muted },
  saveRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  saveBtn: { backgroundColor: C.espresso, borderRadius: 9, paddingVertical: 11, paddingHorizontal: 20 },
  saveBtnText: { fontSize: 14, fontWeight: "800", color: C.cream },
  savedMsg: { fontSize: 13, fontWeight: "600", color: "#333333" },
});
