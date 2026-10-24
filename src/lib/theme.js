import { Platform } from "react-native";

// Zelko design tokens (light theme), mirrored from brand/tokens.css.
// 90% neutral, 10% signal: paper and ink carry every screen, Klein Blue is the
// one loud colour, spark is a small highlight only.
export const C = {
  paper: "#F7F6F1",      // screen background
  surface: "#FFFFFF",    // cards, sheets, inputs
  sunk: "#EDEAE3",       // wells, quiet panels, table stripes
  line: "#DEDAD1",       // hairlines and card edges
  lineStrong: "#8A867D", // control borders
  ink: "#0E0E0C",        // primary text
  muted: "#5E5C57",      // secondary text, second half of two-tone headlines
  blue: "#1A24C9",       // Klein Blue: primary actions, selected states
  onBlue: "#FFFFFF",
  blueSoft: "#E4E6FB",   // selected rows, Booked badge
  spark: "#FFF04A",      // highlight only, never a button or large fill
  onSpark: "#0E0E0C",
  night: "#0E0E0C",      // dark panels: day revenue card, payment screens
  onNight: "#F3F1EC",
  nightMuted: "#A3A09A",
  success: "#1D7A46",    // always with a word or check
  successSoft: "#E6F2EA",
  danger: "#C2321F",     // always with a word
  dangerSoft: "#FBEAE6",
  white: "#FFFFFF",
};

// Geist for UI and body, Geist Mono for uppercase labels and data.
// Custom fonts in React Native pick a weight by family name, not fontWeight.
export const F = {
  regular: "Geist_400Regular",
  medium: "Geist_500Medium",
  semibold: "Geist_600SemiBold",
  mono: "GeistMono_400Regular",
  monoMedium: "GeistMono_500Medium",
};

// Kept for screens that still import it; headlines are Geist Regular now.
export const serif = F.regular;

// Per-barber colours on calendars and avatars. Brand colours only, told apart by
// strength of fill and edge; the barber's name is always shown alongside.
export const DCAL_COLORS = [
  { bg: "#E4E6FB",              bd: "#1A24C9",              tx: "#1A24C9" },
  { bg: "#EDEAE3",              bd: "#0E0E0C",              tx: "#0E0E0C" },
  { bg: "rgba(26,36,201,0.05)", bd: "rgba(26,36,201,0.55)", tx: "#1A24C9" },
  { bg: "#F2F0EA",              bd: "#5E5C57",              tx: "#3B3A36" },
  { bg: "rgba(14,14,12,0.04)",  bd: "#8A867D",              tx: "#3B3A36" },
];

export const BARBER_PALETTES = DCAL_COLORS.map(c => ({ bg: c.bg, border: c.bd, text: c.tx }));

export const shadowCard = Platform.select({
  ios: { shadowColor: "#0E0E0C", shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  default: { elevation: 1 },
});
export const shadowPop = Platform.select({
  ios: { shadowColor: "#0E0E0C", shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } },
  default: { elevation: 8 },
});

// Standardized spacing and typography
export const S = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 32,
};
export const T = {
  label: 11,
  caption: 12,
  body: 14,
  bodyLg: 15,
  subtitle: 16,
  title: 17,
  heading: 22,
  hero: 30,
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

// Client tags as words, never colour alone. "New client" is the one spark on a row.
export const CLIENT_TAGS = {
  vip:     { label: "VIP",        bg: "#E4E6FB", text: "#1A24C9", border: "#E4E6FB" },
  new:     { label: "New client", bg: "#FFF04A", text: "#0E0E0C", border: "#FFF04A" },
  regular: { label: "Regular",    bg: "#EDEAE3", text: "#5E5C57", border: "#EDEAE3" },
  lapsed:  { label: "Lapsed",     bg: "#FFFFFF", text: "#5E5C57", border: "#DEDAD1" },
};
