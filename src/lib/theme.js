import { Platform } from "react-native";

export const C = {
  cream: "#F7F3EE",
  surface: "#F0EAE2",
  white: "#fff",
  espresso: "#2C1810",
  terra: "#C4683E",
  border: "#E0D5CB",
  muted: "#9B8677",
};

export const BARBER_PALETTES = [
  { bg: "rgba(59,130,246,0.07)",  border: "#3B82F6", text: "#1D4ED8" },
  { bg: "rgba(16,185,129,0.07)",  border: "#10B981", text: "#065F46" },
  { bg: "rgba(139,92,246,0.07)",  border: "#8B5CF6", text: "#5B21B6" },
  { bg: "rgba(245,158,11,0.07)",  border: "#F59E0B", text: "#92400E" },
  { bg: "rgba(239,68,68,0.07)",   border: "#EF4444", text: "#991B1B" },
  { bg: "rgba(6,182,212,0.07)",   border: "#06B6D4", text: "#155E75" },
];

export const serif = Platform.OS === "ios" ? "Georgia" : "serif";

// Format a number as currency: 1234.5 → "$1,235"
export function fmtMoney(n) {
  const num = parseFloat(n) || 0;
  return "$" + Math.round(num).toLocaleString("en-CA");
}

// Format a number with commas: 1234 → "1,234"
export function fmtNum(n) {
  const num = parseFloat(n) || 0;
  return Math.round(num).toLocaleString("en-CA");
}
