import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Image, Alert, Linking, ActivityIndicator, Modal, Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { api } from "../../../lib/api";
import { F, C, serif } from "../../../lib/theme";

// Labels and section-layout metadata — kept alongside the screen so any
// preset-name copy tweaks happen in one place. Web uses the same labels via
// the data returned from GET /api/admin/site, so the two stay in sync
// through the shared resolver in services/theme_presets.py.
// Preset cards show the heading font in a small mockup so each preset feels
// visually distinct. System-font approximations only; the rendered site
// still uses the real Google Fonts via CSS.
const PRESET_META = {
  classic:    { label: "Classic",    font: "Georgia" },
  monochrome: { label: "Monochrome", font: "Helvetica Neue" },
  dark:       { label: "Dark",       font: "Menlo" },
  luxe:       { label: "Luxe",       font: "Palatino" },
};
// Font previews use iOS/Android system fonts that approximate each pair's
// feel. We can't load Google Fonts at runtime in React Native without
// bundling them as assets (which requires a native rebuild), so these are
// the closest cross-platform substitutes for a quick preview only. The
// RENDERED shop site uses the real Google Fonts served via CSS.
const FONT_META = {
  playfair_inter:  { label: "Editorial", family: "Georgia",        weight: "700" },
  cormorant_inter: { label: "Elegant",   family: "Didot",          weight: "700" },
  archivo_inter:   { label: "Clean",     family: "Helvetica Neue", weight: "900" },
  space_grotesk:   { label: "Modern",    family: "Menlo",          weight: "700" },
  dm_serif_inter:  { label: "Warm",      family: "Palatino",       weight: "700" },
};
const SECTION_META = {
  team:         { label: "Team",         icon: "people-outline" },
  services:     { label: "Services",     icon: "cut-outline" },
  gallery:      { label: "Gallery",      icon: "images-outline" },
  testimonials: { label: "Testimonials", icon: "chatbubbles-outline" },
};
const DEFAULT_ORDER = ["team", "services", "gallery", "testimonials"];

export default function BrandedSiteScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Legacy fields
  const [tagline, setTagline] = useState("");
  const [about, setAbout] = useState("");
  const [heroImage, setHeroImage] = useState("");
  const [brandColor, setBrandColor] = useState(C.blue);
  const [instagram, setInstagram] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [photos, setPhotos] = useState([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [teamTitle, setTeamTitle] = useState("");
  const [teamSubtitle, setTeamSubtitle] = useState("");
  const [servicesTitle, setServicesTitle] = useState("");
  const [servicesSubtitle, setServicesSubtitle] = useState("");

  // Theme fields (Tier 1)
  const [preset, setPreset] = useState("classic");
  const [fontPair, setFontPair] = useState("playfair_inter");
  const [heroMode, setHeroMode] = useState("image");
  const [heroVideo, setHeroVideo] = useState("");
  const [videoUploading, setVideoUploading] = useState(false);
  const [accentColor, setAccentColor] = useState("");
  const [bgColor, setBgColor] = useState("");
  const [textColor, setTextColor] = useState("");
  const [sectionOrder, setSectionOrder] = useState(DEFAULT_ORDER);
  const [sectionsHidden, setSectionsHidden] = useState([]);
  const [showCustomColors, setShowCustomColors] = useState(false);
  const [themePresets, setThemePresets] = useState({});
  const [fontPairs, setFontPairs] = useState({});

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api.adminGetSite();
      setTagline(data.site_tagline || "");
      setAbout(data.site_about || "");
      setHeroImage(data.site_hero_image || "");
      setBrandColor(data.site_brand_color || C.blue);
      setInstagram(data.site_instagram || "");
      setPreviewUrl(data.preview_url || "");
      setSiteUrl(data.site_url_display || data.preview_url || "");
      setTeamTitle(data.site_team_title || "");
      setTeamSubtitle(data.site_team_subtitle || "");
      setServicesTitle(data.site_services_title || "");
      setServicesSubtitle(data.site_services_subtitle || "");

      setPreset(data.site_theme_preset || "classic");
      setFontPair(data.site_font_pair || "playfair_inter");
      setHeroMode(data.site_hero_mode || "image");
      setHeroVideo(data.site_hero_video || "");
      setAccentColor(data.site_accent_color || "");
      setBgColor(data.site_bg_color || "");
      setTextColor(data.site_text_color || "");

      const defOrd = data._default_section_order || DEFAULT_ORDER;
      let parsedOrder = null;
      try { parsedOrder = data.site_section_order ? JSON.parse(data.site_section_order) : null; } catch (e) {}
      let order = Array.isArray(parsedOrder) && parsedOrder.length ? parsedOrder : defOrd;
      // Append missing sections, drop unknowns
      defOrd.forEach((s) => { if (order.indexOf(s) === -1) order.push(s); });
      order = order.filter((s) => defOrd.indexOf(s) !== -1);
      setSectionOrder(order);

      let parsedHidden = [];
      try { parsedHidden = data.site_sections_hidden ? JSON.parse(data.site_sections_hidden) : []; } catch (e) {}
      setSectionsHidden(Array.isArray(parsedHidden) ? parsedHidden : []);

      setThemePresets(data._theme_presets || {});
      setFontPairs(data._font_pairs || {});

      loadPhotos();
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  }

  async function selectPreset(key) {
    setPreset(key);
    // Clear overrides so the preset values take effect
    setAccentColor(""); setBgColor(""); setTextColor("");
    try {
      await api.adminUpdateSite({
        site_theme_preset: key,
        site_bg_color: "", site_surface_color: "",
        site_text_color: "", site_accent_color: "",
      });
    } catch (err) { Alert.alert("Save failed", err.message); }
  }

  async function selectFontPair(key) {
    setFontPair(key);
    try {
      await api.adminUpdateSite({ site_font_pair: key });
    } catch (err) { Alert.alert("Save failed", err.message); }
  }

  async function selectHeroMode(mode) {
    setHeroMode(mode);
    try {
      await api.adminUpdateSite({ site_hero_mode: mode });
    } catch (err) { Alert.alert("Save failed", err.message); }
  }

  async function pickHeroImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please grant photo access to upload a hero image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 10],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setUploading(true);
    try {
      const asset = result.assets[0];
      const res = await api.adminUpload(asset.uri, "hero", undefined, asset.mimeType);
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

  async function pickHeroVideo() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please grant photo access to upload a video.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      quality: 0.85,
      videoMaxDuration: 20,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setVideoUploading(true);
    try {
      const asset = result.assets[0];
      const mime = asset.mimeType || "video/mp4";
      const res = await api.adminUpload(asset.uri, "hero_video", undefined, mime);
      if (res.url) {
        setHeroVideo(res.url);
        await api.adminUpdateSite({ site_hero_video: res.url });
        Alert.alert("Uploaded", "Hero video saved. Your site will use it in Video mode.");
      }
    } catch (err) {
      Alert.alert("Upload failed", err.message);
    } finally {
      setVideoUploading(false);
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

  async function clearHeroVideo() {
    Alert.alert("Remove hero video?", null, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        try {
          await api.adminUpdateSite({ site_hero_video: "" });
          setHeroVideo("");
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
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 6,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.length) return;
    setPhotoUploading(true);
    try {
      for (const asset of result.assets) {
        await api.adminUpload(asset.uri, "gallery", undefined, asset.mimeType);
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

  async function moveSection(sid, delta) {
    const next = sectionOrder.slice();
    const idx = next.indexOf(sid);
    if (idx === -1) return;
    const target = idx + delta;
    if (target < 0 || target >= next.length) return;
    next.splice(idx, 1);
    next.splice(target, 0, sid);
    setSectionOrder(next);
    try {
      await api.adminUpdateSite({ site_section_order: next });
    } catch (err) { Alert.alert("Save failed", err.message); }
  }

  async function toggleSectionVisibility(sid) {
    const next = sectionsHidden.slice();
    const idx = next.indexOf(sid);
    if (idx === -1) next.push(sid); else next.splice(idx, 1);
    setSectionsHidden(next);
    try {
      await api.adminUpdateSite({ site_sections_hidden: next });
    } catch (err) { Alert.alert("Save failed", err.message); }
  }

  async function save() {
    setSaving(true);
    try {
      await api.adminUpdateSite({
        site_tagline: tagline,
        site_about: about,
        site_brand_color: brandColor,
        site_accent_color: accentColor,
        site_bg_color: bgColor,
        site_text_color: textColor,
        site_instagram: instagram,
        site_team_title: teamTitle,
        site_team_subtitle: teamSubtitle,
        site_services_title: servicesTitle,
        site_services_subtitle: servicesSubtitle,
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
      const sep = previewUrl.includes('?') ? '&' : '?';
      Linking.openURL(`${previewUrl}${sep}_v=${Date.now()}`);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={C.blue} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Header */}
      <View style={styles.headerBox}>
        <View style={styles.headerIcon}><Ionicons name="globe-outline" size={22} color={C.blue} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Your site</Text>
          <Text style={styles.headerSub}>Pick a theme that fits your shop, or customize every detail.</Text>
        </View>
      </View>

      {/* Preview link */}
      <TouchableOpacity style={styles.urlCard} onPress={openPreview}>
        <View style={{ flex: 1 }}>
          <Text style={styles.urlLabel}>YOUR SITE URL</Text>
          <Text style={styles.urlValue} numberOfLines={1}>{siteUrl}</Text>
        </View>
        <Ionicons name="open-outline" size={18} color={C.blue} />
      </TouchableOpacity>

      {/* Theme presets */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>THEME</Text>
        <Text style={styles.helperText}>Sets colors + font pair in one tap.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
          {Object.keys(themePresets).map((key) => {
            const p = themePresets[key];
            const active = preset === key;
            const meta = PRESET_META[key] || { label: key, font: "Georgia" };
            const brandIsLight = lightBrand(p.brand);
            return (
              <TouchableOpacity
                key={key}
                style={[styles.presetCard, active && styles.presetCardActive]}
                onPress={() => selectPreset(key)}
              >
                <View style={[styles.presetMock, { backgroundColor: p.bg, borderBottomColor: p.border || C.line }]}>
                  <Text style={{ fontFamily: meta.font, fontSize: 18, fontFamily: F.semibold, color: p.text, marginBottom: 6 }}>Aa</Text>
                  <View style={{ alignSelf: "flex-start", backgroundColor: p.brand, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}>
                    <Text style={{ fontSize: 9, fontFamily: F.semibold, color: brandIsLight ? "#000" : "#fff" }}>Book now</Text>
                  </View>
                </View>
                <View style={styles.presetFooter}>
                  <Text style={styles.presetLabel}>{meta.label}</Text>
                  <Text style={[styles.presetSelected, { opacity: active ? 1 : 0 }]}>✓ Selected</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Customize colors (disclosure) — right under Theme for easy discovery */}
      <TouchableOpacity
        style={[styles.section, styles.disclosureHeader]}
        onPress={() => setShowCustomColors(!showCustomColors)}
      >
        <Ionicons name="color-palette-outline" size={20} color={C.ink} />
        <Text style={styles.disclosureText}>Customize colors</Text>
        <Ionicons name={showCustomColors ? "chevron-up" : "chevron-down"} size={18} color={C.muted} />
      </TouchableOpacity>
      {showCustomColors && (
        <View style={[styles.section, { marginTop: -12, paddingTop: 12 }]}>
          <ColorField label="Primary / brand" value={brandColor} onChange={setBrandColor} defaultHex={C.blue} />
          <ColorField label="Accent"          value={accentColor} onChange={setAccentColor} allowClear />
          <ColorField label="Background"      value={bgColor}     onChange={setBgColor}     allowClear />
          <ColorField label="Text"            value={textColor}   onChange={setTextColor}   allowClear />
          <Text style={styles.helperText}>Any color you leave as "preset default" uses whatever the theme sets. Tap to pick or enter a custom hex.</Text>
        </View>
      )}

      {/* Font pair */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>FONTS</Text>
        <Text style={styles.helperText}>Headings &amp; body text.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fontRow}>
          {Object.keys(fontPairs).map((key) => {
            const active = fontPair === key;
            const meta = FONT_META[key] || { label: key, family: serif, weight: "700" };
            return (
              <TouchableOpacity
                key={key}
                style={[styles.fontCard, active && styles.fontCardActive]}
                onPress={() => selectFontPair(key)}
              >
                <Text style={[styles.fontPreview, { fontFamily: meta.family, fontWeight: meta.weight }]}>Aa</Text>
                <Text style={[styles.fontLabel, active && { color: C.blue, fontFamily: F.semibold }]}>{meta.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Hero style — image / video / solid, with the relevant upload inline */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>HERO STYLE</Text>
        <Text style={styles.helperText}>The big section at the top of your site.</Text>
        <View style={styles.heroTabs}>
          {["image", "video", "solid"].map((mode) => {
            const active = heroMode === mode;
            return (
              <TouchableOpacity
                key={mode}
                style={[styles.heroTab, active && styles.heroTabActive]}
                onPress={() => selectHeroMode(mode)}
              >
                <Text style={[styles.heroTabText, active && styles.heroTabTextActive]}>
                  {mode[0].toUpperCase() + mode.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {heroMode === "image" && (
          <View style={{ marginTop: 14 }}>
            {heroImage ? (
              <Image source={{ uri: heroImage }} style={styles.heroPreview} />
            ) : (
              <View style={[styles.heroPreview, styles.heroPlaceholder]}>
                <Ionicons name="image-outline" size={32} color={C.muted} />
                <Text style={{ fontFamily: F.regular, fontSize: 12, color: C.muted, marginTop: 6 }}>No hero image yet</Text>
              </View>
            )}
            <View style={styles.heroBtnRow}>
              <TouchableOpacity style={styles.heroBtn} onPress={pickHeroImage} disabled={uploading}>
                <Ionicons name="camera-outline" size={16} color={C.paper} />
                <Text style={styles.heroBtnText}>{uploading ? "Uploading..." : (heroImage ? "Change Image" : "Choose Image")}</Text>
              </TouchableOpacity>
              {heroImage && (
                <TouchableOpacity style={styles.heroBtnGhost} onPress={clearHero}>
                  <Text style={styles.heroBtnGhostText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.helperText}>JPG/PNG/WebP · Recommended 1920×1200 · Max 5MB</Text>
          </View>
        )}

        {heroMode === "video" && (
          <View style={{ marginTop: 14 }}>
            <View style={styles.videoPreview}>
              <Ionicons name={heroVideo ? "checkmark-circle" : "videocam-outline"} size={30} color={heroVideo ? "#4ade80" : "#fff"} />
              <Text style={{ color: "#fff", fontFamily: F.regular, fontSize: 12, marginTop: 4 }}>
                {heroVideo ? "Video uploaded" : "No video"}
              </Text>
            </View>
            <View style={styles.heroBtnRow}>
              <TouchableOpacity style={styles.heroBtn} onPress={pickHeroVideo} disabled={videoUploading}>
                <Ionicons name="cloud-upload-outline" size={16} color={C.paper} />
                <Text style={styles.heroBtnText}>{videoUploading ? "Uploading..." : (heroVideo ? "Change video" : "Choose video")}</Text>
              </TouchableOpacity>
              {heroVideo && (
                <TouchableOpacity style={styles.heroBtnGhost} onPress={clearHeroVideo}>
                  <Text style={styles.heroBtnGhostText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.helperText}>MP4, max 20MB, ~10s loops best.</Text>

            {/* Poster (existing hero image used as fallback while video loads) */}
            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Poster image <Text style={{ color: C.muted, fontFamily: F.regular }}>— shown while the video loads</Text></Text>
            {heroImage ? (
              <Image source={{ uri: heroImage }} style={[styles.heroPreview, { marginTop: 6 }]} />
            ) : (
              <View style={[styles.heroPreview, styles.heroPlaceholder, { marginTop: 6 }]}>
                <Ionicons name="image-outline" size={24} color={C.muted} />
                <Text style={{ fontFamily: F.regular, fontSize: 11, color: C.muted, marginTop: 4 }}>Optional — falls back to brand color</Text>
              </View>
            )}
            <View style={styles.heroBtnRow}>
              <TouchableOpacity style={styles.heroBtn} onPress={pickHeroImage} disabled={uploading}>
                <Ionicons name="camera-outline" size={16} color={C.paper} />
                <Text style={styles.heroBtnText}>{uploading ? "Uploading..." : (heroImage ? "Change poster" : "Choose poster")}</Text>
              </TouchableOpacity>
              {heroImage && (
                <TouchableOpacity style={styles.heroBtnGhost} onPress={clearHero}>
                  <Text style={styles.heroBtnGhostText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {heroMode === "solid" && (
          <Text style={[styles.helperText, { marginTop: 10 }]}>
            The hero will use your brand color with the shop's initial — no image or video.
          </Text>
        )}
      </View>

      {/* Layout / section reorder */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>LAYOUT</Text>
        <Text style={styles.helperText}>Reorder or hide sections on your page.</Text>
        <View style={{ gap: 6 }}>
          {sectionOrder.map((sid, idx) => {
            const meta = SECTION_META[sid];
            if (!meta) return null;
            const isHidden = sectionsHidden.indexOf(sid) !== -1;
            return (
              <View key={sid} style={[styles.sectionRow, isHidden && styles.sectionRowHidden]}>
                <TouchableOpacity
                  disabled={idx === 0}
                  onPress={() => moveSection(sid, -1)}
                  style={styles.sectionIconBtn}
                >
                  <Ionicons name="chevron-up" size={20} color={idx === 0 ? C.line : C.ink} />
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={idx === sectionOrder.length - 1}
                  onPress={() => moveSection(sid, +1)}
                  style={styles.sectionIconBtn}
                >
                  <Ionicons name="chevron-down" size={20} color={idx === sectionOrder.length - 1 ? C.line : C.ink} />
                </TouchableOpacity>
                <Ionicons name={meta.icon} size={18} color={C.muted} style={{ marginLeft: 4 }} />
                <Text style={styles.sectionRowLabel}>{meta.label}</Text>
                <TouchableOpacity
                  onPress={() => toggleSectionVisibility(sid)}
                  style={styles.sectionIconBtn}
                >
                  <Ionicons name={isHidden ? "eye-off-outline" : "eye-outline"} size={18} color={isHidden ? C.muted : C.ink} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </View>

      {/* Section Headings — sits right after Layout for logical grouping */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>SECTION HEADINGS</Text>
        <Text style={styles.helperText}>Customize the text above Team and Services.</Text>
        <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Team title</Text>
        <TextInput style={styles.input} value={teamTitle} onChangeText={setTeamTitle} placeholder="Meet your barber" placeholderTextColor={C.muted} maxLength={200} />
        <Text style={styles.fieldLabel}>Team subtitle</Text>
        <TextInput style={styles.input} value={teamSubtitle} onChangeText={setTeamSubtitle} placeholder="Hand-picked craft. Years of experience." placeholderTextColor={C.muted} maxLength={200} />
        <Text style={styles.fieldLabel}>Services title</Text>
        <TextInput style={styles.input} value={servicesTitle} onChangeText={setServicesTitle} placeholder="Crafted for the chair" placeholderTextColor={C.muted} maxLength={200} />
        <Text style={styles.fieldLabel}>Services subtitle</Text>
        <TextInput style={styles.input} value={servicesSubtitle} onChangeText={setServicesSubtitle} placeholder="Professional cuts, fades, and grooming." placeholderTextColor={C.muted} maxLength={200} />
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
            <Ionicons name="add" size={14} color={C.paper} />
            <Text style={styles.galleryAddText}>{photoUploading ? "Uploading…" : "Add"}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.helperText}>Show off your best work. Up to 6 at a time.</Text>
        {photos.length === 0 ? (
          <View style={styles.galleryEmpty}>
            <Ionicons name="images-outline" size={28} color={C.muted} />
            <Text style={{ fontFamily: F.regular, fontSize: 12, color: C.muted, marginTop: 6 }}>No photos yet</Text>
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
        <Ionicons name="open-outline" size={16} color={C.blue} />
        <Text style={styles.previewBtnText}>Preview your site</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function lightBrand(hex) {
  try {
    let h = (hex || "").replace("#", "");
    if (h.length === 3) h = h.split("").map(c => c + c).join("");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 160;
  } catch (e) { return false; }
}

// Curated palette shown in the color picker modal. Word-style: a grid of
// greyscale on the left, then warm → cool → accent colors. Designed to cover
// 90% of barbershop brand choices; "Custom hex" at the bottom covers the rest.
const PALETTE = [
  // Row 1 — neutrals (white → black)
  "#FFFFFF", "#F5F5F5", "#E5E5E5", "#C7C7C7", "#9B8677", "#6B6B6B", "#2A2A2A", "#0F0F0F",
  // Row 2 — creams / warm neutrals
  "#F7F3EE", "#F5F1E8", "#F8F3E6", "#EBE3D7", "#E0D5CB", "#D9D0C5", "#B8A98F", "#8A7654",
  // Row 3 — warm / barber tones
  "#C4683E", "#994D3A", "#A74E3E", "#8C6B2C", "#B8911F", "#6B3226", "#4A2018", "#2C1810",
  // Row 4 — cool + accent
  "#0F4C5C", "#2E5266", "#4A6B8A", "#1A4340", "#4A5D3A", "#7B4B94", "#5D4379", "#1F2A44",
  // Row 5 — brights
  "#E74C3C", "#E67E22", "#F1C40F", "#27AE60", "#3498DB", "#9B59B6", "#FF6B9D", "#00C49A",
];

function ColorPickerModal({ visible, title, initialColor, onPick, onClose, allowClear }) {
  const [local, setLocal] = useState(initialColor || "");
  // Re-sync when the modal opens with a new color
  useEffect(() => { if (visible) setLocal(initialColor || ""); }, [visible, initialColor]);
  const validHex = /^#([0-9A-Fa-f]{6})$/.test(local);
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={pickerStyles.backdrop} onPress={onClose}>
        <Pressable style={pickerStyles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={pickerStyles.title}>{title}</Text>
          <View style={pickerStyles.grid}>
            {PALETTE.map((c) => {
              const selected = local.toUpperCase() === c.toUpperCase();
              return (
                <TouchableOpacity
                  key={c}
                  style={[
                    pickerStyles.swatch,
                    { backgroundColor: c },
                    selected && pickerStyles.swatchSelected,
                    c.toUpperCase() === "#FFFFFF" && pickerStyles.swatchBordered,
                  ]}
                  onPress={() => setLocal(c)}
                >
                  {selected && <Ionicons name="checkmark" size={16} color={isLight(c) ? "#000" : "#fff"} />}
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={pickerStyles.customLabel}>Or enter a custom color</Text>
          <View style={pickerStyles.hexRow}>
            <View style={[pickerStyles.hexPreview, { backgroundColor: validHex ? local : C.line }]} />
            <TextInput
              style={pickerStyles.hexInput}
              value={local}
              onChangeText={(v) => {
                let val = v.trim();
                if (val && !val.startsWith("#")) val = "#" + val;
                if (val.length <= 7) setLocal(val);
              }}
              placeholder="#RRGGBB"
              placeholderTextColor={C.muted}
              autoCapitalize="characters"
              maxLength={7}
            />
          </View>
          <View style={pickerStyles.btnRow}>
            {allowClear && (
              <TouchableOpacity
                style={[pickerStyles.btn, pickerStyles.btnGhost]}
                onPress={() => { onPick(""); onClose(); }}
              >
                <Text style={pickerStyles.btnGhostText}>Reset to preset</Text>
              </TouchableOpacity>
            )}
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={[pickerStyles.btn, pickerStyles.btnGhost]}
              onPress={onClose}
            >
              <Text style={pickerStyles.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[pickerStyles.btn, pickerStyles.btnPrimary, !validHex && { opacity: 0.5 }]}
              disabled={!validHex}
              onPress={() => { onPick(local); onClose(); }}
            >
              <Text style={pickerStyles.btnPrimaryText}>Done</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function isLight(hex) {
  try {
    let h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 160;
  } catch (e) { return false; }
}

function ColorField({ label, value, onChange, defaultHex, allowClear }) {
  const [picking, setPicking] = useState(false);
  const hasValue = value && /^#([0-9A-Fa-f]{6})$/.test(value);
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity style={styles.colorFieldRow} onPress={() => setPicking(true)}>
        <View style={[styles.colorFieldSwatch, { backgroundColor: hasValue ? value : (defaultHex || C.line) }]} />
        <Text style={styles.colorFieldText}>
          {hasValue ? value : (allowClear ? "Using preset default" : (defaultHex || "Tap to choose"))}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={C.muted} />
      </TouchableOpacity>
      <ColorPickerModal
        visible={picking}
        title={label}
        initialColor={value || defaultHex || ""}
        allowClear={allowClear}
        onPick={onChange}
        onClose={() => setPicking(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.paper },
  center: { alignItems: "center", justifyContent: "center" },
  headerBox: {
    flexDirection: "row", gap: 12, padding: 18,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.line,
  },
  headerIcon: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: "rgba(26,36,201,0.1)",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  headerTitle: { fontSize: 20, fontFamily: F.regular, color: C.ink, marginBottom: 4 },
  headerSub: { fontFamily: F.regular, fontSize: 12, color: C.muted, lineHeight: 16 },

  urlCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.surface, marginHorizontal: 16, marginTop: 16,
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1, borderColor: C.line,
  },
  urlLabel: { fontSize: 11, fontFamily: F.semibold, color: C.muted, letterSpacing: 1.2, marginBottom: 2 },
  urlValue: { fontSize: 13, fontFamily: F.semibold, color: C.ink },

  section: {
    backgroundColor: C.surface,
    marginHorizontal: 16, marginTop: 16,
    padding: 16,
    borderRadius: 12, borderWidth: 1, borderColor: C.line,
  },
  sectionLabel: { fontSize: 11, fontFamily: F.semibold, color: C.muted, letterSpacing: 1.2, marginBottom: 4 },
  helperText: { fontFamily: F.regular, fontSize: 11, color: C.muted, lineHeight: 14, marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontFamily: F.semibold, color: C.ink, marginBottom: 4, marginTop: 8 },
  input: {
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.lineStrong,
    borderRadius: 8, padding: 12,
    fontFamily: F.regular, fontSize: 15, color: C.ink,
  },

  presetRow: { gap: 10, paddingVertical: 4, paddingRight: 4 },
  presetCard: {
    width: 138, borderRadius: 12,
    backgroundColor: C.sunk, borderWidth: 2, borderColor: C.line,
    overflow: "hidden",
  },
  presetCardActive: { borderColor: C.blue },
  presetMock: { padding: 12, minHeight: 70, borderBottomWidth: 1 },
  presetFooter: { padding: 10 },
  presetLabel: { fontSize: 13, fontFamily: F.semibold, color: C.ink },
  presetSelected: { fontSize: 11, color: C.blue, fontFamily: F.semibold, marginTop: 2 },

  fontRow: { gap: 8, paddingVertical: 4, paddingRight: 4 },
  fontCard: {
    width: 100, padding: 10, borderRadius: 8,
    backgroundColor: C.sunk, borderWidth: 1, borderColor: C.line,
  },
  fontCardActive: { borderColor: C.blue },
  fontPreview: { fontSize: 22, fontFamily: F.regular, color: C.ink, lineHeight: 24 },
  fontLabel: { fontSize: 11, fontFamily: F.medium, color: C.muted, marginTop: 4 },

  heroTabs: {
    flexDirection: "row", alignSelf: "flex-start",
    padding: 3, borderWidth: 1, borderColor: C.line, borderRadius: 10,
    backgroundColor: C.sunk, gap: 2,
  },
  heroTab: { paddingVertical: 7, paddingHorizontal: 16, borderRadius: 7 },
  heroTabActive: { backgroundColor: C.blue },
  heroTabText: { fontSize: 13, fontFamily: F.semibold, color: C.ink },
  heroTabTextActive: { color: C.onBlue },

  videoPreview: {
    width: 140, height: 84, borderRadius: 10,
    backgroundColor: "#000", alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: C.line, marginBottom: 10,
  },

  sectionRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 10,
    backgroundColor: C.sunk, borderWidth: 1, borderColor: C.line, borderRadius: 8,
  },
  sectionRowHidden: { opacity: 0.55, backgroundColor: "rgba(0,0,0,0.02)" },
  sectionRowLabel: { flex: 1, fontSize: 14, fontFamily: F.semibold, color: C.ink, marginLeft: 6 },
  sectionIconBtn: { padding: 4 },

  colorFieldRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.sunk, borderWidth: 1, borderColor: C.line,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9,
  },
  colorFieldSwatch: {
    width: 28, height: 28, borderRadius: 6,
    borderWidth: 1, borderColor: "rgba(0,0,0,.12)",
  },
  colorFieldText: { flex: 1, fontSize: 13, color: C.ink, fontFamily: F.semibold, fontFamily: "Courier" },

  disclosureHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 14,
  },
  disclosureText: { flex: 1, fontSize: 15, fontFamily: F.semibold, color: C.ink },

  heroPreview: {
    width: "100%", aspectRatio: 16 / 10,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: C.sunk,
  },
  heroPlaceholder: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.line, borderStyle: "dashed" },
  heroBtnRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  heroBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: C.blue,
    paddingVertical: 12, borderRadius: 8,
  },
  heroBtnText: { fontSize: 13, fontFamily: F.semibold, color: C.paper },
  heroBtnGhost: {
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8,
    borderWidth: 1, borderColor: C.line, backgroundColor: C.surface,
  },
  heroBtnGhostText: { fontSize: 13, fontFamily: F.semibold, color: C.muted },

  galleryAddBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.blue, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  galleryAddText: { fontSize: 12, fontFamily: F.semibold, color: C.paper },
  galleryEmpty: { alignItems: "center", paddingVertical: 24, borderWidth: 1, borderColor: C.line, borderStyle: "dashed", borderRadius: 10 },
  galleryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  galleryItem: { width: "31.5%", aspectRatio: 1, borderRadius: 8, overflow: "hidden", position: "relative", backgroundColor: C.sunk, borderWidth: 1, borderColor: C.line },
  galleryImg: { width: "100%", height: "100%" },
  galleryDelete: { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center" },

  saveBtn: {
    backgroundColor: C.blue, marginHorizontal: 16, marginTop: 24,
    paddingVertical: 16, borderRadius: 12, alignItems: "center",
  },
  saveBtnText: { fontSize: 15, fontFamily: F.semibold, color: C.paper, letterSpacing: 0.3 },

  previewBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    marginHorizontal: 16, marginTop: 10,
    paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: C.blue, backgroundColor: "transparent",
  },
  previewBtnText: { fontSize: 14, fontFamily: F.semibold, color: C.blue },
});

const pickerStyles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: "rgba(14,14,12,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: C.paper,
    paddingTop: 16, paddingBottom: 36,
    paddingHorizontal: 20,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  title: { fontSize: 17, fontFamily: F.semibold, color: C.ink, marginBottom: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  swatch: {
    width: 36, height: 36, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "transparent",
  },
  swatchSelected: { borderColor: C.ink, transform: [{ scale: 1.08 }] },
  swatchBordered: { borderColor: "rgba(0,0,0,0.12)", borderWidth: 1 },

  customLabel: { fontSize: 12, fontFamily: F.semibold, color: C.muted, letterSpacing: 1, marginBottom: 8 },
  hexRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.line,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 16,
  },
  hexPreview: { width: 28, height: 28, borderRadius: 6, borderWidth: 1, borderColor: "rgba(0,0,0,.12)" },
  hexInput: {
    flex: 1, fontSize: 15, fontFamily: "Courier", letterSpacing: 1,
    color: C.ink, fontFamily: F.semibold,
  },

  btnRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  btn: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12 },
  btnGhost: { backgroundColor: "transparent" },
  btnGhostText: { fontSize: 14, fontFamily: F.semibold, color: C.muted },
  btnPrimary: { backgroundColor: C.blue },
  btnPrimaryText: { fontSize: 14, fontFamily: F.semibold, color: C.paper },
});
