// Mobile push notifications module — Expo + backend registration.
// Everything here is wrapped in try/catch so a push failure NEVER crashes
// the app or interrupts the user. Push is a "nice to have" layer; the app
// continues to work fine if every function in this file throws.

import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { api } from "./api";

const TOKEN_STORAGE_KEY = "expo_push_token";
const PROJECT_ID = Constants.expoConfig?.extra?.eas?.projectId;

// Show notifications even when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Request permission. Returns true if granted, false otherwise. Safe to call multiple times. */
export async function requestPushPermission() {
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
      return true;
    }
    if (settings.canAskAgain === false) {
      return false;
    }
    const req = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
    return !!req.granted;
  } catch (err) {
    console.warn("[push] requestPermission failed:", err?.message);
    return false;
  }
}

/** Get the Expo push token for this device. Returns null on any failure. */
export async function getExpoPushToken() {
  try {
    if (!PROJECT_ID) {
      console.warn("[push] No EAS projectId in app.json — cannot get Expo token");
      return null;
    }
    // Android needs a notification channel before we ask for a token
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }
    const result = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    return result?.data || null;
  } catch (err) {
    console.warn("[push] getExpoPushToken failed:", err?.message);
    return null;
  }
}

/**
 * Full registration flow: request permission → get token → POST to backend.
 *
 * @param {object} opts
 * @param {"admin"|"staff"} opts.role - which set of endpoints to use
 * @param {number} [opts.barberId] - required for admin role (admin picks which barber's bookings)
 * @returns {Promise<{ok: boolean, token: string|null, reason?: string}>}
 */
export async function registerForPushNotifications({ role, barberId } = {}) {
  try {
    const granted = await requestPushPermission();
    if (!granted) return { ok: false, token: null, reason: "permission_denied" };

    const token = await getExpoPushToken();
    if (!token) return { ok: false, token: null, reason: "no_token" };

    // Cache locally so we can unregister cleanly on logout
    try { await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token); } catch {}

    if (role === "admin") {
      if (!barberId) return { ok: false, token, reason: "missing_barber_id" };
      await api.adminRegisterPushToken(token, barberId);
    } else if (role === "staff") {
      await api.staffRegisterPushToken(token);
    } else {
      return { ok: false, token, reason: "invalid_role" };
    }
    return { ok: true, token };
  } catch (err) {
    console.warn("[push] register failed:", err?.message);
    return { ok: false, token: null, reason: err?.message || "unknown_error" };
  }
}

/** Unregister the cached token from the backend. Safe to call on logout. */
export async function unregisterPushToken({ role } = {}) {
  try {
    const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) return;
    if (role === "admin") {
      await api.adminUnregisterPushToken(token);
    } else if (role === "staff") {
      await api.staffUnregisterPushToken(token);
    }
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch (err) {
    console.warn("[push] unregister failed:", err?.message);
  }
}

/** Get the cached token (without re-fetching from Expo). Used for re-registration on settings open. */
export async function getCachedPushToken() {
  try {
    return await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}
