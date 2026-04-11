import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";

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
  try { await api.logout(); } catch (_) {}
  await AsyncStorage.removeItem("mobile_token");
  await AsyncStorage.removeItem("mobile_profile");
}
