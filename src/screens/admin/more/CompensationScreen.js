import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, RefreshControl, Modal,
} from "react-native";
import { api } from "../../../lib/api";
import { F, C, fmtMoney } from "../../../lib/theme";
import { success as hapticSuccess } from "../../../lib/haptics";
import { useToast, Toast } from "../../../components/Toast";

const PLAN_TYPES = [
  { key: "rent", label: "Chair rent", desc: "Fixed monthly/weekly fee" },
  { key: "split", label: "Commission split", desc: "% split on every booking" },
  { key: "tiered", label: "Tiered split", desc: "% changes as barber earns more" },
];
const PAY_PERIODS = [
  { key: "weekly", label: "Weekly" },
  { key: "biweekly", label: "Bi-weekly" },
  { key: "monthly", label: "Monthly" },
];

function isoToday() { return new Date().toISOString().split("T")[0]; }
function periodDates(period) {
  const now = new Date();
  if (period === "week") {
    const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return { from: mon.toISOString().split("T")[0], to: isoToday() };
  }
  if (period === "month") {
    return { from: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`, to: isoToday() };
  }
  if (period === "last_month") {
    const s = new Date(now.getFullYear(), now.getMonth()-1, 1);
    const e = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: s.toISOString().split("T")[0], to: e.toISOString().split("T")[0] };
  }
  return { from: `${now.getFullYear()}-01-01`, to: isoToday() };
}

export default function CompensationScreen() {
  const [plans, setPlans] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [earnings, setEarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [earningsPeriod, setEarningsPeriod] = useState("week");
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [payingBarber, setPayingBarber] = useState(null);
  const { showToast, toastProps } = useToast();

  // Plan form state
  const [planName, setPlanName] = useState("");
  const [planType, setPlanType] = useState("split");
  const [payPeriod, setPayPeriod] = useState("weekly");
  const [rentAmount, setRentAmount] = useState("");
  const [tiers, setTiers] = useState([{ min_revenue: 0, max_revenue: "", barber_pct: "60", shop_pct: "40" }]);
  const [selectedBarberIds, setSelectedBarberIds] = useState([]);
  const [savingPlan, setSavingPlan] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [p, b] = await Promise.all([api.adminCompPlans(), api.adminBarbers()]);
      setPlans(p || []);
      setBarbers(Array.isArray(b) ? b : []);
    } catch (err) { Alert.alert("Error", err.message); }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const { from, to } = periodDates(earningsPeriod);
    api.adminEarnings(from, to).then(e => setEarnings(e || [])).catch(() => {});
  }, [earningsPeriod, plans]);

  useEffect(() => {
    api.adminPayoutHistory().then(p => setPayouts(p || [])).catch(() => {});
  }, []);

  async function handlePayout(barberEarnings) {
    const { from, to } = periodDates(earningsPeriod);
    const cardAmount = barberEarnings.card_collected || 0;
    if (cardAmount <= 0) {
      Alert.alert("No card earnings", "This barber has no card earnings to transfer for this period. Cash must be settled in person.");
      return;
    }
    Alert.alert(
      "Process Payout",
      `Transfer ${fmtMoney(Math.min(cardAmount, barberEarnings.barber_take))} to ${barberEarnings.barber_name} via Stripe?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Transfer", onPress: async () => {
          setPayingBarber(barberEarnings.barber_id);
          try {
            await api.adminProcessPayout({
              barber_id: barberEarnings.barber_id,
              from_date: from,
              to_date: to,
            });
            hapticSuccess();
            showToast("Payout processed");
            const p = await api.adminPayoutHistory();
            setPayouts(p || []);
          } catch (err) { Alert.alert("Error", err.message); }
          setPayingBarber(null);
        }},
      ]
    );
  }

  function openNewPlan() {
    setEditingPlan(null);
    setPlanName("");
    setPlanType("split");
    setPayPeriod("weekly");
    setRentAmount("");
    setTiers([{ min_revenue: 0, max_revenue: "", barber_pct: "60", shop_pct: "40" }]);
    setSelectedBarberIds([]);
    setShowPlanModal(true);
  }

  function openEditPlan(plan) {
    setEditingPlan(plan);
    setPlanName(plan.name);
    setPlanType(plan.type);
    setPayPeriod(plan.pay_period || "weekly");
    setRentAmount(plan.rent_amount ? String(plan.rent_amount) : "");
    setTiers(plan.tiers?.length > 0
      ? plan.tiers.map(t => ({
          min_revenue: t.min_revenue || 0,
          max_revenue: t.max_revenue ? String(t.max_revenue) : "",
          barber_pct: String(t.barber_pct),
          shop_pct: String(t.shop_pct),
        }))
      : [{ min_revenue: 0, max_revenue: "", barber_pct: "60", shop_pct: "40" }]
    );
    setSelectedBarberIds(barbers.filter(b => b.compensation_plan_id === plan.id).map(b => b.id));
    setShowPlanModal(true);
  }

  function toggleBarberSelection(barberId) {
    setSelectedBarberIds(prev =>
      prev.includes(barberId) ? prev.filter(id => id !== barberId) : [...prev, barberId]
    );
  }

  async function savePlan() {
    if (!planName.trim()) { Alert.alert("Required", "Enter a plan name"); return; }
    setSavingPlan(true);
    const data = {
      name: planName.trim(),
      type: planType,
      pay_period: payPeriod,
      rent_amount: parseFloat(rentAmount) || 0,
      tiers: tiers.map(t => ({
        min_revenue: parseFloat(t.min_revenue) || 0,
        max_revenue: t.max_revenue ? parseFloat(t.max_revenue) : null,
        barber_pct: parseFloat(t.barber_pct) || 0,
        shop_pct: parseFloat(t.shop_pct) || 0,
      })),
    };
    try {
      let planId;
      if (editingPlan) {
        await api.adminUpdateCompPlan(editingPlan.id, data);
        planId = editingPlan.id;
      } else {
        const res = await api.adminCreateCompPlan(data);
        planId = res.id;
      }
      // Assign selected barbers to this plan, unassign others
      await Promise.all(barbers.map(b => {
        const shouldHave = selectedBarberIds.includes(b.id);
        const hasIt = b.compensation_plan_id === planId;
        if (shouldHave && !hasIt) return api.adminAssignBarberPlan(b.id, planId);
        if (!shouldHave && hasIt) return api.adminAssignBarberPlan(b.id, null);
        return Promise.resolve();
      }));
      hapticSuccess(); showToast(editingPlan ? "Plan updated" : "Plan created");
      setShowPlanModal(false);
      load(true);
    } catch (err) { Alert.alert("Error", err.message); }
    setSavingPlan(false);
  }

  async function deletePlan(plan) {
    Alert.alert("Delete plan", `Delete "${plan.name}"? Barbers using this plan will be unassigned.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await api.adminDeleteCompPlan(plan.id);
          hapticSuccess(); showToast("Plan deleted");
          load(true);
        } catch (err) { Alert.alert("Error", err.message); }
      }},
    ]);
  }

  async function assignPlan(barberId, planId) {
    try {
      await api.adminAssignBarberPlan(barberId, planId || null);
      hapticSuccess(); showToast("Plan assigned");
      load(true);
    } catch (err) { Alert.alert("Error", err.message); }
  }

  function addTier() {
    const lastMax = tiers[tiers.length - 1]?.max_revenue;
    setTiers([...tiers, {
      min_revenue: lastMax ? parseFloat(lastMax) : 0,
      max_revenue: "",
      barber_pct: "70",
      shop_pct: "30",
    }]);
  }

  function updateTier(idx, field, val) {
    const updated = [...tiers];
    updated[idx] = { ...updated[idx], [field]: val };
    // Auto-calc complement
    if (field === "barber_pct") updated[idx].shop_pct = String(100 - (parseFloat(val) || 0));
    if (field === "shop_pct") updated[idx].barber_pct = String(100 - (parseFloat(val) || 0));
    setTiers(updated);
  }

  function removeTier(idx) {
    if (tiers.length <= 1) return;
    setTiers(tiers.filter((_, i) => i !== idx));
  }

  const totalShopTake = earnings.reduce((s, e) => s + (e.shop_take || 0), 0);
  const totalBarberTake = earnings.reduce((s, e) => s + (e.barber_take || 0), 0);
  const totalGross = earnings.reduce((s, e) => s + (e.gross_revenue || 0), 0);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.ink} />}
      keyboardShouldPersistTaps="handled"
    >
      {/* Earnings Summary */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Earnings</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {[
              { key: "week", label: "This week" },
              { key: "month", label: "This month" },
              { key: "last_month", label: "Last month" },
              { key: "year", label: "This year" },
            ].map(p => (
              <TouchableOpacity
                key={p.key}
                style={[styles.periodPill, earningsPeriod === p.key && styles.periodPillActive]}
                onPress={() => setEarningsPeriod(p.key)}
              >
                <Text style={[styles.periodPillText, earningsPeriod === p.key && styles.periodPillTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Totals */}
        <View style={styles.totalsRow}>
          <View style={styles.totalItem}>
            <Text style={styles.totalVal}>{fmtMoney(totalGross)}</Text>
            <Text style={styles.totalLbl}>Gross</Text>
          </View>
          <View style={styles.totalItem}>
            <Text style={styles.totalVal}>{fmtMoney(totalShopTake)}</Text>
            <Text style={styles.totalLbl}>Shop keeps</Text>
          </View>
          <View style={styles.totalItem}>
            <Text style={styles.totalVal}>{fmtMoney(totalBarberTake)}</Text>
            <Text style={styles.totalLbl}>Barber takes</Text>
          </View>
        </View>

        {/* Per-barber earnings */}
        {earnings.map(e => (
          <View key={e.barber_id} style={styles.earningsRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.earningsName}>{e.barber_name}</Text>
              <Text style={styles.earningsMeta}>
                {e.booking_count} booking{e.booking_count !== 1 ? "s" : ""} · {e.plan ? e.plan.name : "No plan"}
              </Text>
              {e.breakdown ? <Text style={styles.earningsBreakdown}>{e.breakdown}</Text> : null}
              {(e.total_tips > 0 || e.cash_collected > 0 || e.card_collected > 0) ? (
                <Text style={styles.earningsPayment}>
                  {e.total_tips > 0 ? `Tips: ${fmtMoney(e.total_tips)}` : ""}
                  {e.total_tips > 0 && (e.cash_collected > 0 || e.card_collected > 0) ? "  ·  " : ""}
                  {e.cash_collected > 0 ? `Cash: ${fmtMoney(e.cash_collected)}` : ""}
                  {e.cash_collected > 0 && e.card_collected > 0 ? "  ·  " : ""}
                  {e.card_collected > 0 ? `Card: ${fmtMoney(e.card_collected)}` : ""}
                </Text>
              ) : null}
            </View>
            <View style={styles.earningsAmounts}>
              <Text style={styles.earningsBarber}>{fmtMoney(e.barber_take)}</Text>
              <Text style={styles.earningsShop}>{fmtMoney(e.shop_take)} shop</Text>
              {e.card_collected > 0 && (
                <TouchableOpacity
                  style={[styles.payoutBtn, payingBarber === e.barber_id && { opacity: 0.6 }]}
                  onPress={() => handlePayout(e)}
                  disabled={payingBarber === e.barber_id}
                >
                  <Text style={styles.payoutBtnText}>
                    {payingBarber === e.barber_id ? "Processing..." : "Process Payout"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
        {earnings.length === 0 && !loading && <Text style={styles.emptyText}>No earnings data for this period</Text>}
      </View>

      {/* Plans */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Compensation plans</Text>
          <TouchableOpacity style={styles.newPlanBtn} onPress={openNewPlan}>
            <Text style={styles.newPlanBtnText}>New plan</Text>
          </TouchableOpacity>
        </View>

        {loading ? <ActivityIndicator color={C.ink} style={{ marginVertical: 20 }} /> : (
          plans.length === 0 ? (
            <Text style={styles.emptyText}>No plans created yet. Create a plan and assign it to your barbers.</Text>
          ) : plans.map(plan => (
            <View key={plan.id} style={styles.planCard}>
              <View style={styles.planHeader}>
                <View>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planMeta}>
                    {plan.type === "rent" ? `Chair rent · ${fmtMoney(plan.rent_amount)}/${plan.pay_period}` :
                     plan.type === "split" ? `Commission split · ${plan.pay_period}` :
                     `Tiered split · ${plan.tiers?.length || 0} tiers · ${plan.pay_period}`}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <TouchableOpacity style={styles.planEditBtn} onPress={() => openEditPlan(plan)}>
                    <Text style={styles.planEditBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deletePlan(plan)}>
                    <Text style={{ fontFamily: F.regular, fontSize: 16, color: C.danger }}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {plan.tiers?.map((t, i) => (
                <Text key={i} style={styles.tierLine}>
                  {plan.type === "rent" ? `${fmtMoney(plan.rent_amount)} per ${plan.pay_period}` :
                   `${fmtMoney(t.min_revenue)}–${t.max_revenue ? fmtMoney(t.max_revenue) : "∞"}: ${t.barber_pct}% barber / ${t.shop_pct}% shop`}
                </Text>
              ))}
            </View>
          ))
        )}
      </View>

      {/* Assign Plans to Barbers */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Assign plans</Text>
        {barbers.map(b => {
          const currentPlan = plans.find(p => p.id === b.compensation_plan_id);
          return (
            <View key={b.id} style={styles.assignRow}>
              <View style={styles.assignHeader}>
                <Text style={styles.assignName} numberOfLines={1}>{b.name}</Text>
                <Text style={styles.assignCurrent}>{currentPlan ? currentPlan.name : "No plan"}</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <TouchableOpacity
                    style={[styles.assignPill, !b.compensation_plan_id && styles.assignPillActive]}
                    onPress={() => assignPlan(b.id, null)}
                  >
                    <Text style={[styles.assignPillText, !b.compensation_plan_id && styles.assignPillTextActive]}>None</Text>
                  </TouchableOpacity>
                  {plans.map(p => (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.assignPill, b.compensation_plan_id === p.id && styles.assignPillActive]}
                      onPress={() => assignPlan(b.id, p.id)}
                    >
                      <Text style={[styles.assignPillText, b.compensation_plan_id === p.id && styles.assignPillTextActive]}>{p.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          );
        })}
      </View>

      {/* Payout History */}
      {payouts.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payout history</Text>
          {payouts.slice(0, 20).map(p => (
            <View key={p.id} style={styles.payoutRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.earningsName}>{p.barber_name}</Text>
                <Text style={styles.earningsMeta}>
                  {p.period_from} to {p.period_to}
                  {p.stripe_transfer_id ? ` · ${p.stripe_transfer_id.slice(0, 12)}...` : ""}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.earningsBarber}>{fmtMoney(p.amount / 100)}</Text>
                <Text style={[styles.earningsMeta, { color: p.status === "completed" ? C.success : C.muted }]}>
                  {p.status === "completed" ? "Completed" : p.status}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 40 }} />

      {/* Plan Create/Edit Modal */}
      <Modal visible={showPlanModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{editingPlan ? "Edit Plan" : "New Compensation Plan"}</Text>

              <Text style={styles.label}>Plan name</Text>
              <TextInput style={styles.input} value={planName} onChangeText={setPlanName} placeholder="Senior barber split" placeholderTextColor={C.muted} />

              <Text style={styles.label}>Type</Text>
              <View style={{ flexDirection: "row", gap: 6, marginBottom: 14 }}>
                {PLAN_TYPES.map(t => (
                  <TouchableOpacity key={t.key} style={[styles.typePill, planType === t.key && styles.typePillActive]} onPress={() => setPlanType(t.key)}>
                    <Text style={[styles.typePillText, planType === t.key && styles.typePillTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Pay period</Text>
              <View style={{ flexDirection: "row", gap: 6, marginBottom: 14 }}>
                {PAY_PERIODS.map(p => (
                  <TouchableOpacity key={p.key} style={[styles.typePill, payPeriod === p.key && styles.typePillActive]} onPress={() => setPayPeriod(p.key)}>
                    <Text style={[styles.typePillText, payPeriod === p.key && styles.typePillTextActive]}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {planType === "rent" && (
                <>
                  <Text style={styles.label}>Rent amount ($)</Text>
                  <TextInput style={styles.input} value={rentAmount} onChangeText={setRentAmount} placeholder="2000" placeholderTextColor={C.muted} keyboardType="numeric" />
                </>
              )}

              {(planType === "split" || planType === "tiered") && (
                <>
                  <Text style={styles.label}>{planType === "tiered" ? "Revenue Tiers" : "Split"}</Text>
                  {tiers.map((t, i) => (
                    <View key={i} style={styles.tierCard}>
                      {planType === "tiered" && (
                        <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.tierLabel}>From ($)</Text>
                            <TextInput style={styles.tierInput} value={String(t.min_revenue)} onChangeText={v => updateTier(i, "min_revenue", v)} keyboardType="numeric" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.tierLabel}>To ($)</Text>
                            <TextInput style={styles.tierInput} value={t.max_revenue} onChangeText={v => updateTier(i, "max_revenue", v)} placeholder="∞" placeholderTextColor={C.muted} keyboardType="numeric" />
                          </View>
                          {tiers.length > 1 && (
                            <TouchableOpacity onPress={() => removeTier(i)} style={{ paddingTop: 18 }}>
                              <Text style={{ color: C.danger, fontFamily: F.regular, fontSize: 14 }}>✕</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.tierLabel}>Barber %</Text>
                          <TextInput style={styles.tierInput} value={t.barber_pct} onChangeText={v => updateTier(i, "barber_pct", v)} keyboardType="numeric" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.tierLabel}>Shop %</Text>
                          <TextInput style={styles.tierInput} value={t.shop_pct} onChangeText={v => updateTier(i, "shop_pct", v)} keyboardType="numeric" />
                        </View>
                      </View>
                    </View>
                  ))}
                  {planType === "tiered" && (
                    <TouchableOpacity style={styles.addTierBtn} onPress={addTier}>
                      <Text style={styles.addTierBtnText}>Add tier</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              <Text style={styles.label}>Apply to Barbers</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {barbers.map(b => {
                  const selected = selectedBarberIds.includes(b.id);
                  return (
                    <TouchableOpacity
                      key={b.id}
                      style={[styles.barberChip, selected && styles.barberChipActive]}
                      onPress={() => toggleBarberSelection(b.id)}
                    >
                      <Text style={[styles.barberChipText, selected && styles.barberChipTextActive]}>{b.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowPlanModal(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalSaveBtn, savingPlan && { opacity: 0.6 }]} onPress={savePlan} disabled={savingPlan}>
                  <Text style={styles.modalSaveText}>{savingPlan ? "Saving…" : editingPlan ? "Save Changes" : "Create Plan"}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Toast {...toastProps} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.paper },
  card: { margin: 16, marginBottom: 0, backgroundColor: C.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.line },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  cardTitle: { fontSize: 17, fontFamily: F.regular, color: C.ink, marginBottom: 14 },

  // Period pills
  periodPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: C.line },
  periodPillActive: { backgroundColor: C.blueSoft, borderColor: C.blueSoft },
  periodPillText: { fontSize: 12, fontFamily: F.semibold, color: C.muted },
  periodPillTextActive: { color: C.blue },

  // Totals
  totalsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  totalItem: { alignItems: "center" },
  totalVal: { fontSize: 20, fontFamily: F.regular, color: C.ink },
  totalLbl: { fontSize: 11, fontFamily: F.monoMedium, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginTop: 2 },

  // Earnings rows
  earningsRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  earningsName: { fontSize: 14, fontFamily: F.semibold, color: C.ink },
  earningsMeta: { fontFamily: F.regular, fontSize: 11, color: C.muted, marginTop: 1 },
  earningsBreakdown: { fontSize: 13, color: C.muted, fontFamily: F.regular, marginTop: 2 },
  earningsPayment: { fontSize: 11, color: C.muted, fontFamily: F.semibold, marginTop: 2 },
  earningsAmounts: { alignItems: "flex-end" },
  earningsBarber: { fontSize: 16, fontFamily: F.regular, color: C.ink },
  earningsShop: { fontSize: 11, color: C.muted, fontFamily: F.semibold },
  payoutBtn: { marginTop: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: "rgba(5,150,105,0.1)" },
  payoutBtnText: { fontSize: 11, fontFamily: F.semibold, color: C.success },
  payoutRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },

  // Plans
  newPlanBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: C.blue },
  newPlanBtnText: { fontSize: 12, fontFamily: F.semibold, color: C.paper },
  planCard: { backgroundColor: C.sunk, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.line },
  planHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  planName: { fontSize: 14, fontFamily: F.semibold, color: C.ink },
  planMeta: { fontFamily: F.regular, fontSize: 11, color: C.muted, marginTop: 2 },
  planEditBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: C.line },
  planEditBtnText: { fontSize: 11, fontFamily: F.semibold, color: C.ink },
  tierLine: { fontSize: 11, color: C.ink, fontFamily: F.semibold, marginTop: 6, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: C.blue },

  // Assign
  assignRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  assignHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  assignName: { fontSize: 14, fontFamily: F.semibold, color: C.ink, flex: 1 },
  assignCurrent: { fontSize: 11, color: C.muted, fontFamily: F.semibold },
  assignPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: C.line },
  assignPillActive: { backgroundColor: C.blue, borderColor: C.blue },
  assignPillText: { fontSize: 11, fontFamily: F.semibold, color: C.muted },
  assignPillTextActive: { color: C.onBlue },

  emptyText: { fontFamily: F.regular, fontSize: 13, color: C.muted, fontStyle: "italic", textAlign: "center", paddingVertical: 16 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(14,14,12,0.45)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, maxHeight: "90%" },
  modalTitle: { fontSize: 20, fontFamily: F.regular, color: C.ink, marginBottom: 16 },
  label: { fontSize: 14, fontFamily: F.medium, color: C.ink, marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontFamily: F.regular, fontSize: 15, color: C.ink, borderWidth: 1, borderColor: C.lineStrong },
  typePill: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: C.line, alignItems: "center" },
  typePillActive: { backgroundColor: C.blue, borderColor: C.blue },
  typePillText: { fontSize: 11, fontFamily: F.semibold, color: C.muted },
  typePillTextActive: { color: C.onBlue },
  tierCard: { backgroundColor: C.sunk, borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: C.line },
  tierLabel: { fontSize: 11, fontFamily: F.semibold, color: C.muted, textTransform: "uppercase", marginBottom: 4 },
  tierInput: { backgroundColor: C.surface, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 8, fontFamily: F.regular, fontSize: 13, color: C.ink, borderWidth: 1, borderColor: C.line, textAlign: "center" },
  addTierBtn: { paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: C.line, borderRadius: 8, borderStyle: "dashed", marginBottom: 8 },
  addTierBtnText: { fontSize: 12, fontFamily: F.semibold, color: C.blue },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 20 },
  modalCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: C.line, alignItems: "center" },
  modalCancelText: { fontSize: 14, fontFamily: F.semibold, color: C.muted },
  modalSaveBtn: { flex: 2, paddingVertical: 12, borderRadius: 12, backgroundColor: C.blue, alignItems: "center" },
  modalSaveText: { fontSize: 14, fontFamily: F.semibold, color: C.paper },
  barberChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface },
  barberChipActive: { backgroundColor: C.blueSoft, borderColor: C.blueSoft },
  barberChipText: { fontSize: 12, fontFamily: F.semibold, color: C.muted },
  barberChipTextActive: { color: C.blue },
});
