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
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import { useAuth } from "../src/contexts/AuthContext";
import { api } from "../src/lib/api";
import { colors, fonts, radii, space } from "../src/theme";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { login, loginWithToken } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "apple" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = React.useState(false);

  React.useEffect(() => {
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync()
        .then(setAppleAvailable)
        .catch(() => setAppleAvailable(false));
    }
  }, []);

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

  const handleGoogle = async () => {
    setError(null);
    setSocialLoading("google");
    try {
      // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
      const backend = process.env.EXPO_PUBLIC_BACKEND_URL!;
      const redirectUrl = `${backend}/auth-callback`;
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

      if (Platform.OS === "web") {
        // On web, simply navigate so the URL fragment (#session_id=...) works
        // Auth-callback page will then exchange the session_id for our JWT
        window.location.href = authUrl;
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      if (result.type === "success" && result.url) {
        // Parse #session_id from result url
        const m = result.url.match(/[#&]session_id=([^&]+)/);
        if (!m) throw new Error("Google sign-in returned no session");
        const session_id = decodeURIComponent(m[1]);
        const res = await api.googleSession(session_id);
        await loginWithToken(res.token, res.user);
        router.replace("/");
      } else if (result.type === "cancel" || result.type === "dismiss") {
        // user cancelled
      } else {
        throw new Error("Google sign-in failed");
      }
    } catch (e: any) {
      setError(e.message || "Google sign-in failed");
    } finally {
      setSocialLoading(null);
    }
  };

  const handleApple = async () => {
    setError(null);
    setSocialLoading("apple");
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error("No identity token from Apple");
      const fullName = credential.fullName
        ? [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(" ")
        : undefined;
      const res = await api.appleAuth({
        identity_token: credential.identityToken,
        name: fullName,
        email: credential.email || undefined,
      });
      await loginWithToken(res.token, res.user);
      router.replace("/");
    } catch (e: any) {
      if (e?.code === "ERR_REQUEST_CANCELED") {
        // user cancelled
      } else {
        setError(e.message || "Apple sign-in failed");
      }
    } finally {
      setSocialLoading(null);
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

          <TouchableOpacity
            testID="google-signin-btn"
            style={[styles.socialBtn, socialLoading === "google" && { opacity: 0.7 }]}
            onPress={handleGoogle}
            disabled={socialLoading !== null || loading}
            activeOpacity={0.8}
          >
            {socialLoading === "google" ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color={colors.textPrimary} />
                <Text style={styles.socialBtnText}>CONTINUE WITH GOOGLE</Text>
              </>
            )}
          </TouchableOpacity>

          {Platform.OS === "ios" && appleAvailable && (
            <TouchableOpacity
              testID="apple-signin-btn"
              style={[styles.appleBtn, socialLoading === "apple" && { opacity: 0.7 }]}
              onPress={handleApple}
              disabled={socialLoading !== null || loading}
              activeOpacity={0.8}
            >
              {socialLoading === "apple" ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Ionicons name="logo-apple" size={18} color="#000" />
                  <Text style={styles.appleBtnText}>CONTINUE WITH APPLE</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

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
            disabled={loading || socialLoading !== null}
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
  socialBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: space.sm,
    marginBottom: space.sm,
  },
  socialBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: colors.textPrimary,
    letterSpacing: 1.5,
  },
  appleBtn: {
    backgroundColor: "#fff",
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: space.sm,
    marginBottom: space.sm,
  },
  appleBtnText: { fontFamily: fonts.bodySemi, fontSize: 13, color: "#000", letterSpacing: 1.5 },
  divider: { flexDirection: "row", alignItems: "center", marginVertical: space.lg, gap: space.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontFamily: fonts.monoBold, fontSize: 11, color: colors.textTertiary, letterSpacing: 2 },
  error: { color: colors.error, fontFamily: fonts.body, fontSize: 13, marginTop: space.md },
  footerRow: { flexDirection: "row", justifyContent: "center" },
  footerText: { color: colors.textSecondary, fontFamily: fonts.body },
  footerLink: { color: colors.primary, fontFamily: fonts.bodySemi },
});
