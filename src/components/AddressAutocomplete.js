import React, { useState, useRef, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import Constants from "expo-constants";
import { C } from "../lib/theme";

const GOOGLE_PLACES_KEY = Constants.expoConfig?.extra?.googlePlacesKey || "";

const PLACES_URL = "https://maps.googleapis.com/maps/api/place";

export default function AddressAutocomplete({ value, onChange, placeholder, style }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef(null);

  const search = useCallback((text) => {
    onChange(text);
    if (!GOOGLE_PLACES_KEY || text.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${PLACES_URL}/autocomplete/json?input=${encodeURIComponent(text)}&types=address&components=country:ca|country:us&key=${GOOGLE_PLACES_KEY}`
        );
        const data = await res.json();
        setSuggestions(data.predictions?.slice(0, 4) || []);
      } catch {
        setSuggestions([]);
      }
      setLoading(false);
    }, 300);
  }, [onChange]);

  async function selectPlace(placeId, description) {
    onChange(description);
    setSuggestions([]);
    // Optionally fetch full details for structured address
    if (!GOOGLE_PLACES_KEY) return;
    try {
      const res = await fetch(
        `${PLACES_URL}/details/json?place_id=${placeId}&fields=formatted_address,geometry&key=${GOOGLE_PLACES_KEY}`
      );
      const data = await res.json();
      if (data.result?.formatted_address) {
        onChange(data.result.formatted_address);
      }
    } catch {}
  }

  // If no API key, just render a plain input
  if (!GOOGLE_PLACES_KEY) {
    return (
      <TextInput
        style={[styles.input, style]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder || "123 Main St, City, Province"}
        placeholderTextColor={C.muted}
      />
    );
  }

  return (
    <View>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, style]}
          value={value}
          onChangeText={search}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          placeholder={placeholder || "Start typing an address…"}
          placeholderTextColor={C.muted}
        />
        {loading && <ActivityIndicator size="small" color={C.muted} style={styles.spinner} />}
      </View>
      {focused && suggestions.length > 0 && (
        <View style={styles.dropdown}>
          {suggestions.map((s) => (
            <TouchableOpacity
              key={s.place_id}
              style={styles.suggestion}
              onPress={() => selectPlace(s.place_id, s.description)}
            >
              <Text style={styles.suggestionMain} numberOfLines={1}>
                {s.structured_formatting?.main_text || s.description}
              </Text>
              <Text style={styles.suggestionSub} numberOfLines={1}>
                {s.structured_formatting?.secondary_text || ""}
              </Text>
            </TouchableOpacity>
          ))}
          <Text style={styles.powered}>Powered by Google</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputRow: { position: "relative" },
  input: {
    backgroundColor: C.white, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: C.espresso,
    borderWidth: 1, borderColor: C.border,
  },
  spinner: { position: "absolute", right: 12, top: 14 },
  dropdown: {
    backgroundColor: C.white, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
    marginTop: 4, overflow: "hidden",
  },
  suggestion: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  suggestionMain: { fontSize: 14, fontWeight: "600", color: C.espresso },
  suggestionSub: { fontSize: 11, color: C.muted, marginTop: 1 },
  powered: { fontSize: 9, color: C.muted, textAlign: "right", padding: 6 },
});
