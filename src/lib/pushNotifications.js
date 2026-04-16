import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { api } from "./api";

const TOKEN_STORAGE_KEY = "expo_push_token";
const PROJECT_ID = Constants.expoConfig?.extra?.eas?.projectId;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestPushPermission() {
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
      return true;
    }
    if (settings.canAskAgain === false) return false;
    const req = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
      android: {},
    });
    return !!(req.granted || req.status === "granted" || req.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL);
  } catch (err) {
    console.warn("[push] requestPermission failed:", err?.message);
    return false;
  }
}

export async function getExpoPushToken() {
  try {
    if (!PROJECT_ID) return null;
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

export async function registerForPushNotifications({ role, barberId } = {}) {
  try {
    const granted = await requestPushPermission();
    if (!granted) return { ok: false, token: null, reason: "permission_denied" };
    const token = await getExpoPushToken();
    if (!token) return { ok: false, token: null, reason: "no_token" };
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

export async function getCachedPushToken() {
  try {
    return await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}
