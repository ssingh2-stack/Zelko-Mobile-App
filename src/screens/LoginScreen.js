import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../lib/api";
import { saveSession } from "../lib/auth";
import { F, C, shadowCard } from "../lib/theme";
import { Symbol } from "../components/Brand";

export default function LoginScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState("login"); // "login" | "signup"
  const [mode, setMode] = useState("admin");
  const [field1, setField1] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Sign-up fields
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupShop, setSignupShop] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  async function handleLogin() {
    if (!field1.trim() || !password.trim()) {
      Alert.alert("Missing fields", "Fill in every field to continue.");
      return;
    }
    setLoading(true);
    try {
      let data;
      if (mode === "admin") {
        data = await api.adminLogin(field1.trim().toLowerCase(), password);
        await saveSession(data.token, { role: "admin", ...data });
        // Check if they need onboarding
        try {
          const [barbers, services] = await Promise.all([
            api.adminBarbers().catch(() => []),
            api.adminServices().catch(() => []),
          ]);
          const bList = Array.isArray(barbers) ? barbers : [];
          const sList = Array.isArray(services) ? services : [];
          if (bList.length === 0 || sList.length === 0) {
            navigation.replace("Onboarding");
          } else {
            navigation.replace("AdminTabs");
          }
        } catch {
          navigation.replace("AdminTabs");
        }
      } else {
        data = await api.staffLogin(field1.trim().toLowerCase(), password);
        await saveSession(data.token, { role: "staff", ...data });
        navigation.replace("StaffTabs");
      }
    } catch (err) {
      Alert.alert("Couldn't sign in", err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup() {
    if (!signupShop.trim() || !signupEmail.trim() || !signupPassword.trim() || !signupName.trim()) {
      Alert.alert("Missing fields", "Fill in every field to continue.");
      return;
    }
    setLoading(true);
    try {
      const data = await api.adminSignup({
        name: signupName.trim(),
        email: signupEmail.trim().toLowerCase(),
        shop_name: signupShop.trim(),
        password: signupPassword,
      });
      await saveSession(data.token, { role: "admin", ...data });
      navigation.replace("Onboarding");
    } catch (err) {
      Alert.alert("Couldn't create your account", err.message);
    } finally {
      setLoading(false);
    }
  }

  if (screen === "signup") {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}><Symbol size={48} /></View>
          <Text style={styles.heading}>Start your shop. <Text style={styles.headingMuted}>14 days free.</Text></Text>
          <Text style={styles.subheading}>No credit card. Set up takes about 10 minutes.</Text>

          <Text style={styles.label}>Your name</Text>
          <TextInput
            style={styles.input}
            placeholder="Marcus Williams"
            placeholderTextColor={C.muted}
            autoCapitalize="words"
            value={signupName}
            onChangeText={setSignupName}
          />
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@yourshop.ca"
            placeholderTextColor={C.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={signupEmail}
            onChangeText={setSignupEmail}
          />
          <Text style={styles.label}>Shop name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your shop"
            placeholderTextColor={C.muted}
            autoCapitalize="words"
            value={signupShop}
            onChangeText={setSignupShop}
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="At least 8 characters"
            placeholderTextColor={C.muted}
            secureTextEntry
            value={signupPassword}
            onChangeText={setSignupPassword}
          />

          <TouchableOpacity style={styles.btn} onPress={handleSignup} disabled={loading}>
            {loading ? <ActivityIndicator color={C.onBlue} /> : <Text style={styles.btnText}>Create account</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.switchRow} onPress={() => setScreen("login")}>
            <Text style={styles.switchText}>Already have an account? <Text style={styles.switchLink}>Sign in</Text></Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}><Symbol size={48} /></View>
        <Text style={styles.heading}>Run the shop. <Text style={styles.headingMuted}>Not the paperwork.</Text></Text>
        <Text style={styles.subheading}>Sign in to Zelko.</Text>

        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === "admin" && styles.toggleActive]}
            onPress={() => setMode("admin")}
          >
            <Text style={[styles.toggleText, mode === "admin" && styles.toggleTextActive]}>Shop owner</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === "staff" && styles.toggleActive]}
            onPress={() => setMode("staff")}
          >
            <Text style={[styles.toggleText, mode === "staff" && styles.toggleTextActive]}>Staff</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>{mode === "admin" ? "Shop ID" : "Email"}</Text>
        <TextInput
          style={styles.input}
          testID="field1"
          accessibilityLabel={mode === "admin" ? "Shop ID" : "Email"}
          placeholder={mode === "admin" ? "yourshop" : "you@yourshop.ca"}
          placeholderTextColor={C.muted}
          autoCapitalize="none"
          autoCorrect={false}
          value={field1}
          onChangeText={setField1}
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          testID="password"
          accessibilityLabel="Password"
          placeholder="Your password"
          placeholderTextColor={C.muted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color={C.onBlue} /> : <Text style={styles.btnText}>Sign in</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.switchRow} onPress={() => setScreen("signup")}>
          <Text style={styles.switchText}>New to Zelko? <Text style={styles.switchLink}>Create an account</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.paper },
  scrollContent: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingBottom: 40 },
  brand: { marginBottom: 28 },
  heading: { fontSize: 34, lineHeight: 38, fontFamily: F.regular, color: C.ink, letterSpacing: -1.1, marginBottom: 8 },
  headingMuted: { color: C.muted },
  subheading: { fontFamily: F.regular, fontSize: 16, color: C.muted, marginBottom: 28 },
  toggle: { flexDirection: "row", backgroundColor: C.sunk, borderRadius: 12, marginBottom: 20, padding: 4 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center" },
  toggleActive: { backgroundColor: C.surface, ...shadowCard },
  toggleText: { color: C.muted, fontFamily: F.medium, fontSize: 15 },
  toggleTextActive: { color: C.ink },
  label: { fontSize: 14, fontFamily: F.medium, color: C.ink, marginBottom: 6 },
  input: { backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 14, height: 48, fontFamily: F.regular, fontSize: 16, color: C.ink, marginBottom: 16, borderWidth: 1, borderColor: C.lineStrong },
  btn: { backgroundColor: C.blue, borderRadius: 12, height: 52, justifyContent: "center", alignItems: "center", marginTop: 8 },
  btnText: { color: C.onBlue, fontFamily: F.medium, fontSize: 16 },
  switchRow: { marginTop: 20, alignItems: "center", paddingVertical: 8 },
  switchText: { fontFamily: F.regular, fontSize: 15, color: C.muted },
  switchLink: { color: C.blue, fontFamily: F.medium },
});
