import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "cache_";
const TTL = 10 * 60 * 1000; // 10 min staleness threshold

export async function getCached(key) {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    return { data, stale: Date.now() - ts > TTL };
  } catch {
    return null;
  }
}

export async function setCache(key, data) {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

export async function clearCache(key) {
  try {
    await AsyncStorage.removeItem(PREFIX + key);
  } catch {}
}
