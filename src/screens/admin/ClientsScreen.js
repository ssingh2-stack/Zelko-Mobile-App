import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, RefreshControl, Alert, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../lib/api";
import { C, serif, fmtMoney } from "../../lib/theme";
import ClientProfileModal from "../../components/ClientProfileModal";
import NewBookingModal from "../../components/NewBookingModal";
import { SkeletonList } from "../../components/Skeleton";
import ErrorState from "../../components/ErrorState";
import { getCached, setCache } from "../../lib/cache";

const TAG_STYLES = {
  vip:     { bg: "#FEF3C7", text: "#92400E", border: "#FDE68A" },
  new:     { bg: "#D1FAE5", text: "#065F46", border: "#6EE7B7" },
  regular: { bg: "#EDE9FE", text: "#5B21B6", border: "#C4B5FD" },
  lapsed:  { bg: "#F3F4F6", text: "#6B7280", border: "#D1D5DB" },
};

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase()
    : name[0].toUpperCase();
}

export default function ClientsScreen() {
  const insets = useSafeAreaInsets();
  const [clients, setClients] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [newBookingClient, setNewBookingClient] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    if (!quiet && clients.length === 0) {
      const cached = await getCached("clients");
      if (cached?.data) setClients(cached.data);
    }
    try {
      const data = await api.adminClients();
      const list = data.clients || data || [];
      setClients(list);
      setError(null);
      setCache("clients", list);
    } catch (err) {
      if (clients.length === 0) setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    let list = clients;
    if (activeTag !== "all") list = list.filter(c => c.tags?.includes(activeTag));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q)
      );
    }
    setFiltered(list);
  }, [clients, search, activeTag]);

  function openProfile(client) {
    setSelectedClient(client);
    setShowProfile(true);
  }

  function handleNewBookingForClient(client) {
    setNewBookingClient(client);
    setShowNewBooking(true);
  }

  function renderClient({ item: c }) {
    const primaryTag = c.tags?.[0];
    const tagStyle = TAG_STYLES[primaryTag];
    return (
      <TouchableOpacity style={styles.row} onPress={() => openProfile(c)} activeOpacity={0.7}>
        <View style={styles.rowLeft}>
          <View style={[styles.avatar, primaryTag && tagStyle && { borderColor: tagStyle.border, borderWidth: 2 }]}>
            <Text style={styles.avatarText}>{initials(c.name)}</Text>
          </View>
          <View style={styles.rowInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{c.name}</Text>
              {primaryTag && tagStyle && (
                <View style={[styles.tag, { backgroundColor: tagStyle.bg, borderColor: tagStyle.border }]}>
                  <Text style={[styles.tagText, { color: tagStyle.text }]}>{primaryTag}</Text>
                </View>
              )}
            </View>
            <Text style={styles.meta}>
              {c.visit_count} visit{c.visit_count !== 1 ? "s" : ""} · {fmtMoney(c.total_spent)} spent
              {c.preferred_barber ? ` · ${c.preferred_barber}` : ""}
            </Text>
            {c.last_visit && (
              <Text style={styles.lastVisit}>Last visit: {c.last_visit}</Text>
            )}
          </View>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    );
  }

  const FILTERS = ["all", "vip", "new", "regular", "lapsed"];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchInner}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, email or phone"
            placeholderTextColor={C.muted}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")} style={styles.searchClear}>
              <Text style={styles.searchClearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tag filters */}
      <View style={styles.filters}>
        {FILTERS.map(tag => (
          <TouchableOpacity
            key={tag}
            style={[styles.filterBtn, activeTag === tag && styles.filterBtnActive]}
            onPress={() => setActiveTag(tag)}
          >
            <Text style={[styles.filterText, activeTag === tag && styles.filterTextActive]}>
              {tag === "all" ? "All" : tag.charAt(0).toUpperCase() + tag.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Client count */}
      {!loading && (
        <View style={styles.countBar}>
          <Text style={styles.countText}>{filtered.length} client{filtered.length !== 1 ? "s" : ""}</Text>
        </View>
      )}

      {loading ? (
        error ? <ErrorState message={error} onRetry={() => load()} /> : <View style={{ flex: 1, padding: 16 }}><SkeletonList count={8} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={c => c.email}
          renderItem={renderClient}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.espresso} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>👤</Text>
              <Text style={styles.emptyTitle}>No clients found</Text>
              {search ? <Text style={styles.emptySub}>Try a different search</Text> : null}
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      <ClientProfileModal
        client={selectedClient}
        visible={showProfile}
        onClose={() => setShowProfile(false)}
        onNewBooking={handleNewBookingForClient}
      />

      <NewBookingModal
        visible={showNewBooking}
        onClose={() => { setShowNewBooking(false); setNewBookingClient(null); }}
        onSuccess={() => load(true)}
        prefillName={newBookingClient?.name}
        prefillPhone={newBookingClient?.phone}
        prefillEmail={newBookingClient?.email}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  searchWrap: { padding: 12, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  searchInner: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.surface, borderRadius: 10,
    paddingHorizontal: 12, gap: 8,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: C.espresso },
  searchClear: { padding: 4 },
  searchClearText: { fontSize: 13, color: C.muted },

  filters: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 10, gap: 6, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1.5, borderColor: C.border },
  filterBtnActive: { backgroundColor: C.espresso, borderColor: C.espresso },
  filterText: { fontSize: 12, fontWeight: "700", color: C.muted },
  filterTextActive: { color: C.cream },

  countBar: { paddingHorizontal: 16, paddingVertical: 6, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  countText: { fontSize: 11, fontWeight: "700", color: C.muted },

  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, backgroundColor: C.white },
  rowLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border },
  avatarText: { fontFamily: serif, fontSize: 16, fontWeight: "700", color: C.espresso },
  rowInfo: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  name: { fontSize: 15, fontWeight: "700", color: C.espresso },
  tag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, borderWidth: 1 },
  tagText: { fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  meta: { fontSize: 12, color: C.muted },
  lastVisit: { fontSize: 11, color: C.muted, marginTop: 1 },
  chevron: { fontSize: 20, color: C.muted, fontWeight: "300", marginLeft: 8 },
  separator: { height: 1, backgroundColor: C.border, marginLeft: 72 },

  empty: { paddingTop: 80, alignItems: "center", gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: C.muted },
  emptySub: { fontSize: 13, color: C.muted },
});
