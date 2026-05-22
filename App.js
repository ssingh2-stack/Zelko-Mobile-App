import React, { useEffect, useState, useRef } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text, ActivityIndicator, View, TouchableOpacity, StyleSheet, Alert, Animated } from "react-native";
import * as Notifications from "expo-notifications";

import { navigationRef } from "./src/lib/navigation";

// ── Error Boundary ───────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) {
    if (__DEV__) console.error("App crash caught:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#FAFAFA', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontFamily: 'serif', fontSize: 24, fontWeight: '900', color: '#111111', marginBottom: 12 }}>Something went wrong</Text>
          <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>The app ran into an unexpected error. Tap below to try again.</Text>
          <TouchableOpacity onPress={() => this.setState({ hasError: false })} style={{ backgroundColor: '#C4683E', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 10 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getSession, clearSession } from "./src/lib/auth";
import { api } from "./src/lib/api";
import { C, serif } from "./src/lib/theme";
import { RoleProvider } from "./src/lib/RoleContext";

import LoginScreen from "./src/screens/LoginScreen";
import TodayScreen from "./src/screens/admin/TodayScreen";
import ScheduleScreen from "./src/screens/admin/ScheduleScreen";
import ClientsScreen from "./src/screens/admin/ClientsScreen";
import InsightsScreen from "./src/screens/admin/InsightsScreen";
import StaffScheduleScreen from "./src/screens/staff/StaffScheduleScreen";
import StaffSettingsScreen from "./src/screens/staff/StaffSettingsScreen";
import StaffMoreScreen from "./src/screens/staff/StaffMoreScreen";

import ServicesScreen from "./src/screens/admin/more/ServicesScreen";
import ShareScreen from "./src/screens/admin/more/ShareScreen";
import PaymentsScreen from "./src/screens/admin/more/PaymentsScreen";
import SettingsScreen from "./src/screens/admin/more/SettingsScreen";
import BarbersScreen from "./src/screens/admin/more/BarbersScreen";
import CompensationScreen from "./src/screens/admin/more/CompensationScreen";
import BrandedSiteScreen from "./src/screens/admin/more/BrandedSiteScreen";
import NotificationsScreen from "./src/screens/admin/more/NotificationsScreen";
import OnboardingScreen from "./src/screens/admin/OnboardingScreen";

const Stack = createNativeStackNavigator();
const MoreStack = createNativeStackNavigator();
const StaffMoreStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabIon({ name, color, size = 22 }) {
  return <Ionicons name={name} size={size} color={color} />;
}

const tabBarOptions = {
  tabBarActiveTintColor: C.terra,
  tabBarInactiveTintColor: "rgba(250,250,250,0.4)",
  tabBarStyle: {
    backgroundColor: C.espresso,
    borderTopColor: "rgba(255,255,255,0.08)",
    height: 82,
    paddingTop: 10,
    paddingBottom: 16,
  },
  tabBarLabelStyle: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.2,
    marginTop: 2,
  },
  headerShown: false,
};

// ── More home screen ──────────────────────────────────────────────────────────
function MoreHomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const items = [
    { icon: "cut-outline",       label: "Services", screen: "Services" },
    { icon: "person-add-outline", label: "Team",    screen: "Barbers" },
    { icon: "globe-outline",     label: "Branded Site", screen: "BrandedSite", badge: "NEW" },
    { icon: "notifications-outline", label: "Notifications", screen: "Notifications", badge: "NEW" },
    { icon: "wallet-outline",    label: "Compensation", screen: "Compensation" },
    { icon: "share-outline",     label: "Share",    screen: "Share" },
    { icon: "card-outline",      label: "Payments", screen: "Payments" },
    { icon: "settings-outline",  label: "Settings", screen: "Settings" },
  ];

  function handleDeleteAccount() {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your shop, all barbers, bookings, and data. This cannot be undone.\n\nAre you sure?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => {
          Alert.prompt(
            "Confirm Deletion",
            'Type "DELETE" to confirm permanent account deletion.',
            [
              { text: "Cancel", style: "cancel" },
              { text: "Delete Forever", style: "destructive", onPress: async (text) => {
                if (text !== "DELETE") {
                  Alert.alert("Error", 'You must type "DELETE" to confirm.');
                  return;
                }
                try {
                  await api.deleteAccount("DELETE");
                  await clearSession();
                  navigation.reset({ index: 0, routes: [{ name: "Login" }] });
                } catch (err) {
                  Alert.alert("Error", err.message);
                }
              }},
            ],
            "plain-text"
          );
        }},
      ]
    );
  }

  return (
    <View style={[moreStyles.container, { paddingTop: insets.top }]}>
      <View style={moreStyles.header}>
        <Text style={moreStyles.headerLogo}>CLIPD</Text>
        <Text style={moreStyles.headerSub}>More</Text>
      </View>
      {items.map(item => (
        <TouchableOpacity key={item.screen} style={moreStyles.row} onPress={() => navigation.navigate(item.screen)}>
          <Ionicons name={item.icon} size={20} color={C.espresso} style={{ width: 28, textAlign: "center" }} />
          <Text style={moreStyles.rowLabel}>{item.label}</Text>
          {item.badge && (
            <View style={moreStyles.newBadge}>
              <Text style={moreStyles.newBadgeText}>{item.badge}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color={C.muted} />
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={moreStyles.deleteRow} onPress={handleDeleteAccount}>
        <Ionicons name="trash-outline" size={18} color="#DC2626" style={{ width: 28, textAlign: "center" }} />
        <Text style={moreStyles.deleteLabel}>Delete Account</Text>
      </TouchableOpacity>
    </View>
  );
}

const moreStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  header: {
    backgroundColor: C.espresso, paddingHorizontal: 16, paddingBottom: 14, paddingTop: 6,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  headerLogo: { fontSize: 18, fontWeight: "900", color: C.terra, letterSpacing: -0.5 },
  headerSub: { fontSize: 11, fontWeight: "700", color: "rgba(250,250,250,0.4)", textTransform: "uppercase", letterSpacing: 2 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 16,
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: C.white,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: C.espresso },
  newBadge: { backgroundColor: C.terra, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, marginRight: 6 },
  newBadgeText: { color: C.cream, fontSize: 9, fontWeight: "900", letterSpacing: 0.6 },
  deleteRow: {
    flexDirection: "row", alignItems: "center", gap: 16,
    paddingHorizontal: 20, paddingVertical: 16,
    marginTop: 20, marginHorizontal: 16, borderRadius: 10,
    borderWidth: 1.5, borderColor: "#FCA5A5", backgroundColor: "#FEF2F2",
  },
  deleteLabel: { flex: 1, fontSize: 14, fontWeight: "700", color: "#DC2626" },
});

// ── Shared nav header style ───────────────────────────────────────────────────
const subScreenOptions = (title) => ({
  headerShown: true,
  title,
  headerStyle: { backgroundColor: C.espresso },
  headerTintColor: C.cream,
  headerTitleStyle: { fontFamily: serif, fontSize: 17, fontWeight: "700" },
  headerBackTitle: " ",
  headerBackTitleVisible: false,
});

// ── More Navigator ────────────────────────────────────────────────────────────
function MoreNavigator() {
  return (
    <MoreStack.Navigator screenOptions={{ headerShown: false }}>
      <MoreStack.Screen name="MoreHome" component={MoreHomeScreen} options={{ headerShown: false, title: "More" }} />
      <MoreStack.Screen name="Services"     component={ServicesScreen}  options={subScreenOptions("Services")} />
      <MoreStack.Screen name="Share"        component={ShareScreen}     options={subScreenOptions("Share")} />
      <MoreStack.Screen name="Payments"     component={PaymentsScreen}  options={subScreenOptions("Payments")} />
      <MoreStack.Screen name="Settings"     component={SettingsScreen}  options={subScreenOptions("Settings")} />
      <MoreStack.Screen name="Barbers"      component={BarbersScreen}   options={subScreenOptions("Team")} />
      <MoreStack.Screen name="Compensation" component={CompensationScreen} options={subScreenOptions("Compensation")} />
      <MoreStack.Screen name="BrandedSite"  component={BrandedSiteScreen} options={subScreenOptions("Branded Site")} />
      <MoreStack.Screen name="Notifications" options={subScreenOptions("Notifications")}>
        {(props) => <NotificationsScreen {...props} mode="admin" />}
      </MoreStack.Screen>
      {/* Clients_More reuses the same ClientsScreen */}
      <MoreStack.Screen name="Clients_More" component={ClientsScreen}   options={subScreenOptions("Clients")} />
    </MoreStack.Navigator>
  );
}

// ── Tab navigators ────────────────────────────────────────────────────────────
function AdminTabs() {
  return (
    <Tab.Navigator screenOptions={tabBarOptions}>
      <Tab.Screen
        name="Today"
        component={TodayScreen}
        options={{ tabBarIcon: ({ color }) => <TabIon name="sunny-outline" color={color} /> }}
      />
      <Tab.Screen
        name="Schedule"
        component={ScheduleScreen}
        options={{ tabBarIcon: ({ color }) => <TabIon name="calendar-outline" color={color} /> }}
      />
      <Tab.Screen
        name="Clients"
        component={ClientsScreen}
        options={{ tabBarIcon: ({ color }) => <TabIon name="people-outline" color={color} /> }}
      />
      <Tab.Screen
        name="Insights"
        component={InsightsScreen}
        options={{ tabBarIcon: ({ color }) => <TabIon name="bar-chart-outline" color={color} /> }}
      />
      <Tab.Screen
        name="More"
        component={MoreNavigator}
        options={{ tabBarIcon: ({ color }) => <TabIon name="grid-outline" color={color} /> }}
      />
    </Tab.Navigator>
  );
}

function StaffMoreNavigator() {
  return (
    <StaffMoreStack.Navigator screenOptions={{ headerShown: false }}>
      <StaffMoreStack.Screen name="MoreHome" component={StaffMoreScreen} options={{ headerShown: false, title: "More" }} />
      <StaffMoreStack.Screen name="StaffSettings" component={StaffSettingsScreen} options={subScreenOptions("My Profile")} />
      <StaffMoreStack.Screen name="Share" component={ShareScreen} options={subScreenOptions("Share")} />
      <StaffMoreStack.Screen name="Notifications" options={subScreenOptions("Notifications")}>
        {(props) => <NotificationsScreen {...props} mode="staff" />}
      </StaffMoreStack.Screen>
    </StaffMoreStack.Navigator>
  );
}

function StaffTabs() {
  return (
    <RoleProvider value={{ role: "staff" }}>
      <Tab.Navigator screenOptions={tabBarOptions}>
        <Tab.Screen
          name="Today"
          component={TodayScreen}
          options={{ tabBarIcon: ({ color }) => <TabIon name="sunny-outline" color={color} /> }}
        />
        <Tab.Screen
          name="Schedule"
          component={ScheduleScreen}
          options={{ tabBarIcon: ({ color }) => <TabIon name="calendar-outline" color={color} /> }}
        />
        <Tab.Screen
          name="Clients"
          component={ClientsScreen}
          options={{ tabBarIcon: ({ color }) => <TabIon name="people-outline" color={color} /> }}
        />
        <Tab.Screen
          name="Insights"
          component={InsightsScreen}
          options={{ tabBarIcon: ({ color }) => <TabIon name="bar-chart-outline" color={color} /> }}
        />
        <Tab.Screen
          name="More"
          component={StaffMoreNavigator}
          options={{ tabBarIcon: ({ color }) => <TabIon name="grid-outline" color={color} /> }}
        />
      </Tab.Navigator>
    </RoleProvider>
  );
}

/*
 * SPLASH CONCEPTS — pick one:
 *
 * A — "The Breath": CLIPD starts enormous and transparent, slowly pulls into
 *     focus at final size. One continuous cinematic motion. No decoration.
 *
 * B — "The Reveal": Each letter appears one at a time, staggered, precise.
 *     Typewriter energy but slower, more deliberate. Then the whole word
 *     lifts and vanishes.
 *
 * C — "The Cut": Nothing. Beat. CLIPD appears instantly — hard cut, no fade.
 *     Holds with confidence. Then smoothly dissolves. The restraint IS the design.
 */

// ──── CONCEPT A: "The Breath" ────
function SplashA({ onFinish }) {
  const scale = useRef(new Animated.Value(4)).current;
  const opacity = useRef(new Animated.Value(0.06)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Phase 1: pull into focus — scale 4x→1x, opacity 0.06→1 (1200ms, ease-out)
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 1200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 1200, useNativeDriver: true }),
    ]).start();
    // Phase 2: hold (400ms) then dissolve (400ms)
    setTimeout(() => {
      Animated.timing(exitOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => onFinish());
    }, 1700);
  }, []);

  return (
    <Animated.View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, backgroundColor: "#FAFAFA", justifyContent: "center", alignItems: "center", opacity: exitOpacity }}>
      <Animated.Text style={{ fontSize: 48, fontWeight: "900", color: "#C4683E", letterSpacing: -2, opacity, transform: [{ scale }] }}>
        CLIPD
      </Animated.Text>
    </Animated.View>
  );
}

// ──── CONCEPT B: "The Reveal" — Angular Edition ────

// Angular shape: two thin lines meeting at an angle — like open scissors or a V-cut
function AngularShape({ x, y, size, angle, delay: d, color, pulseAt }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const rotation = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    // Fade in + scale up
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, delay: d, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 600, delay: d, useNativeDriver: true }),
    ]).start();
    // Slow continuous rotation
    Animated.loop(
      Animated.timing(rotation, { toValue: 1, duration: 8000, useNativeDriver: true })
    ).start();
    // Pulse when letters land
    if (pulseAt) {
      setTimeout(() => {
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1.8, duration: 80, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 400, useNativeDriver: true }),
        ]).start();
      }, pulseAt);
    }
  }, []);

  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: [`${angle}deg`, `${angle + 45}deg`] });

  return (
    <Animated.View style={{
      position: "absolute", left: x, top: y,
      width: size, height: size,
      opacity,
      transform: [{ rotate: spin }, { scale }],
    }}>
      {/* Two arms forming a V / angular cut shape */}
      <View style={{ position: "absolute", top: 0, left: "50%", width: 1.5, height: size * 0.6, backgroundColor: color, transform: [{ rotate: "-25deg" }] }} />
      <View style={{ position: "absolute", top: 0, left: "50%", width: 1.5, height: size * 0.6, backgroundColor: color, transform: [{ rotate: "25deg" }] }} />
    </Animated.View>
  );
}

// Single clean line that slides across — precision, like a razor line
function SliceLine({ startY, delay: d, speed, color, thickness }) {
  const translateX = useRef(new Animated.Value(-500)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 200, delay: d, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, { toValue: 600, duration: speed, delay: d, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: -500, duration: 0, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{
      position: "absolute", top: startY, left: -200, width: "300%", height: thickness,
      backgroundColor: color, opacity,
      transform: [{ translateX }, { rotate: "8deg" }],
    }} />
  );
}

function DriftLine({ top, delay, speed, thickness, lineColor, pulseAt }) {
  const translateX = useRef(new Animated.Value(-400)).current;
  const lineOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, { toValue: 500, duration: speed, delay, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: -400, duration: 0, useNativeDriver: true }),
      ])
    ).start();
    // Lines pulse brighter when letters land
    if (pulseAt) {
      setTimeout(() => {
        Animated.sequence([
          Animated.timing(lineOpacity, { toValue: 3, duration: 80, useNativeDriver: true }),
          Animated.timing(lineOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]).start();
      }, pulseAt);
    }
  }, []);
  return (
    <Animated.View style={{
      position: "absolute", top, left: -200, width: "300%", height: thickness,
      backgroundColor: lineColor,
      opacity: lineOpacity,
      transform: [{ translateX }, { rotate: "15deg" }],
    }} />
  );
}

function SplashB({ onFinish }) {
  const letters = "CLIPD".split("");
  const letterOpacities = useRef(letters.map(() => new Animated.Value(0))).current;
  const letterYs = useRef(letters.map(() => new Animated.Value(40))).current;
  const letterScales = useRef(letters.map(() => new Animated.Value(0.85))).current;
  const exitScale = useRef(new Animated.Value(1)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;
  const linesOpacity = useRef(new Animated.Value(0)).current;
  const bgFlash = useRef(new Animated.Value(0)).current;
  const breathScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    // Phase 0: angular shapes + slice lines fade in
    Animated.timing(linesOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();

    // Phase 1: stagger letters — each fades in + slides up + scales to 1
    // Timing: 140ms stagger, each letter takes 220ms
    setTimeout(() => {
      letters.forEach((_, i) => {
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(letterOpacities[i], { toValue: 1, duration: 220, useNativeDriver: true }),
            Animated.timing(letterYs[i], { toValue: 0, duration: 280, useNativeDriver: true }),
            Animated.timing(letterScales[i], { toValue: 1, duration: 280, useNativeDriver: true }),
          ]).start();
        }, i * 140);
      });
    }, 400);

    // Phase 2: all letters landed — flash + breathe
    setTimeout(() => {
      // Flash
      Animated.sequence([
        Animated.timing(bgFlash, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(bgFlash, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
      // Breathe: subtle pulse 1→1.03→1
      Animated.sequence([
        Animated.timing(breathScale, { toValue: 1.03, duration: 200, useNativeDriver: true }),
        Animated.timing(breathScale, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }, 1200);

    // Phase 3: cinematic exit — letters scatter outward + scale up + dissolve
    setTimeout(() => {
      // Each letter drifts in a different direction as it fades
      const scatterDirections = [-30, -12, 0, 12, 30];
      letters.forEach((_, i) => {
        Animated.parallel([
          Animated.timing(letterYs[i], { toValue: -20, duration: 400, useNativeDriver: true }),
          Animated.timing(letterOpacities[i], { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start();
      });
      Animated.parallel([
        Animated.timing(exitScale, { toValue: 1.2, duration: 400, useNativeDriver: true }),
        Animated.timing(exitOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start(() => onFinish());
    }, 1800);
  }, []);

  const PULSE_TIME = 1200; // when letters finish landing

  return (
    <Animated.View style={{
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 999,
      backgroundColor: "#FAFAFA", justifyContent: "center", alignItems: "center",
      opacity: exitOpacity, overflow: "hidden",
    }}>
      {/* Drift lines — react to letter landing with opacity pulse */}
      <Animated.View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: linesOpacity }}>
        <DriftLine top="6%"  delay={0}   speed={3500} thickness={2} lineColor="rgba(196,104,62,0.10)" pulseAt={PULSE_TIME} />
        <DriftLine top="16%" delay={200} speed={4500} thickness={1} lineColor="rgba(17,17,17,0.07)"   pulseAt={PULSE_TIME + 40} />
        <DriftLine top="26%" delay={100} speed={3000} thickness={3} lineColor="rgba(196,104,62,0.08)" pulseAt={PULSE_TIME + 80} />
        <DriftLine top="36%" delay={400} speed={4000} thickness={1} lineColor="rgba(17,17,17,0.05)"   pulseAt={null} />
        <DriftLine top="46%" delay={150} speed={5000} thickness={2} lineColor="rgba(196,104,62,0.09)" pulseAt={PULSE_TIME + 20} />
        <DriftLine top="56%" delay={300} speed={3200} thickness={1} lineColor="rgba(17,17,17,0.06)"   pulseAt={PULSE_TIME + 60} />
        <DriftLine top="66%" delay={100} speed={3800} thickness={3} lineColor="rgba(196,104,62,0.07)" pulseAt={null} />
        <DriftLine top="76%" delay={500} speed={4600} thickness={1} lineColor="rgba(17,17,17,0.07)"   pulseAt={PULSE_TIME + 100} />
        <DriftLine top="86%" delay={200} speed={3100} thickness={2} lineColor="rgba(196,104,62,0.10)" pulseAt={PULSE_TIME + 30} />
        <DriftLine top="94%" delay={350} speed={4300} thickness={1} lineColor="rgba(17,17,17,0.05)"   pulseAt={null} />
      </Animated.View>

      {/* Flash overlay */}
      <Animated.View style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: "#FFFFFF",
        opacity: bgFlash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }),
      }} />

      {/* Letters */}
      <Animated.View style={{ flexDirection: "row", alignItems: "center", transform: [{ scale: exitScale }, { scale: breathScale }] }}>
        {letters.map((letter, i) => (
          <Animated.Text key={i} style={{
            fontSize: 58, fontWeight: "900", color: "#C4683E",
            opacity: letterOpacities[i],
            transform: [
              { translateY: letterYs[i] },
              { scale: letterScales[i] },
            ],
          }}>
            {letter}
          </Animated.Text>
        ))}
      </Animated.View>
    </Animated.View>
  );
}

// ──── CONCEPT C: "The Cut" ────
function SplashC({ onFinish }) {
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Phase 1: silence (500ms) then instant appear (50ms — near-instant but not jarring)
    setTimeout(() => {
      Animated.timing(wordOpacity, { toValue: 1, duration: 50, useNativeDriver: true }).start();
    }, 500);
    // Phase 2: hold with confidence (800ms) then smooth dissolve (400ms)
    setTimeout(() => {
      Animated.timing(exitOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => onFinish());
    }, 1800);
  }, []);

  return (
    <Animated.View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, backgroundColor: "#FAFAFA", justifyContent: "center", alignItems: "center", opacity: exitOpacity }}>
      <Animated.Text style={{ fontSize: 48, fontWeight: "900", color: "#C4683E", letterSpacing: -2, opacity: wordOpacity }}>
        CLIPD
      </Animated.Text>
    </Animated.View>
  );
}

// ── Active splash — change this to SplashA, SplashB, or SplashC ──
const SplashAnimation = SplashB;

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);
  const [splashDone, setSplashDone] = useState(false);

  // Deep-link from push notification taps to the relevant screen
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const data = response?.notification?.request?.content?.data || {};
        if (!navigationRef.isReady()) return;
        const VALID_SCREENS = ["Today", "Schedule", "Clients", "Insights"];
        const screen = VALID_SCREENS.includes(data.screen) ? data.screen : "Today";
        const bookingCode = typeof data.bookingCode === "string" ? data.bookingCode.replace(/[^A-Za-z0-9\-]/g, "") : null;
        if (bookingCode) {
          navigationRef.navigate("AdminTabs", { screen: "Schedule", params: { focusBookingCode: bookingCode } });
        } else {
          navigationRef.navigate("AdminTabs", { screen });
        }
      } catch (e) {
        if (__DEV__) console.warn("[push] navigation from notification failed:", e?.message);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    getSession().then(async (session) => {
      if (session?.profile?.role === "admin") {
        // Check if shop needs onboarding
        try {
          const [barbers, services] = await Promise.all([
            api.adminBarbers().catch(() => []),
            api.adminServices().catch(() => []),
          ]);
          const bList = Array.isArray(barbers) ? barbers : [];
          const sList = Array.isArray(services) ? services : [];
          if (bList.length === 0 || sList.length === 0) {
            setInitialRoute("Onboarding");
          } else {
            setInitialRoute("AdminTabs");
          }
        } catch {
          setInitialRoute("AdminTabs");
        }
      } else if (session?.profile?.role === "staff") {
        setInitialRoute("StaffTabs");
      } else {
        setInitialRoute("Login");
      }
    });
  }, []);

  return (
    <SafeAreaProvider>
      {!splashDone && <SplashAnimation onFinish={() => setSplashDone(true)} />}
      {!initialRoute ? (
        <View style={{ flex: 1, backgroundColor: "#FAFAFA" }} />
      ) : (
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login"      component={LoginScreen} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="AdminTabs">{(props) => <ErrorBoundary><AdminTabs {...props} /></ErrorBoundary>}</Stack.Screen>
            <Stack.Screen name="StaffTabs">{(props) => <ErrorBoundary><StaffTabs {...props} /></ErrorBoundary>}</Stack.Screen>
          </Stack.Navigator>
        </NavigationContainer>
      )}
    </SafeAreaProvider>
  );
}
