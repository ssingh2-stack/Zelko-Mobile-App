import React, { useRef } from "react";
import { Animated, View, Text, StyleSheet, TouchableOpacity, PanResponder } from "react-native";
import { C } from "../lib/theme";

const SWIPE_THRESHOLD = 60;
const ACTION_WIDTH = 130; // total width of revealed actions

export default function SwipeableCard({ children, onNoShow, onCancel, disabled }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const lastOffset = useRef(0);

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 8 && Math.abs(gs.dx) > Math.abs(gs.dy),
    onPanResponderGrant: () => {
      translateX.setOffset(lastOffset.current);
      translateX.setValue(0);
    },
    onPanResponderMove: (_, gs) => {
      // Only allow left swipe (negative dx), clamp at -ACTION_WIDTH
      const next = Math.max(-ACTION_WIDTH, Math.min(0, gs.dx));
      translateX.setValue(next);
    },
    onPanResponderRelease: (_, gs) => {
      translateX.flattenOffset();
      const current = lastOffset.current + gs.dx;
      if (current < -SWIPE_THRESHOLD) {
        // Snap open
        Animated.spring(translateX, { toValue: -ACTION_WIDTH, useNativeDriver: true, tension: 80, friction: 12 }).start();
        lastOffset.current = -ACTION_WIDTH;
      } else {
        // Snap closed
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
        lastOffset.current = 0;
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
      lastOffset.current = 0;
    },
  })).current;

  function close() {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
    lastOffset.current = 0;
  }

  if (disabled) return <>{children}</>;

  return (
    <View style={styles.container}>
      {/* Action buttons revealed on swipe */}
      <View style={[styles.actions, { width: ACTION_WIDTH }]}>
        <TouchableOpacity style={styles.noShowBtn} onPress={() => { close(); onNoShow?.(); }}>
          <Text style={styles.actionIcon}>👻</Text>
          <Text style={styles.noShowText}>No-show</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => { close(); onCancel?.(); }}>
          <Text style={styles.actionIcon}>✕</Text>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Card — slides left */}
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: "relative", overflow: "hidden", marginBottom: 8 },
  actions: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
  },
  noShowBtn: {
    flex: 1,
    backgroundColor: "#F59E0B",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderRadius: 10,
    margin: 0,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: C.terra,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderRadius: 10,
    margin: 0,
  },
  actionIcon: { fontSize: 16 },
  noShowText: { fontSize: 10, fontWeight: "800", color: "#fff", letterSpacing: 0.3 },
  cancelText: { fontSize: 10, fontWeight: "800", color: "#fff", letterSpacing: 0.3 },
});
