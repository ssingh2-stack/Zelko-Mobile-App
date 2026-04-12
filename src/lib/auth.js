import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { api } from "./api";

// Auth token goes in SecureStore (encrypted keychain on iOS).
// Profile metadata (name, role) stays in AsyncStorage since it's
// non-sensitive and SecureStore has a 2KB value limit.

export async function saveSession(token, profile) {
  await SecureStore.setItemAsync("mobile_token", token);
  await AsyncStorage.setItem("mobile_profile", JSON.stringify(profile));
  // Keep a copy in AsyncStorage for backwards compat during migration.
  // Users on 1.0.4 have their token in AsyncStorage only. On first
  // login after updating to 1.0.5, the token moves to SecureStore.
  await AsyncStorage.setItem("mobile_token", token);
}

export async function getSession() {
  // Try SecureStore first (1.0.5+), fall back to AsyncStorage (1.0.4)
  let token = await SecureStore.getItemAsync("mobile_token");
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
  try { await api.logout(); } catch (_) {}
  try { await SecureStore.deleteItemAsync("mobile_token"); } catch (_) {}
  await AsyncStorage.removeItem("mobile_token");
  await AsyncStorage.removeItem("mobile_profile");
}
