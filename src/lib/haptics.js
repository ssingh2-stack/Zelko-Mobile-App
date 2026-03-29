// Haptic feedback utilities
// Run: npx expo install expo-haptics
import * as Haptics from "expo-haptics";

export const light   = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
export const medium  = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
export const success = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
export const warn    = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
export const error   = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
