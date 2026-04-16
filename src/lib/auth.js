import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { api } from "./api";
import { unregisterPushToken } from "./pushNotifications";
import { clearAllCache } from "./cache";

// Auth token goes in SecureStore (encrypted keychain on iOS).
// Profile metadata (name, role) stays in AsyncStorage since it's
// non-sensitive and SecureStore has a 2KB value limit.

export async function saveSession(token, profile) {
  try { await SecureStore.setItemAsync("mobile_token", token); } catch (_) {}
  await AsyncStorage.setItem("mobile_profile", JSON.stringify(profile));
  // Clean up any legacy AsyncStorage token from pre-1.0.5
  try { await AsyncStorage.removeItem("mobile_token"); } catch (_) {}
}

export async function getSession() {
  // Try SecureStore first (1.0.5+), fall back to AsyncStorage (1.0.4)
  let token = null;
  try { token = await SecureStore.getItemAsync("mobile_token"); } catch (_) {}
  if (!token) {
    token = await AsyncStorage.getItem("mobile_token");
    // Migrate: move token from AsyncStorage to SecureStore
    if (token) {
      try { await SecureStore.setItemAsync("mobile_token", token); } catch (_) {}
    }
  }
  const profileStr = await AsyncStorage.getItem("mobile_profile");
  if (!token || !profileStr) return null;
  return { token, profile: JSON.parse(profileStr) };
}

export async function clearSession() {
  // Unregister push token BEFORE dropping auth (needs the token to authenticate)
  try {
    const profileStr = await AsyncStorage.getItem("mobile_profile");
    const profile = profileStr ? JSON.parse(profileStr) : null;
    if (profile?.role) {
      await unregisterPushToken({ role: profile.role });
    }
  } catch (_) {}
  try { await api.logout(); } catch (_) {
    // Server revocation failed (network error) — clear local token anyway
    // since re-login will issue a fresh token. The old token will expire
    // server-side within 14 days.
  }
  try { await SecureStore.deleteItemAsync("mobile_token"); } catch (_) {}
  await AsyncStorage.removeItem("mobile_token");
  await AsyncStorage.removeItem("mobile_profile");
  // Clear cached data so next user on this device doesn't see stale bookings/clients
  await clearAllCache();
}
