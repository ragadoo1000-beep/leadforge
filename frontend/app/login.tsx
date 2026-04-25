import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Link } from "expo-router";
import { useAuth } from "../src/contexts/AuthContext";
import { colors, fonts, radii, space } from "../src/theme";

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/");
    } catch (e: any) {
      setError(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandRow}>
            <View style={styles.logo} />
            <Text style={styles.brand}>LEADFORGE</Text>
          </View>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.subtitle}>
            Find clients. Forge messages. Close deals.
          </Text>

          <View style={{ height: space.xl }} />

          <Text style={styles.label}>EMAIL</Text>
          <TextInput
            testID="login-email-input"
            value={email}
            onChangeText={setEmail}
            placeholder="you@domain.com"
            placeholderTextColor={colors.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />

          <View style={{ height: space.md }} />

          <Text style={styles.label}>PASSWORD</Text>
          <TextInput
            testID="login-password-input"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textTertiary}
            secureTextEntry
            style={styles.input}
          />

          {error && (
            <Text style={styles.error} testID="login-error">
              {error}
            </Text>
          )}

          <View style={{ height: space.lg }} />

          <TouchableOpacity
            testID="login-submit-btn"
            style={[styles.btnPrimary, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnPrimaryText}>SIGN IN</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: space.lg }} />
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>New here? </Text>
            <Link href="/register" asChild>
              <TouchableOpacity testID="go-to-register-btn">
                <Text style={styles.footerLink}>Create account</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: space.lg, paddingTop: space.xl, flexGrow: 1 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.xl },
  logo: { width: 24, height: 24, backgroundColor: colors.primary, borderRadius: 4 },
  brand: { fontFamily: fonts.heading, fontSize: 16, color: colors.textPrimary, letterSpacing: 4 },
  title: { fontFamily: fonts.heading, fontSize: 36, color: colors.textPrimary, lineHeight: 40 },
  subtitle: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, marginTop: space.sm },
  label: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textTertiary, letterSpacing: 1.5, marginBottom: space.xs },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: space.md,
    paddingVertical: 14,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 16,
    alignItems: "center",
  },
  btnPrimaryText: { color: "#fff", fontFamily: fonts.bodySemi, fontSize: 14, letterSpacing: 1.5 },
  error: { color: colors.error, fontFamily: fonts.body, fontSize: 13, marginTop: space.md },
  footerRow: { flexDirection: "row", justifyContent: "center" },
  footerText: { color: colors.textSecondary, fontFamily: fonts.body },
  footerLink: { color: colors.primary, fontFamily: fonts.bodySemi },
});
