import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text, ActivityIndicator, View, TouchableOpacity, StyleSheet, Alert } from "react-native";

// ── Error Boundary ───────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) {
    console.error("App crash caught:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#F7F3EE', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontFamily: 'serif', fontSize: 24, fontWeight: '900', color: '#2C1810', marginBottom: 12 }}>Something went wrong</Text>
          <Text style={{ fontSize: 14, color: '#9B8677', textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>The app ran into an unexpected error. Tap below to try again.</Text>
          <TouchableOpacity onPress={() => this.setState({ hasError: false })} style={{ backgroundColor: '#C4683E', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 10 }}>
            <Text style={{ color: '#F7F3EE', fontSize: 15, fontWeight: '700' }}>Try Again</Text>
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
  tabBarInactiveTintColor: "rgba(247,243,238,0.45)",
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
        <Text style={moreStyles.headerLogo}>Clip<Text style={moreStyles.accent}>d</Text></Text>
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
  headerLogo: { fontFamily: serif, fontSize: 22, fontWeight: "900", color: C.cream },
  accent: { color: C.terra },
  headerSub: { fontSize: 11, fontWeight: "700", color: "rgba(247,243,238,0.4)", textTransform: "uppercase", letterSpacing: 2 },
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

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);

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
      {!initialRoute ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: C.cream }}>
          <ActivityIndicator color={C.espresso} size="large" />
        </View>
      ) : (
        <NavigationContainer>
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
