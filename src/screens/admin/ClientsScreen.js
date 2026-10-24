import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, RefreshControl, Alert, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { F, C, fmtMoney, CLIENT_TAGS } from "../../lib/theme";
import ClientProfileModal from "../../components/ClientProfileModal";
import NewBookingModal from "../../components/NewBookingModal";
import { SkeletonList } from "../../components/Skeleton";
import ErrorState from "../../components/ErrorState";
import ScreenTitle from "../../components/ScreenTitle";
import { getCached, setCache } from "../../lib/cache";

const TAG_STYLES = CLIENT_TAGS;

function initials(name) {
  if (!name || !name.trim()) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0][0].toUpperCase();
}

// "2026-10-24" -> "Oct 24" (year only when it isn't this year)
function fmtVisit(iso) {
  if (!iso) return "not yet";
  const [y, m, d] = iso.split("-").map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
  return y === new Date().getFullYear() ? label : `${label}, ${y}`;
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
  const [sortBy, setSortBy] = useState("name");

  const hasDataRef = useRef(false);
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    if (!quiet && !hasDataRef.current) {
      const cached = await getCached("clients");
      if (cached?.data) { setClients(cached.data); hasDataRef.current = true; }
    }
    try {
      const data = await api.adminClients();
      const list = data.clients || data || [];
      setClients(list);
      hasDataRef.current = list.length > 0;
      setError(null);
      setCache("clients", list);
    } catch (err) {
      if (!hasDataRef.current) setError(err.message);
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
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "visits": return (b.visit_count || 0) - (a.visit_count || 0);
        case "spent": return (b.total_spent || 0) - (a.total_spent || 0);
        case "recent": return (b.last_visit || "").localeCompare(a.last_visit || "");
        default: return (a.name || "").localeCompare(b.name || "");
      }
    });
    setFiltered(list);
  }, [clients, search, activeTag, sortBy]);

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
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(c.name)}</Text>
          </View>
          <View style={styles.rowInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
              {primaryTag && tagStyle && (
                <View style={[styles.tag, { backgroundColor: tagStyle.bg, borderColor: tagStyle.border }]}>
                  <Text style={[styles.tagText, { color: tagStyle.text }]}>{tagStyle.label}</Text>
                </View>
              )}
            </View>
            <Text style={styles.meta}>
              {c.visit_count} visit{c.visit_count !== 1 ? "s" : ""} · {fmtMoney(c.total_spent)} spent
              {c.preferred_barber ? ` · ${c.preferred_barber}` : ""}
            </Text>
            {c.last_visit && (
              <Text style={styles.lastVisit}>Last visit {fmtVisit(c.last_visit)}</Text>
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
      <ScreenTitle title="Clients" />
      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchInner}>
          <Ionicons name="search" size={16} color={C.muted} />
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
              <Ionicons name="close-circle" size={18} color={C.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tag filters + sort */}
      <View style={styles.filters}>
        <View style={styles.filterRow}>
          {FILTERS.map(tag => (
            <TouchableOpacity
              key={tag}
              style={[styles.filterBtn, activeTag === tag && styles.filterBtnActive]}
              onPress={() => setActiveTag(tag)}
            >
              <Text style={[styles.filterText, activeTag === tag && styles.filterTextActive]}>
                {tag === "all" ? "All" : CLIENT_TAGS[tag].label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={[styles.filterRow, { marginTop: 6 }]}>
          {[
            { key: "name", label: "A-Z" },
            { key: "recent", label: "Recent" },
            { key: "visits", label: "Visits" },
            { key: "spent", label: "Spent" },
          ].map(s => (
            <TouchableOpacity
              key={s.key}
              style={[styles.filterBtn, sortBy === s.key && styles.sortBtnActive]}
              onPress={() => setSortBy(s.key)}
            >
              <Text style={[styles.filterText, sortBy === s.key && styles.sortTextActive]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Client count */}
      {!loading && (
        <View style={styles.countBar}>
          <Text style={styles.countText}>{filtered.length} client{filtered.length !== 1 ? "s" : ""}</Text>
        </View>
      )}

      {error && clients.length === 0 ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : loading ? (
        <View style={{ flex: 1, padding: 16 }}><SkeletonList count={8} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={c => c.email}
          renderItem={renderClient}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.ink} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="person-outline" size={40} color={C.muted} />
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
        onClientUpdate={() => load(true)}
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
  container: { flex: 1, backgroundColor: C.paper },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  searchWrap: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.paper },
  searchInner: { flexDirection: "row", alignItems: "center", gap: 8, height: 44, paddingHorizontal: 12, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.lineStrong },
  searchIcon: {},
  searchInput: { flex: 1, fontFamily: F.regular, fontSize: 15, color: C.ink },
  searchClear: { padding: 4 },
  searchClearText: { fontFamily: F.regular, fontSize: 13, color: C.muted },

  filters: { paddingHorizontal: 12, paddingBottom: 10, backgroundColor: C.paper },
  filterRow: { flexDirection: "row", paddingHorizontal: 12, gap: 6, alignItems: "center" },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface },
  filterBtnActive: { backgroundColor: C.blueSoft, borderColor: C.blueSoft },
  filterText: { fontSize: 13, fontFamily: F.regular, color: C.muted },
  filterTextActive: { color: C.blue, fontFamily: F.medium },
  sortBtnActive: { backgroundColor: C.sunk, borderColor: C.lineStrong },
  sortTextActive: { color: C.ink, fontFamily: F.medium },

  countBar: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: C.paper, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  countText: { fontSize: 12, fontFamily: F.mono, color: C.muted, textTransform: "uppercase", letterSpacing: 1 },

  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, backgroundColor: C.surface },
  rowLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.blueSoft, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 15, fontFamily: F.medium, color: C.blue },
  rowInfo: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  name: { fontSize: 16, fontFamily: F.medium, color: C.ink },
  tag: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 999, borderWidth: 1 },
  tagText: { fontSize: 11, fontFamily: F.medium },
  meta: { fontSize: 13, fontFamily: F.regular, color: C.muted, marginTop: 2 },
  lastVisit: { fontSize: 12, fontFamily: F.regular, color: C.muted, marginTop: 1 },
  chevron: { fontSize: 22, color: C.lineStrong, fontFamily: F.regular },
  separator: { height: 1, backgroundColor: C.line, marginLeft: 72 },

  empty: { paddingTop: 80, alignItems: "center", gap: 8 },
  emptyIcon: {},
  emptyTitle: { fontSize: 17, fontFamily: F.regular, color: C.muted },
  emptySub: { fontFamily: F.regular, fontSize: 13, color: C.muted },
});
