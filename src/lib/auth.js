import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";
import { unregisterPushToken } from "./pushNotifications";

export async function saveSession(token, profile) {
  await AsyncStorage.setItem("mobile_token", token);
  await AsyncStorage.setItem("mobile_profile", JSON.stringify(profile));
}

export async function getSession() {
  const token = await AsyncStorage.getItem("mobile_token");
  const profileStr = await AsyncStorage.getItem("mobile_profile");
  if (!token || !profileStr) return null;
  return { token, profile: JSON.parse(profileStr) };
}

export async function clearSession() {
  // Unregister push token from backend BEFORE we drop the auth token,
  // otherwise the unregister API call has no auth and silently fails.
  // Wrapped so push cleanup never blocks logout.
  try {
    const profileStr = await AsyncStorage.getItem("mobile_profile");
    const profile = profileStr ? JSON.parse(profileStr) : null;
    if (profile?.role) {
      await unregisterPushToken({ role: profile.role });
    }
  } catch (_) {}
  try { await api.logout(); } catch (_) {}
  await AsyncStorage.removeItem("mobile_token");
  await AsyncStorage.removeItem("mobile_profile");
}
