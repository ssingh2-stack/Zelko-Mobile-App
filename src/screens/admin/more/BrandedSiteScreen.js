import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Image, Alert, Linking, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { api } from "../../../lib/api";
import { C, serif } from "../../../lib/theme";

const PRESET_COLORS = [
  "#C4683E", // terra (default)
  "#2C1810", // espresso
  "#1A1A1A", // black
  "#0F4C5C", // teal
  "#4A6B8A", // steel blue
  "#7B4B94", // plum
  "#8C6B2C", // gold
  "#994D3A", // brick
];

export default function BrandedSiteScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tagline, setTagline] = useState("");
  const [about, setAbout] = useState("");
  const [heroImage, setHeroImage] = useState("");
  const [brandColor, setBrandColor] = useState("#C4683E");
  const [instagram, setInstagram] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [photos, setPhotos] = useState([]);
  const [photoUploading, setPhotoUploading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api.adminGetSite();
      setTagline(data.site_tagline || "");
      setAbout(data.site_about || "");
      setHeroImage(data.site_hero_image || "");
      setBrandColor(data.site_brand_color || "#C4683E");
      setInstagram(data.site_instagram || "");
      setPreviewUrl(data.preview_url || "");
      setSiteUrl(data.site_url_display || data.preview_url || "");
      loadPhotos();
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  }

  async function pickHeroImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please grant photo access to upload a hero image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 10],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setUploading(true);
    try {
      const res = await api.adminUpload(result.assets[0].uri, "hero");
      if (res.url) {
        setHeroImage(res.url);
        Alert.alert("Uploaded", "Hero image saved.");
      }
    } catch (err) {
      Alert.alert("Upload failed", err.message);
    } finally {
      setUploading(false);
    }
  }

  async function clearHero() {
    Alert.alert("Remove hero image?", null, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        try {
          await api.adminUpdateSite({ site_hero_image: "" });
          setHeroImage("");
        } catch (err) { Alert.alert("Error", err.message); }
      }},
    ]);
  }

  async function loadPhotos() {
    try {
      const data = await api.adminGetPhotos();
      setPhotos(Array.isArray(data) ? data : []);
    } catch (err) { /* silent */ }
  }

  async function addGalleryPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please grant photo access to upload gallery photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 6,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.length) return;
    setPhotoUploading(true);
    try {
      for (const asset of result.assets) {
        await api.adminUpload(asset.uri, "gallery");
      }
      await loadPhotos();
    } catch (err) {
      Alert.alert("Upload failed", err.message);
    } finally {
      setPhotoUploading(false);
    }
  }

  function deleteGalleryPhoto(id) {
    Alert.alert("Remove this photo?", null, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        try {
          await api.adminDeletePhoto(id);
          await loadPhotos();
        } catch (err) { Alert.alert("Error", err.message); }
      }},
    ]);
  }

  async function save() {
    setSaving(true);
    try {
      await api.adminUpdateSite({
        site_tagline: tagline,
        site_about: about,
        site_brand_color: brandColor,
        site_instagram: instagram,
      });
      Alert.alert("Saved", "Your branded site is updated.");
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  }

  function openPreview() {
    if (previewUrl) {
      // previewUrl is now a full URL like https://slug.getclipd.ca/
      // Append cache-buster so the latest content is always fetched
      const sep = previewUrl.includes('?') ? '&' : '?';
      Linking.openURL(`${previewUrl}${sep}_v=${Date.now()}`);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={C.terra} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Header */}
      <View style={styles.headerBox}>
        <View style={styles.headerIcon}><Ionicons name="globe-outline" size={22} color={C.terra} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Your Branded Site</Text>
          <Text style={styles.headerSub}>A beautiful public landing page that pulls from your bookings, services, team, and reviews.</Text>
        </View>
      </View>

      {/* Preview link */}
      <TouchableOpacity style={styles.urlCard} onPress={openPreview}>
        <View style={{ flex: 1 }}>
          <Text style={styles.urlLabel}>YOUR SITE URL</Text>
          <Text style={styles.urlValue} numberOfLines={1}>{siteUrl}</Text>
        </View>
        <Ionicons name="open-outline" size={18} color={C.terra} />
      </TouchableOpacity>

      {/* Hero Image */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>HERO BACKGROUND IMAGE</Text>
        {heroImage ? (
          <Image source={{ uri: heroImage }} style={styles.heroPreview} />
        ) : (
          <View style={[styles.heroPreview, styles.heroPlaceholder]}>
            <Ionicons name="image-outline" size={32} color={C.muted} />
            <Text style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>No hero image yet</Text>
          </View>
        )}
        <View style={styles.heroBtnRow}>
          <TouchableOpacity style={styles.heroBtn} onPress={pickHeroImage} disabled={uploading}>
            <Ionicons name="camera-outline" size={16} color={C.cream} />
            <Text style={styles.heroBtnText}>{uploading ? "Uploading..." : (heroImage ? "Change Image" : "Choose Image")}</Text>
          </TouchableOpacity>
          {heroImage && (
            <TouchableOpacity style={styles.heroBtnGhost} onPress={clearHero}>
              <Text style={styles.heroBtnGhostText}>Remove</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.helperText}>Recommended 1920×1200 · Max 5MB · JPG/PNG/WebP</Text>
      </View>

      {/* Tagline */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>TAGLINE</Text>
        <Text style={styles.helperText}>Shows under your shop name in the hero. Keep it short.</Text>
        <TextInput
          style={styles.input}
          value={tagline}
          onChangeText={setTagline}
          placeholder="Toronto's premier destination for the perfect cut."
          placeholderTextColor={C.muted}
          maxLength={160}
        />
      </View>

      {/* About section removed — didn't drive conversions. Field still in DB. */}

      {/* Brand Color */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>BRAND COLOR</Text>
        <Text style={styles.helperText}>Used for buttons and accents on your site.</Text>
        <View style={styles.colorRow}>
          {PRESET_COLORS.map((color) => {
            const active = brandColor === color;
            return (
              <TouchableOpacity
                key={color}
                style={[styles.colorSwatch, { backgroundColor: color }, active && styles.colorSwatchActive]}
                onPress={() => setBrandColor(color)}
              >
                {active && <Ionicons name="checkmark" size={18} color="#fff" />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Instagram */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>INSTAGRAM (OPTIONAL)</Text>
        <TextInput
          style={styles.input}
          value={instagram}
          onChangeText={setInstagram}
          placeholder="yourshop"
          placeholderTextColor={C.muted}
          autoCapitalize="none"
        />
      </View>

      {/* Photo Gallery */}
      <View style={styles.section}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <Text style={styles.sectionLabel}>PHOTO GALLERY</Text>
          <TouchableOpacity onPress={addGalleryPhoto} disabled={photoUploading} style={styles.galleryAddBtn}>
            <Ionicons name="add" size={14} color={C.cream} />
            <Text style={styles.galleryAddText}>{photoUploading ? "Uploading…" : "Add"}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.helperText}>Show off your best work. Up to 6 at a time.</Text>
        {photos.length === 0 ? (
          <View style={styles.galleryEmpty}>
            <Ionicons name="images-outline" size={28} color={C.muted} />
            <Text style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>No photos yet</Text>
          </View>
        ) : (
          <View style={styles.galleryGrid}>
            {photos.map((p) => (
              <View key={p.id} style={styles.galleryItem}>
                <Image source={{ uri: p.url }} style={styles.galleryImg} />
                <TouchableOpacity style={styles.galleryDelete} onPress={() => deleteGalleryPhoto(p.id)}>
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Save */}
      <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={save} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save Changes"}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.previewBtn} onPress={openPreview}>
        <Ionicons name="open-outline" size={16} color={C.terra} />
        <Text style={styles.previewBtnText}>Preview your site</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  center: { alignItems: "center", justifyContent: "center" },
  headerBox: {
    flexDirection: "row", gap: 12, padding: 18,
    backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerIcon: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: "rgba(196,104,62,0.1)",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  headerTitle: { fontFamily: serif, fontSize: 20, fontWeight: "900", color: C.espresso, marginBottom: 4 },
  headerSub: { fontSize: 12, color: C.muted, lineHeight: 16 },

  urlCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.white, marginHorizontal: 16, marginTop: 16,
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 10, borderWidth: 1, borderColor: C.border,
  },
  urlLabel: { fontSize: 9, fontWeight: "800", color: C.muted, letterSpacing: 1.2, marginBottom: 2 },
  urlValue: { fontSize: 13, fontWeight: "700", color: C.espresso },

  section: {
    backgroundColor: C.white,
    marginHorizontal: 16, marginTop: 16,
    padding: 16,
    borderRadius: 12, borderWidth: 1, borderColor: C.border,
  },
  sectionLabel: { fontSize: 11, fontWeight: "800", color: C.muted, letterSpacing: 1.2, marginBottom: 4 },
  helperText: { fontSize: 11, color: C.muted, lineHeight: 14, marginBottom: 10 },
  input: {
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
    borderRadius: 8, padding: 12,
    fontSize: 14, color: C.espresso,
  },
  textarea: { minHeight: 100, textAlignVertical: "top" },

  heroPreview: {
    width: "100%", aspectRatio: 16 / 10,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: C.surface,
  },
  heroPlaceholder: { alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: C.border, borderStyle: "dashed" },
  heroBtnRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  heroBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: C.terra,
    paddingVertical: 12, borderRadius: 8,
  },
  heroBtnText: { fontSize: 13, fontWeight: "800", color: C.cream },
  heroBtnGhost: {
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.white,
  },
  heroBtnGhostText: { fontSize: 13, fontWeight: "700", color: C.muted },

  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6 },
  colorSwatch: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "transparent",
  },
  colorSwatchActive: { borderColor: C.espresso, transform: [{ scale: 1.1 }] },

  galleryAddBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.terra, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  galleryAddText: { fontSize: 12, fontWeight: "800", color: C.cream },
  galleryEmpty: { alignItems: "center", paddingVertical: 24, borderWidth: 1.5, borderColor: C.border, borderStyle: "dashed", borderRadius: 10 },
  galleryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  galleryItem: { width: "31.5%", aspectRatio: 1, borderRadius: 8, overflow: "hidden", position: "relative", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  galleryImg: { width: "100%", height: "100%" },
  galleryDelete: { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center" },

  saveBtn: {
    backgroundColor: C.espresso, marginHorizontal: 16, marginTop: 24,
    paddingVertical: 16, borderRadius: 10, alignItems: "center",
  },
  saveBtnText: { fontSize: 15, fontWeight: "900", color: C.cream, letterSpacing: 0.3 },

  previewBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    marginHorizontal: 16, marginTop: 10,
    paddingVertical: 14, borderRadius: 10,
    borderWidth: 1.5, borderColor: C.terra, backgroundColor: "transparent",
  },
  previewBtnText: { fontSize: 14, fontWeight: "800", color: C.terra },
});
