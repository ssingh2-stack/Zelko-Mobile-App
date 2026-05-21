import { Platform } from "react-native";

export const C = {
  cream: "#FAFAFA",
  surface: "#F3F4F6",
  white: "#fff",
  espresso: "#111111",
  terra: "#C4683E",
  border: "#E5E7EB",
  muted: "#6B7280",
};

export const BARBER_PALETTES = [
  { bg: "rgba(196,104,62,0.08)",  border: "#C4683E", text: "#8B3A1D" },
  { bg: "rgba(17,17,17,0.06)",    border: "#555555", text: "#111111" },
  { bg: "rgba(107,114,128,0.08)", border: "#9CA3AF", text: "#4B5563" },
  { bg: "rgba(196,104,62,0.05)",  border: "#D4956A", text: "#A0522D" },
  { bg: "rgba(17,17,17,0.04)",    border: "#888888", text: "#333333" },
  { bg: "rgba(107,114,128,0.05)", border: "#6B7280", text: "#374151" },
];

export const serif = Platform.OS === "ios" ? "Georgia" : "serif";

// Standardized spacing and typography
export const S = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 32,
};
export const T = {
  label: 10,
  caption: 11,
  body: 13,
  bodyLg: 14,
  subtitle: 15,
  title: 17,
  heading: 20,
  hero: 28,
};

// Format a number as currency: 1234.5 → "$1,234.50"
export function fmtMoney(n) {
  const num = parseFloat(n) || 0;
  return "$" + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Format a number with commas: 1234 → "1,234"
export function fmtNum(n) {
  const num = parseFloat(n) || 0;
  return Math.round(num).toLocaleString("en-CA");
}
