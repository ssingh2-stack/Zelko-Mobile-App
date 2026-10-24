import React, { useState, useEffect, useCallback } from "react";
import { C, F } from "../lib/theme";
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
          {sending ? <ActivityIndicator color={C.onBlue} /> : <Text style={styles.btnText}>Resend email</Text>}
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
    backgroundColor: C.surface,
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    borderLeftWidth: 4,
    borderLeftColor: C.danger,
  },
  title: { color: C.ink, fontSize: 15, fontFamily: F.medium },
  body: { color: C.muted, fontFamily: F.regular, fontSize: 13, lineHeight: 19, marginTop: 2 },
  row: { flexDirection: "row", gap: 8, marginTop: 12 },
  btn: {
    backgroundColor: C.blue,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { color: C.onBlue, fontFamily: F.medium, fontSize: 14 },
  ghostBtn: {
    borderWidth: 1,
    borderColor: C.lineStrong,
    backgroundColor: C.surface,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostBtnText: { color: C.ink, fontFamily: F.medium, fontSize: 14 },
  msg: { color: C.muted, fontFamily: F.regular, fontSize: 13, marginTop: 8 },
});
