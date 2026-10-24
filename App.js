import React, { useEffect, useState, useRef } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text, View, ScrollView, TouchableOpacity, StyleSheet, Alert, Animated, Easing, AccessibilityInfo } from "react-native";
import Svg, { Path, Rect, Line, G } from "react-native-svg";
import { useFonts } from "expo-font";
import { Geist_400Regular } from "@expo-google-fonts/geist/400Regular";
import { Geist_500Medium } from "@expo-google-fonts/geist/500Medium";
import { Geist_600SemiBold } from "@expo-google-fonts/geist/600SemiBold";
import { GeistMono_400Regular } from "@expo-google-fonts/geist-mono/400Regular";
import { GeistMono_500Medium } from "@expo-google-fonts/geist-mono/500Medium";
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
        <View style={{ flex: 1, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 26, fontFamily: F.regular, color: C.ink, letterSpacing: -0.6, marginBottom: 10, textAlign: 'center' }}>Something went wrong.</Text>
          <Text style={{ fontFamily: F.regular, fontSize: 15, color: C.muted, textAlign: 'center', marginBottom: 24, lineHeight: 22 }}>The app hit an unexpected error. Your bookings are safe. Tap below to try again.</Text>
          <TouchableOpacity onPress={() => this.setState({ hasError: false })} style={{ backgroundColor: C.blue, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 }}>
            <Text style={{ color: C.onBlue, fontSize: 15, fontFamily: F.medium }}>Try again</Text>
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
import { F, C } from "./src/lib/theme";
import { RoleProvider } from "./src/lib/RoleContext";
import { Wordmark, Z_TOP_D, Z_BOTTOM_D } from "./src/components/Brand";

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

// Five tabs on a light bar: the selected tab is Klein Blue, the rest ink-muted,
// always with a label (brand/components/AppNav).
const tabBarOptions = {
  tabBarActiveTintColor: C.blue,
  tabBarInactiveTintColor: C.muted,
  tabBarStyle: {
    backgroundColor: C.surface,
    borderTopColor: C.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    height: 84,
    paddingTop: 8,
    paddingBottom: 18,
  },
  tabBarLabelStyle: {
    fontSize: 11,
    fontFamily: F.medium,
    marginTop: 2,
  },
  headerShown: false,
};

// ── More home screen ──────────────────────────────────────────────────────────
const MORE_GROUPS = [
  { title: "Shop", items: [
    { icon: "cut-outline",           label: "Services",      screen: "Services" },
    { icon: "people-outline",        label: "Team",          screen: "Barbers" },
    { icon: "wallet-outline",        label: "Compensation",  screen: "Compensation" },
    { icon: "card-outline",          label: "Payments",      screen: "Payments" },
  ]},
  { title: "Grow", items: [
    { icon: "globe-outline",         label: "Your site",     screen: "BrandedSite" },
    { icon: "qr-code-outline",       label: "Share your link", screen: "Share" },
    { icon: "notifications-outline", label: "Notifications", screen: "Notifications" },
  ]},
  { title: "Account", items: [
    { icon: "settings-outline",      label: "Settings",      screen: "Settings" },
  ]},
];

function MoreHomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  function handleDeleteAccount() {
    Alert.alert(
      "Delete your account?",
      "This permanently deletes your shop, barbers, bookings and data. It can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => {
          Alert.prompt(
            "Confirm deletion",
            'Type DELETE to permanently delete your account.',
            [
              { text: "Cancel", style: "cancel" },
              { text: "Delete forever", style: "destructive", onPress: async (text) => {
                if (text !== "DELETE") {
                  Alert.alert("Not deleted", "Type DELETE in capitals to confirm.");
                  return;
                }
                try {
                  await api.deleteAccount("DELETE");
                  await clearSession();
                  navigation.reset({ index: 0, routes: [{ name: "Login" }] });
                } catch (err) {
                  Alert.alert("Couldn't delete your account", err.message);
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
    <ScrollView style={moreStyles.container} contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 32 }}>
      <View style={moreStyles.header}>
        <Wordmark height={22} />
        <Text style={moreStyles.headerSub}>More</Text>
      </View>
      {MORE_GROUPS.map(group => (
        <View key={group.title} style={moreStyles.group}>
          <Text style={moreStyles.groupLabel}>{group.title}</Text>
          <View style={moreStyles.card}>
            {group.items.map((item, i) => (
              <TouchableOpacity key={item.screen} style={[moreStyles.row, i > 0 && moreStyles.rowDivider]}
                onPress={() => navigation.navigate(item.screen)} accessibilityRole="button">
                <View style={moreStyles.iconTile}><Ionicons name={item.icon} size={18} color={C.blue} /></View>
                <Text style={moreStyles.rowLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={C.lineStrong} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
      <View style={[moreStyles.group, { marginTop: 8 }]}>
        <View style={moreStyles.card}>
          <TouchableOpacity style={moreStyles.row} accessibilityRole="button" onPress={() => {
            Alert.alert("Log out?", "You can sign back in any time.", [
              { text: "Cancel", style: "cancel" },
              { text: "Log out", style: "destructive", onPress: async () => {
                try { await api.logout(); } catch {}
                await clearSession();
                navigation.reset({ index: 0, routes: [{ name: "Login" }] });
              }},
            ]);
          }}>
            <View style={[moreStyles.iconTile, { backgroundColor: C.sunk }]}><Ionicons name="log-out-outline" size={18} color={C.ink} /></View>
            <Text style={moreStyles.rowLabel}>Log out</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={moreStyles.deleteRow} onPress={handleDeleteAccount} accessibilityRole="button">
          <Text style={moreStyles.deleteLabel}>Delete account</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const moreStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.paper },
  header: {
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  headerSub: { fontSize: 12, fontFamily: F.monoMedium, color: C.muted, textTransform: "uppercase", letterSpacing: 1.2 },
  group: { paddingHorizontal: 16, marginTop: 18 },
  groupLabel: { fontSize: 12, fontFamily: F.mono, color: C.muted, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: C.surface, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 14, paddingVertical: 12, minHeight: 56 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  iconTile: { width: 32, height: 32, borderRadius: 9, backgroundColor: C.blueSoft, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, fontSize: 16, fontFamily: F.regular, color: C.ink },
  deleteRow: { alignItems: "center", paddingVertical: 16, marginTop: 8 },
  deleteLabel: { fontSize: 15, fontFamily: F.medium, color: C.danger },
});

// ── Shared nav header style ───────────────────────────────────────────────────
const subScreenOptions = (title) => ({
  headerShown: true,
  title,
  headerStyle: { backgroundColor: C.paper },
  headerShadowVisible: false,
  headerTintColor: C.ink,
  headerTitleStyle: { fontSize: 17, fontFamily: F.medium, color: C.ink },
  headerBackTitle: " ",
  headerBackTitleVisible: false,
  contentStyle: { backgroundColor: C.paper },
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
      <MoreStack.Screen name="BrandedSite"  component={BrandedSiteScreen} options={subScreenOptions("Your site")} />
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
      <StaffMoreStack.Screen name="StaffSettings" component={StaffSettingsScreen} options={subScreenOptions("My profile")} />
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

// ── Launch: the Zelko symbol motion (brand/motion/zelko-symbol-motion.svg) ──
// The tile scales in, a spark blade draws along the cut, the halves nudge apart
// and settle. Plays once, then the screen fades into the app. Static when the
// owner has Reduce Motion on.
const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedG = Animated.createAnimatedComponent(G);
const Z_WHOLE_D = "M66.78 170.21 L147.53 83.96 L69.67 83.96 L69.67 58.00 L187.12 58.00 L187.12 85.79 L105.32 172.04 L189.22 172.04 L189.22 198.00 L66.78 198.00 Z";
const ease = Easing.bezier(0.2, 0.8, 0.2, 1);

function LaunchSplash({ onFinish }) {
  const t = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((calm) => {
      if (cancelled) return;
      if (calm) {
        t.setValue(1);
        setTimeout(() => onFinish(), 500);
        return;
      }
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: false }),
        Animated.delay(250),
        Animated.timing(exit, { toValue: 0, duration: 300, easing: ease, useNativeDriver: false }),
      ]).start(() => onFinish());
    });
    return () => { cancelled = true; };
  }, []);

  const tileScale = t.interpolate({ inputRange: [0, 0.22, 1], outputRange: [0.86, 1, 1], easing: ease });
  const tileOpacity = t.interpolate({ inputRange: [0, 0.22, 1], outputRange: [0, 1, 1] });
  const whole = t.interpolate({ inputRange: [0, 0.635, 0.64, 1], outputRange: [1, 1, 0, 0] });
  const cut = t.interpolate({ inputRange: [0, 0.635, 0.64, 1], outputRange: [0, 0, 1, 1] });
  const nudge = t.interpolate({ inputRange: [0, 0.64, 0.78, 0.92, 1], outputRange: [0, 0, 1, 0, 0], easing: ease });
  const upX = Animated.multiply(nudge, -2.68), upY = Animated.multiply(nudge, -2.51);
  const loX = Animated.multiply(nudge, 2.68), loY = Animated.multiply(nudge, 2.51);
  const dash = t.interpolate({ inputRange: [0, 0.3, 0.62, 1], outputRange: [204.5, 204.5, 0, 0], easing: ease });
  const blade = t.interpolate({ inputRange: [0, 0.66, 0.92, 1], outputRange: [1, 1, 0, 0] });

  return (
    <Animated.View style={[splashStyles.wrap, { opacity: exit }]} accessibilityLabel="Zelko">
      <Animated.View style={{ opacity: tileOpacity, transform: [{ scale: tileScale }] }}>
        <Svg width={96} height={96} viewBox="0 0 256 256">
          <Rect width={256} height={256} rx={60} fill={C.blue} />
          <AnimatedG opacity={whole}><Path fill={C.onBlue} d={Z_WHOLE_D} /></AnimatedG>
          <AnimatedG opacity={cut}>
            <AnimatedG x={upX} y={upY}><Path fill={C.onBlue} d={Z_TOP_D} /></AnimatedG>
            <AnimatedG x={loX} y={loY}><Path fill={C.onBlue} d={Z_BOTTOM_D} /></AnimatedG>
          </AnimatedG>
          <AnimatedLine x1={60.97} y1={197.92} x2={200.72} y2={48.64} stroke={C.spark} strokeWidth={8.8}
            strokeDasharray={[204.5, 204.5]} strokeDashoffset={dash} opacity={blade} />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const splashStyles = StyleSheet.create({
  wrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, backgroundColor: C.paper, justifyContent: "center", alignItems: "center" },
});

export default function App() {
  const [fontsLoaded] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold, GeistMono_400Regular, GeistMono_500Medium });
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
      {!splashDone && <LaunchSplash onFinish={() => setSplashDone(true)} />}
      {!initialRoute ? (
        <View style={{ flex: 1, backgroundColor: C.paper }} />
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
