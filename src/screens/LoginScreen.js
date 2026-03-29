import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../lib/api";
import { saveSession } from "../lib/auth";
import { C, serif } from "../lib/theme";

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
      Alert.alert("Missing fields", "Please fill in all fields.");
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
      Alert.alert("Login failed", err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup() {
    if (!signupShop.trim() || !signupEmail.trim() || !signupPassword.trim() || !signupName.trim()) {
      Alert.alert("Missing fields", "Please fill in all fields.");
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
      Alert.alert("Sign up failed", err.message);
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
          <Text style={styles.logo}>Clip<Text style={styles.logoAccent}>d</Text></Text>
          <Text style={styles.heading}>Create Your Account</Text>
          <Text style={styles.subheading}>Start managing your barbershop in minutes.</Text>

          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor={C.muted}
            autoCapitalize="words"
            value={signupName}
            onChangeText={setSignupName}
          />
          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor={C.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={signupEmail}
            onChangeText={setSignupEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Shop name (e.g. Crown Cutz)"
            placeholderTextColor={C.muted}
            autoCapitalize="words"
            value={signupShop}
            onChangeText={setSignupShop}
          />
          <TextInput
            style={styles.input}
            placeholder="Password (min. 6 characters)"
            placeholderTextColor={C.muted}
            secureTextEntry
            value={signupPassword}
            onChangeText={setSignupPassword}
          />

          <TouchableOpacity style={styles.btn} onPress={handleSignup} disabled={loading}>
            {loading ? <ActivityIndicator color={C.cream} /> : <Text style={styles.btnText}>Create Account →</Text>}
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
        <Text style={styles.logo}>Clip<Text style={styles.logoAccent}>d</Text></Text>

        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === "admin" && styles.toggleActive]}
            onPress={() => setMode("admin")}
          >
            <Text style={[styles.toggleText, mode === "admin" && styles.toggleTextActive]}>Shop Owner</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === "staff" && styles.toggleActive]}
            onPress={() => setMode("staff")}
          >
            <Text style={[styles.toggleText, mode === "staff" && styles.toggleTextActive]}>Staff</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.input}
          placeholder={mode === "admin" ? "Shop ID (e.g. crowncutz)" : "Email"}
          placeholderTextColor={C.muted}
          autoCapitalize="none"
          autoCorrect={false}
          value={field1}
          onChangeText={setField1}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={C.muted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color={C.cream} /> : <Text style={styles.btnText}>Sign In</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.switchRow} onPress={() => setScreen("signup")}>
          <Text style={styles.switchText}>New to Clipd? <Text style={styles.switchLink}>Create an account</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  scrollContent: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 32, paddingBottom: 40 },
  logo: { fontFamily: serif, fontSize: 40, fontWeight: "900", color: C.espresso, textAlign: "center", marginBottom: 8 },
  logoAccent: { color: C.terra },
  heading: { fontFamily: serif, fontSize: 22, fontWeight: "800", color: C.espresso, textAlign: "center", marginBottom: 4 },
  subheading: { fontSize: 13, color: C.muted, textAlign: "center", marginBottom: 28 },
  toggle: { flexDirection: "row", backgroundColor: C.surface, borderRadius: 10, marginBottom: 24, padding: 4 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  toggleActive: { backgroundColor: C.espresso },
  toggleText: { color: C.muted, fontWeight: "600", fontSize: 14 },
  toggleTextActive: { color: C.cream },
  input: { backgroundColor: C.surface, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: C.espresso, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  btn: { backgroundColor: C.espresso, borderRadius: 10, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  btnText: { color: C.cream, fontWeight: "700", fontSize: 16 },
  switchRow: { marginTop: 20, alignItems: "center" },
  switchText: { fontSize: 13, color: C.muted },
  switchLink: { color: C.terra, fontWeight: "700" },
});
