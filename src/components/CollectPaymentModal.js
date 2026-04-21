import React, { useState, useEffect } from "react";
import {
  View, Text, Modal, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";
import { C, serif, fmtMoney } from "../lib/theme";
import { success as hapticSuccess, error as hapticError } from "../lib/haptics";

export default function CollectPaymentModal({ booking, visible, onClose, onSuccess }) {
  const [tipAmount, setTipAmount] = useState("");
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState("idle"); // idle, creating, waiting, success, error
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (visible) {
      setTipAmount("");
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
              <Ionicons name="checkmark-circle" size={56} color="#059669" />
              <Text style={styles.successText}>Payment Collected</Text>
              <Text style={styles.successAmount}>{fmtMoney(total)}</Text>
            </View>
          ) : (
            <>
              <Text style={styles.title}>Collect Payment</Text>
              <Text style={styles.clientName}>{booking.customer_name}</Text>
              <Text style={styles.serviceName}>{booking.service_name}</Text>

              {/* Amount breakdown */}
              <View style={styles.amountSection}>
                <View style={styles.amountRow}>
                  <Text style={styles.amountLabel}>Service</Text>
                  <Text style={styles.amountVal}>{fmtMoney(servicePrice)}</Text>
                </View>
                {depositPaid > 0 && (
                  <View style={styles.amountRow}>
                    <Text style={styles.amountLabel}>Deposit paid</Text>
                    <Text style={[styles.amountVal, { color: "#059669" }]}>-{fmtMoney(depositPaid)}</Text>
                  </View>
                )}
                <View style={[styles.amountRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                  <Text style={styles.amountLabel}>Tip</Text>
                  <Text style={styles.amountVal}>{tipNum > 0 ? fmtMoney(tipNum) : "$0"}</Text>
                </View>
              </View>

              {/* Tip selection */}
              <View style={styles.tipSection}>
                <Text style={styles.tipLabel}>Add Tip</Text>
                <View style={styles.tipRow}>
                  {[0, 5, 10, 15, 20].map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.tipBtn, tipAmount === String(t) && styles.tipBtnActive]}
                      onPress={() => setTipAmount(t === 0 ? "" : String(t))}
                    >
                      <Text style={[styles.tipBtnText, tipAmount === String(t) && styles.tipBtnTextActive]}>
                        {t === 0 ? "None" : `$${t}`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.tipInput}
                  value={tipAmount}
                  onChangeText={setTipAmount}
                  placeholder="Custom amount"
                  placeholderTextColor={C.muted}
                  keyboardType="decimal-pad"
                />
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
                  <Ionicons name="card-outline" size={20} color={C.cream} />
                  <Text style={styles.cardBtnText}>
                    {status === "creating" ? "Processing..." : status === "waiting" ? "Confirming..." : "Card"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.cashBtn, processing && { opacity: 0.5 }]}
                  onPress={collectCash}
                  disabled={processing}
                >
                  <Ionicons name="cash-outline" size={20} color={C.espresso} />
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
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  handle: { width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginBottom: 20 },

  title: { fontFamily: serif, fontSize: 24, fontWeight: "900", color: C.espresso, marginBottom: 4 },
  clientName: { fontSize: 16, fontWeight: "700", color: C.espresso, marginBottom: 2 },
  serviceName: { fontSize: 13, color: C.muted, marginBottom: 20 },

  amountSection: {
    backgroundColor: C.surface, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: C.border, marginBottom: 16,
  },
  amountRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  amountLabel: { fontSize: 14, color: C.muted },
  amountVal: { fontSize: 14, fontWeight: "700", color: C.espresso },

  tipSection: { marginBottom: 16 },
  tipLabel: { fontSize: 10, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 },
  tipRow: { flexDirection: "row", gap: 6, marginBottom: 8 },
  tipBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, alignItems: "center" },
  tipBtnActive: { backgroundColor: C.espresso, borderColor: C.espresso },
  tipBtnText: { fontSize: 13, fontWeight: "700", color: C.muted },
  tipBtnTextActive: { color: C.cream },
  tipInput: {
    backgroundColor: C.surface, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: C.espresso, borderWidth: 1, borderColor: C.border,
  },

  totalRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.border, marginBottom: 20,
  },
  totalLabel: { fontSize: 16, fontWeight: "700", color: C.espresso },
  totalAmount: { fontFamily: serif, fontSize: 28, fontWeight: "900", color: C.terra },

  errorText: { fontSize: 13, color: "#DC2626", fontWeight: "600", marginBottom: 12, textAlign: "center" },

  payButtons: { flexDirection: "row", gap: 10, marginBottom: 12 },
  cardBtn: {
    flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: C.espresso, paddingVertical: 16, borderRadius: 12,
  },
  cardBtnText: { fontSize: 16, fontWeight: "800", color: C.cream },
  cashBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: C.surface, paddingVertical: 16, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.border,
  },
  cashBtnText: { fontSize: 14, fontWeight: "700", color: C.espresso },

  cancelBtn: { alignItems: "center", paddingVertical: 10 },
  cancelText: { fontSize: 14, fontWeight: "600", color: C.muted },

  successWrap: { alignItems: "center", paddingVertical: 40 },
  successText: { fontFamily: serif, fontSize: 22, fontWeight: "800", color: C.espresso, marginTop: 12 },
  successAmount: { fontFamily: serif, fontSize: 32, fontWeight: "900", color: C.terra, marginTop: 4 },
});

