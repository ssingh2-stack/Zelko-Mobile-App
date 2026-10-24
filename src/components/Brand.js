import React from "react";
import Svg, { Path, Rect } from "react-native-svg";
import { C } from "../lib/theme";

// Outlined paths copied from brand/logos. Never retype the wordmark in a font.
const WORDMARK_D = "M36.50 27.50 L6.80 27.50 L6.80 17.60 L51.53 17.60 L5.70 66.55 L5.70 60.40 Z M51.60 28.20 L20.40 61.10 L52.40 61.10 L52.40 71.00 L5.70 71.00 L5.70 70.65 L51.60 21.62 Z M59.3 44.3Q59.3 36.0 62.5 29.65Q65.7 23.3 71.55 19.85Q77.4 16.4 85.2 16.4Q92.8 16.4 98.55 19.8Q104.3 23.2 107.45 29.65Q110.6 36.1 110.6 45.0V47.9H72.6Q73.0 54.8 76.4 58.4Q79.8 62.0 85.6 62.0Q89.8 62.0 92.7 60.05Q95.6 58.1 96.7 54.6L109.8 55.4Q107.6 63.2 101.15 67.7Q94.7 72.2 85.5 72.2Q77.6 72.2 71.65 68.75Q65.7 65.3 62.5 59.0Q59.3 52.7 59.3 44.3ZM85.2 26.5Q80.0 26.5 76.65 29.8Q73.3 33.1 72.6 39.3H97.3Q96.9 32.9 93.7 29.7Q90.5 26.5 85.2 26.5Z M132.40 0.00 L132.40 57.10 L132.43 57.74 L132.51 58.32 L132.65 58.85 L132.84 59.32 L133.09 59.74 L133.40 60.10 L133.76 60.41 L134.18 60.66 L134.65 60.85 L135.18 60.99 L135.76 61.07 L136.40 61.10 L139.50 61.10 L140.30 61.10 L146.10 61.10 L136.83 71.00 L132.40 71.00 L131.39 70.98 L130.41 70.92 L129.48 70.81 L128.58 70.66 L127.73 70.47 L126.91 70.24 L126.14 69.96 L125.40 69.64 L124.70 69.28 L124.05 68.88 L123.43 68.44 L122.85 67.95 L122.31 67.42 L121.83 66.84 L121.38 66.21 L120.99 65.53 L120.64 64.81 L120.34 64.04 L120.08 63.22 L119.87 62.35 L119.71 61.43 L119.59 60.47 L119.52 59.46 L119.50 58.40 L119.60 0.00 Z M152.7 0.0H165.5V41.7L187.4 17.6H203.2L182.3 39.8L203.9 71.0H189.5L173.9 47.4L165.5 56.3V71.0H152.7Z M209.4 44.3Q209.4 35.9 212.65 29.6Q215.9 23.3 221.85 19.85Q227.8 16.4 235.7 16.4Q243.5 16.4 249.45 19.85Q255.4 23.3 258.65 29.6Q261.9 35.9 261.9 44.3Q261.9 52.7 258.65 59.0Q255.4 65.3 249.45 68.75Q243.5 72.2 235.7 72.2Q227.8 72.2 221.85 68.75Q215.9 65.3 212.65 59.0Q209.4 52.7 209.4 44.3ZM248.7 44.3Q248.7 36.0 245.25 31.4Q241.8 26.8 235.7 26.8Q229.5 26.8 226.1 31.4Q222.7 36.0 222.7 44.3Q222.7 52.6 226.1 57.2Q229.5 61.8 235.7 61.8Q241.9 61.8 245.3 57.2Q248.7 52.6 248.7 44.3Z";

// The two halves of the cut z on the 256-unit symbol tile.
export const Z_TOP_D = "M147.53 83.96 L69.67 83.96 L69.67 58.00 L186.93 58.00 L66.78 186.34 L66.78 170.21 Z";
export const Z_BOTTOM_D = "M187.12 85.79 L105.32 172.04 L189.22 172.04 L189.22 198.00 L66.78 198.00 L66.78 197.08 L187.12 68.54 Z";

/** The Zelko wordmark. `color` is ink by default; use paper on night, blue only on paper or white. */
export function Wordmark({ height = 22, color = C.ink }) {
  const width = (height * 266) / 71;
  return (
    <Svg width={width} height={height} viewBox="0 0 266 71" accessibilityRole="image" accessibilityLabel="Zelko">
      <Path fill={color} d={WORDMARK_D} />
    </Svg>
  );
}

/** The cut z on a tile. Tile is blue, ink or paper only; the z is the opposite neutral. */
export function Symbol({ size = 32, tile = C.blue, z = C.onBlue }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256" accessibilityRole="image" accessibilityLabel="Zelko">
      <Rect width={256} height={256} rx={60} fill={tile} />
      <Path fill={z} d={Z_TOP_D} />
      <Path fill={z} d={Z_BOTTOM_D} />
    </Svg>
  );
}
