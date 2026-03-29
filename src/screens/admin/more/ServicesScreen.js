import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, RefreshControl,
} from "react-native";
import { api } from "../../../lib/api";
import { C, serif, fmtMoney } from "../../../lib/theme";
import { success as hapticSuccess } from "../../../lib/haptics";
import { useToast, Toast } from "../../../components/Toast";

export default function ServicesScreen() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);

  // Add form state
  const [name, setName]         = useState("");
  const [duration, setDuration] = useState("");
  const [price, setPrice]       = useState("");
  const [desc, setDesc]         = useState("");
  const [adding, setAdding]     = useState(false);
  const [addError, setAddError] = useState("");
  const { showToast, toastProps } = useToast();

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try { setServices(await api.adminServices()); }
    catch (err) { Alert.alert("Error", err.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  async function addService() {
    setAddError("");
    if (!name.trim())     { setAddError("Service name is required."); return; }
    if (!duration.trim()) { setAddError("Duration is required."); return; }
    if (!price.trim())    { setAddError("Price is required."); return; }
    setAdding(true);
    try {
      await api.adminAddService({ name: name.trim(), duration_min: parseInt(duration), price: parseFloat(price), description: desc.trim() });
      setName(""); setDuration(""); setPrice(""); setDesc("");
      hapticSuccess(); showToast("Service added!");
      load(true);
    } catch (err) { setAddError(err.message); }
    finally { setAdding(false); }
  }

  function startEdit(s) {
    setEditingId(s.id);
    setEditData({ name: s.name, duration_min: String(s.duration_min), price: String(s.price), description: s.description || "" });
  }

  async function saveEdit(id) {
    if (!editData.name?.trim() || !editData.duration_min || !editData.price) {
      Alert.alert("Missing fields", "Name, duration, and price are required.");
      return;
    }
    setSaving(true);
    try {
      await api.adminUpdateService(id, {
        name: editData.name.trim(),
        duration_min: parseInt(editData.duration_min),
        price: parseFloat(editData.price),
        description: editData.description?.trim() || "",
      });
      setEditingId(null);
      hapticSuccess(); showToast("Service updated");
      load(true);
    } catch (err) { Alert.alert("Error", err.message); }
    finally { setSaving(false); }
  }

  async function deleteService(id, svcName) {
    Alert.alert("Delete Service", `Delete "${svcName}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try { await api.adminDeleteService(id); load(true); }
        catch (err) { Alert.alert("Error", err.message); }
      }},
    ]);
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.espresso} />}
      keyboardShouldPersistTaps="handled"
    >
      {/* Add Service form */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Add Service</Text>
        <View style={styles.formRow}>
          <View style={{ flex: 2 }}>
            <Text style={styles.label}>Service Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Haircut & Fade" placeholderTextColor={C.muted} />
          </View>
        </View>
        <View style={styles.formRow}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.label}>Duration (min)</Text>
            <TextInput style={styles.input} value={duration} onChangeText={setDuration} placeholder="45" placeholderTextColor={C.muted} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Price ($)</Text>
            <TextInput style={styles.input} value={price} onChangeText={setPrice} placeholder="35" placeholderTextColor={C.muted} keyboardType="decimal-pad" />
          </View>
        </View>
        <View style={styles.formRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Description <Text style={styles.labelOpt}>(optional)</Text></Text>
            <TextInput style={styles.input} value={desc} onChangeText={setDesc} placeholder="e.g. Classic taper with skin fade" placeholderTextColor={C.muted} />
          </View>
        </View>
        {addError ? <Text style={styles.error}>{addError}</Text> : null}
        <TouchableOpacity style={[styles.addBtn, adding && { opacity: 0.6 }]} onPress={addService} disabled={adding}>
          <Text style={styles.addBtnText}>{adding ? "Adding…" : "Add Service →"}</Text>
        </TouchableOpacity>
      </View>

      {/* Service list */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Services</Text>
        {loading ? (
          <ActivityIndicator color={C.espresso} style={{ marginTop: 20 }} />
        ) : services.length === 0 ? (
          <Text style={styles.empty}>No services yet.</Text>
        ) : (
          services.map(s => (
            <View key={s.id}>
              {editingId === s.id ? (
                // ── Inline edit form ──
                <View style={[styles.svcRow, styles.svcRowEditing]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Name</Text>
                    <TextInput
                      style={styles.input}
                      value={editData.name}
                      onChangeText={v => setEditData({ ...editData, name: v })}
                      autoFocus
                    />
                    <View style={styles.editInlineRow}>
                      <View style={{ flex: 1, marginRight: 6 }}>
                        <Text style={[styles.label, { marginTop: 8 }]}>Duration (min)</Text>
                        <TextInput
                          style={styles.input}
                          value={editData.duration_min}
                          onChangeText={v => setEditData({ ...editData, duration_min: v })}
                          keyboardType="number-pad"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.label, { marginTop: 8 }]}>Price ($)</Text>
                        <TextInput
                          style={styles.input}
                          value={editData.price}
                          onChangeText={v => setEditData({ ...editData, price: v })}
                          keyboardType="decimal-pad"
                        />
                      </View>
                    </View>
                    <Text style={[styles.label, { marginTop: 8 }]}>Description</Text>
                    <TextInput
                      style={styles.input}
                      value={editData.description}
                      onChangeText={v => setEditData({ ...editData, description: v })}
                      placeholder="Optional"
                      placeholderTextColor={C.muted}
                    />
                    <View style={styles.editActions}>
                      <TouchableOpacity style={styles.editCancelBtn} onPress={() => setEditingId(null)}>
                        <Text style={styles.editCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.editSaveBtn, saving && { opacity: 0.6 }]} onPress={() => saveEdit(s.id)} disabled={saving}>
                        <Text style={styles.editSaveText}>{saving ? "Saving…" : "Save Changes"}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ) : (
                // ── Display row ──
                <View style={styles.svcRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.svcName}>{s.name}</Text>
                    <Text style={styles.svcMeta}>{s.duration_min}min · {fmtMoney(s.price)}</Text>
                    {s.description ? <Text style={styles.svcDesc}>{s.description}</Text> : null}
                  </View>
                  <View style={styles.svcActions}>
                    <TouchableOpacity style={styles.editBtn} onPress={() => startEdit(s)}>
                      <Text style={styles.editBtnText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteService(s.id, s.name)}>
                      <Text style={styles.deleteBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ))
        )}
      </View>

      <View style={{ height: 32 }} />
      <Toast {...toastProps} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  card: { margin: 16, backgroundColor: C.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border },
  cardTitle: { fontFamily: serif, fontSize: 17, fontWeight: "700", color: C.espresso, marginBottom: 14 },
  formRow: { flexDirection: "row", marginBottom: 12 },
  label: { fontSize: 10, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 },
  labelOpt: { fontSize: 10, fontWeight: "400", color: C.muted, textTransform: "none", letterSpacing: 0 },
  input: { backgroundColor: C.surface, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.espresso, borderWidth: 1, borderColor: C.border },
  error: { fontSize: 13, color: C.terra, fontWeight: "600", marginBottom: 8 },
  addBtn: { backgroundColor: C.espresso, borderRadius: 9, paddingVertical: 12, alignItems: "center", marginTop: 4 },
  addBtnText: { fontSize: 14, fontWeight: "800", color: C.cream },
  section: { marginHorizontal: 16 },
  sectionTitle: { fontFamily: serif, fontSize: 17, fontWeight: "700", color: C.espresso, marginBottom: 12 },
  svcRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.white, borderRadius: 10, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: C.border,
  },
  svcRowEditing: { flexDirection: "column", alignItems: "stretch" },
  svcName: { fontSize: 15, fontWeight: "700", color: C.espresso },
  svcMeta: { fontSize: 12, color: C.muted, marginTop: 2 },
  svcDesc: { fontSize: 11, color: C.muted, marginTop: 2, fontStyle: "italic" },
  svcActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  editBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 7, borderWidth: 1.5, borderColor: C.border },
  editBtnText: { fontSize: 12, fontWeight: "700", color: C.espresso },
  deleteBtn: { padding: 8 },
  deleteBtnText: { fontSize: 16, color: C.muted, fontWeight: "600" },
  editInlineRow: { flexDirection: "row" },
  editActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  editCancelBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, borderWidth: 1.5, borderColor: C.border, alignItems: "center" },
  editCancelText: { fontSize: 13, fontWeight: "700", color: C.espresso },
  editSaveBtn: { flex: 2, paddingVertical: 10, borderRadius: 9, backgroundColor: C.espresso, alignItems: "center" },
  editSaveText: { fontSize: 13, fontWeight: "800", color: C.cream },
  empty: { color: C.muted, fontSize: 14, paddingTop: 20, textAlign: "center" },
});
