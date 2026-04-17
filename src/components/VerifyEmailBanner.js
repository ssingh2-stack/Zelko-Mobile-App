import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { api } from "../lib/api";
import { getSession, saveSession } from "../lib/auth";

/**
 * Shows a "check your email" banner when the current shop hasn't verified
 * its signup email yet. Public bookings are blocked server-side until
 * verification (AC-3-001) — this banner is the in-app cue so owners aren't
 * confused why their booking page is paused.
 *
 * State model:
 *  - `pending` comes from the profile saved at login time.
 *  - Mount effect re-checks /api/admin/settings and refreshes the profile
 *    so a user who verified from another device sees the banner disappear
 *    on app re-open without needing to log out and back in.
 */
export default function VerifyEmailBanner() {
  const [pending, setPending] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  const refreshFromServer = useCallback(async () => {
    try {
      const settings = await api.adminSettings();
      const session = await getSession();
      if (session?.profile) {
        // Keep AsyncStorage in sync so the next mount reads fresh state.
        const nextProfile = {
          ...session.profile,
          email_verification_pending: !settings.email_verified,
        };
        await saveSession(session.token, nextProfile);
      }
      setPending(!settings.email_verified);
    } catch {
      // Network / auth error — fall back to whatever the stored profile says.
    }
  }, []);

  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (session?.profile?.role === "admin") {
        setPending(!!session.profile.email_verification_pending);
        refreshFromServer();
      }
    })();
  }, [refreshFromServer]);

  if (!pending) return null;

  const onResend = async () => {
    setSending(true); setMessage("");
    try {
      await api.resendVerification();
      setMessage("Sent. Check your inbox.");
    } catch (e) {
      setMessage(e?.message || "Try again in a minute.");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Check your email to activate bookings</Text>
      <Text style={styles.body}>Public bookings are paused until you confirm your signup email.</Text>
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={onResend} disabled={sending}>
          {sending ? <ActivityIndicator color="#991B1B" /> : <Text style={styles.btnText}>Resend email</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghostBtn} onPress={refreshFromServer}>
          <Text style={styles.ghostBtnText}>I've verified</Text>
        </TouchableOpacity>
      </View>
      {message ? <Text style={styles.msg}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#991B1B",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { color: "#fff", fontSize: 14, fontWeight: "700" },
  body: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 2 },
  row: { flexDirection: "row", gap: 8, marginTop: 10 },
  btn: {
    backgroundColor: "#fff",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { color: "#991B1B", fontWeight: "700", fontSize: 13 },
  ghostBtn: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  msg: { color: "#fff", fontSize: 12, marginTop: 8, opacity: 0.9 },
});
