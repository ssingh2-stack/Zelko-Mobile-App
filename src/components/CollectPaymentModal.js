import React, { useState, useEffect } from "react";
import {
  View, Text, Modal, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";
import { F, C, fmtMoney } from "../lib/theme";
import { success as hapticSuccess, error as hapticError } from "../lib/haptics";

export default function CollectPaymentModal({ booking, visible, onClose, onSuccess }) {
  const [tipAmount, setTipAmount] = useState("");
  const [showCustomTip, setShowCustomTip] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState("idle"); // idle, creating, waiting, success, error
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (visible) {
      setTipAmount("");
      setShowCustomTip(false);
      setProcessing(false);
      setStatus("idle");
      setErrorMsg("");
    }
  }, [visible]);

  if (!booking) return null;

  const servicePrice = parseFloat(booking.service_price ?? booking.price ?? 0);
  const depositPaid = (booking.amount_paid || 0) / 100; // stored in cents
  const tipNum = Math.max(0, parseFloat(tipAmount) || 0);
  const remaining = Math.max(servicePrice - depositPaid, 0);
  const total = remaining + tipNum;

  async function collectWithCard() {
    setProcessing(true);
    setStatus("creating");
    setErrorMsg("");

    try {
      const tipCents = Math.round(tipNum * 100);
      const result = await api.adminCreatePaymentIntent(booking.confirmation_code, {
        tip: tipCents,
      });
      if (result.error) throw new Error(result.error);

      setStatus("waiting");

      // Confirm and mark as paid
      await api.adminConfirmPayment(booking.confirmation_code, {
        payment_intent_id: result.payment_intent_id,
        amount: result.amount,
        tip: tipCents,
      });

      hapticSuccess();
      setStatus("success");
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1000);

    } catch (err) {
      setErrorMsg(err.message);
      setStatus("error");
      hapticError();
      setProcessing(false);
    }
  }

  async function collectCash() {
    setProcessing(true);
    try {
      const tipCents = Math.round(tipNum * 100);
      const amountCents = Math.round(total * 100);
      await api.adminMarkPaid(booking.confirmation_code, {
        method: "cash",
        amount: amountCents,
        tip: tipCents,
      });
      hapticSuccess();
      setStatus("success");
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 800);
    } catch (err) {
      setErrorMsg(err.message);
      hapticError();
      setProcessing(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {status === "success" ? (
            <View style={styles.successWrap}>
              <View style={styles.successTick}><Ionicons name="checkmark" size={30} color={C.onBlue} /></View>
              <Text style={styles.successText}>{fmtMoney(total)} paid. <Text style={{ color: C.muted }}>Fresh cut, settled.</Text></Text>
              <Text style={styles.successStatus}>Paid ✓</Text>
            </View>
          ) : (
            <>
              <Text style={styles.title}>Collect payment</Text>
              <Text style={styles.serviceName}>{booking.customer_name} · {booking.service_name}</Text>
              <Text style={styles.heroAmount} numberOfLines={1} adjustsFontSizeToFit>{fmtMoney(total)}</Text>

              {/* Amount breakdown */}
              <View style={styles.amountSection}>
                <View style={styles.amountRow}>
                  <Text style={styles.amountLabel}>Service</Text>
                  <Text style={styles.amountVal}>{fmtMoney(servicePrice)}</Text>
                </View>
                {depositPaid > 0 && (
                  <View style={styles.amountRow}>
                    <Text style={styles.amountLabel}>Deposit paid</Text>
                    <Text style={[styles.amountVal, { color: C.success }]}>-{fmtMoney(depositPaid)}</Text>
                  </View>
                )}
                <View style={[styles.amountRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                  <Text style={styles.amountLabel}>Tip</Text>
                  <Text style={styles.amountVal}>{tipNum > 0 ? fmtMoney(tipNum) : "$0"}</Text>
                </View>
              </View>

              {/* Tip selection */}
              <View style={styles.tipSection}>
                <Text style={styles.tipLabel}>Add tip</Text>
                <View style={styles.tipRow}>
                  {[0, 5, 10, 15, 20].map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.tipBtn, !showCustomTip && tipAmount === String(t) && styles.tipBtnActive]}
                      onPress={() => { setShowCustomTip(false); setTipAmount(t === 0 ? "" : String(t)); }}
                    >
                      <Text style={[styles.tipBtnText, !showCustomTip && tipAmount === String(t) && styles.tipBtnTextActive]}>
                        {t === 0 ? "None" : `$${t}`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[styles.tipBtn, showCustomTip && styles.tipBtnActive]}
                    onPress={() => { setShowCustomTip(true); setTipAmount(""); }}
                  >
                    <Text style={[styles.tipBtnText, showCustomTip && styles.tipBtnTextActive]}>Custom</Text>
                  </TouchableOpacity>
                </View>
                {showCustomTip && (
                  <TextInput
                    style={styles.tipInput}
                    value={tipAmount}
                    onChangeText={setTipAmount}
                    placeholder="Tip in dollars"
                    placeholderTextColor={C.muted}
                    keyboardType="decimal-pad"
                    autoFocus
                  />
                )}
              </View>

              {/* Total */}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalAmount}>{fmtMoney(total)}</Text>
              </View>

              {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

              {/* Payment buttons */}
              <View style={styles.payButtons}>
                <TouchableOpacity
                  style={[styles.cardBtn, processing && { opacity: 0.5 }]}
                  onPress={collectWithCard}
                  disabled={processing || total < 0.50}
                >
                  <Ionicons name="card-outline" size={20} color={C.onNight} />
                  <Text style={styles.cardBtnText}>
                    {status === "creating" ? "Processing…" : status === "waiting" ? "Confirming…" : `Charge ${fmtMoney(total)}`}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.cashBtn, processing && { opacity: 0.5 }]}
                  onPress={collectCash}
                  disabled={processing}
                >
                  <Ionicons name="cash-outline" size={20} color={C.ink} />
                  <Text style={styles.cashBtnText}>Cash</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={processing}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(14,14,12,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: C.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  handle: { width: 36, height: 5, backgroundColor: C.line, borderRadius: 3, alignSelf: "center", marginBottom: 16 },
  title: { fontSize: 12, fontFamily: F.monoMedium, color: C.muted, textTransform: "uppercase", letterSpacing: 1.2 },
  clientName: { fontSize: 16, fontFamily: F.medium, color: C.ink, marginBottom: 2 },
  serviceName: { fontFamily: F.regular, fontSize: 15, color: C.muted, marginTop: 6 },
  // The amount is the biggest thing on the screen (brand/components/Checkout).
  heroAmount: { fontSize: 56, fontFamily: F.regular, color: C.ink, letterSpacing: -2, marginTop: 6, marginBottom: 14, fontVariant: ["tabular-nums"] },
  amountSection: { backgroundColor: C.surface, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1, borderColor: C.line, marginBottom: 16 },
  amountRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  amountLabel: { fontFamily: F.regular, fontSize: 15, color: C.muted },
  amountVal: { fontSize: 15, fontFamily: F.medium, color: C.ink, fontVariant: ["tabular-nums"] },
  tipSection: { marginBottom: 12 },
  tipLabel: { fontSize: 14, fontFamily: F.medium, color: C.ink, marginBottom: 8 },
  tipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  tipBtn: { flexBasis: "30%", flexGrow: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" },
  // The chosen tip is the one spark on the screen.
  tipBtnActive: { backgroundColor: C.spark, borderColor: C.spark },
  tipBtnText: { fontSize: 16, fontFamily: F.medium, color: C.ink },
  tipBtnTextActive: { color: C.onSpark },
  tipInput: { backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 12, height: 46, fontFamily: F.regular, fontSize: 16, color: C.ink, borderWidth: 1, borderColor: C.lineStrong },
  totalRow: { display: "none" },
  totalLabel: { fontSize: 16, fontFamily: F.medium, color: C.ink },
  totalAmount: { fontSize: 28, fontFamily: F.regular, color: C.ink },
  errorText: { fontSize: 14, color: C.danger, fontFamily: F.medium, marginBottom: 12, textAlign: "center" },
  payButtons: { flexDirection: "row", gap: 8, marginTop: 4, marginBottom: 8 },
  // Charging money reads dark, so it never looks like navigation.
  cardBtn: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.night, height: 56, borderRadius: 14 },
  cardBtnText: { fontSize: 17, fontFamily: F.medium, color: C.onNight, fontVariant: ["tabular-nums"] },
  cashBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: C.surface, height: 56, borderRadius: 14, borderWidth: 1, borderColor: C.lineStrong },
  cashBtnText: { fontSize: 16, fontFamily: F.medium, color: C.ink },
  cancelBtn: { alignItems: "center", paddingVertical: 12 },
  cancelText: { fontSize: 15, fontFamily: F.medium, color: C.muted },
  successWrap: { alignItems: "center", paddingVertical: 36, paddingHorizontal: 12 },
  successTick: { width: 64, height: 64, borderRadius: 18, backgroundColor: C.blue, alignItems: "center", justifyContent: "center" },
  successText: { fontSize: 30, lineHeight: 34, fontFamily: F.regular, color: C.ink, letterSpacing: -0.8, marginTop: 18, textAlign: "center", fontVariant: ["tabular-nums"] },
  successStatus: { fontSize: 15, fontFamily: F.medium, color: C.success, marginTop: 10 },
});
