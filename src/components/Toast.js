import React, { useRef, useState, useCallback } from "react";
import { C, F } from "../lib/theme";
import { Animated, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ICONS = { success: "✓", error: "✕", info: "ℹ" };
const BG    = { success: C.night, error: C.danger, info: C.night };

export function useToast() {
  const [state, setState] = useState({ msg: "", type: "success" });
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  const timer = useRef(null);

  const show = useCallback((msg, type = "success") => {
    if (timer.current) clearTimeout(timer.current);
    setState({ msg, type });
    Animated.parallel([
      Animated.spring(opacity, { toValue: 1, useNativeDriver: true, tension: 100, friction: 8 }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 100, friction: 8 }),
    ]).start();
    timer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 250, useNativeDriver: true }),
      ]).start();
    }, 2500);
  }, []);

  return { showToast: show, toastProps: { ...state, opacity, translateY } };
}

export function Toast({ msg, type, opacity, translateY }) {
  const insets = useSafeAreaInsets();
  if (!msg) return null;
  return (
    <Animated.View
      style={[
        styles.toast,
        { top: insets.top + 10, backgroundColor: BG[type] || BG.info, opacity, transform: [{ translateY }] },
      ]}
      pointerEvents="none"
    >
      <Text style={styles.icon}>{ICONS[type] || ICONS.info}</Text>
      <Text style={styles.text}>{msg}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute", left: 16, right: 16, zIndex: 9999,
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingVertical: 13,
    borderRadius: 14,
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  icon: { fontSize: 16, color: "#fff", fontFamily: F.semibold },
  text: { flex: 1, fontSize: 14, fontFamily: F.semibold, color: "#fff" },
});
