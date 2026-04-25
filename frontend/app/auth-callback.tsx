import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/contexts/AuthContext";
import { api } from "../src/lib/api";
import { colors, fonts, space } from "../src/theme";

export default function AuthCallback() {
  const router = useRouter();
  const { loginWithToken } = useAuth();
  const processed = useRef(false);
  const [error, setError] = React.useState<string | null>(null);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    (async () => {
      try {
        // Web only: parse #session_id from URL hash
        if (typeof window === "undefined") {
          router.replace("/login");
          return;
        }
        const hash = window.location.hash || "";
        const m = hash.match(/[#&]session_id=([^&]+)/);
        if (!m) {
          setError("No session_id in URL");
          setTimeout(() => router.replace("/login"), 1500);
          return;
        }
        const session_id = decodeURIComponent(m[1]);
        // Clean URL fragment so refresh doesn't replay
        window.history.replaceState(null, "", window.location.pathname);
        const res = await api.googleSession(session_id);
        await loginWithToken(res.token, res.user);
        router.replace("/");
      } catch (e: any) {
        setError(e.message || "Sign-in failed");
        setTimeout(() => router.replace("/login"), 2000);
      }
    })();
  }, [loginWithToken, router]);

  return (
    <View style={styles.container} testID="auth-callback-screen">
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.text}>
        {error ? error : "Signing you in..."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
  },
  text: { color: colors.textSecondary, fontFamily: fonts.body },
});
