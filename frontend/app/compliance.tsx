import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/lib/api";
import { useTheme } from "../src/contexts/ThemeContext";
import { fonts, radii, space, cardShadow } from "../src/theme";
import PressScale from "../src/components/PressScale";

export default function CompliancePage() {
  const { colors, mode } = useTheme();
  const styles = makeStyles(colors, mode);
  const router = useRouter();
  const [policy, setPolicy] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPolicy()
      .then(setPolicy)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !policy) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.headerRow}>
        <PressScale testID="back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </PressScale>
        <Text style={styles.headerTitle}>HOW IT WORKS</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 80 }}>
        <Text style={styles.title}>Built for trust.</Text>
        <Text style={styles.subtitle}>
          You're in control. We don't auto-message anyone. We don't promise income.
        </Text>

        {/* Section: Disclaimer */}
        <View style={[styles.card, { borderColor: colors.warning, backgroundColor: colors.warningBg }]}>
          <View style={styles.iconRow}>
            <Ionicons name="warning-outline" size={18} color={colors.warning} />
            <Text style={[styles.sectionTitle, { color: colors.warning }]}>DISCLAIMER</Text>
          </View>
          <Text style={styles.bodyText}>{policy.disclaimer}</Text>
        </View>

        {/* Core Principles */}
        <View style={styles.card}>
          <View style={styles.iconRow}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>OUR PRINCIPLES</Text>
          </View>
          {policy.principles.map((p: string, i: number) => (
            <View key={i} style={styles.bullet}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={styles.bulletText}>{p}</Text>
            </View>
          ))}
        </View>

        {/* How Reddit Works */}
        <View style={styles.card}>
          <View style={styles.iconRow}>
            <Ionicons name="logo-reddit" size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>HOW WE GET LEADS</Text>
          </View>
          <Text style={styles.bodyText}>{policy.how_reddit_works}</Text>
        </View>

        {/* How AI Works */}
        <View style={styles.card}>
          <View style={styles.iconRow}>
            <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>HOW AI IS USED</Text>
          </View>
          <Text style={styles.bodyText}>{policy.how_ai_works}</Text>
        </View>

        {/* Data Collected */}
        <View style={styles.card}>
          <View style={styles.iconRow}>
            <Ionicons name="server-outline" size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>WHAT WE STORE</Text>
          </View>
          {policy.data_collected.map((d: string, i: number) => (
            <View key={i} style={styles.bullet}>
              <Ionicons name="ellipse" size={6} color={colors.textSecondary} />
              <Text style={styles.bulletText}>{d}</Text>
            </View>
          ))}
          <Text style={[styles.smallLabel, { marginTop: space.md }]}>WHAT WE DON'T STORE</Text>
          {policy.data_not_collected.map((d: string, i: number) => (
            <View key={i} style={styles.bullet}>
              <Ionicons name="close-circle" size={14} color={colors.error} />
              <Text style={styles.bulletText}>{d}</Text>
            </View>
          ))}
        </View>

        {/* User Rights */}
        <View style={styles.card}>
          <View style={styles.iconRow}>
            <Ionicons name="key-outline" size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>YOUR RIGHTS</Text>
          </View>
          {policy.user_rights.map((r: string, i: number) => (
            <View key={i} style={styles.bullet}>
              <Ionicons name="checkmark" size={14} color={colors.success} />
              <Text style={styles.bulletText}>{r}</Text>
            </View>
          ))}
        </View>

        {/* Rate Limits */}
        <View style={styles.card}>
          <View style={styles.iconRow}>
            <Ionicons name="speedometer-outline" size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>RATE LIMITS</Text>
          </View>
          {Object.entries(policy.rate_limits as Record<string, string>).map(([tier, limit]) => (
            <View key={tier} style={styles.kvRow}>
              <Text style={styles.kvKey}>{tier.toUpperCase()}</Text>
              <Text style={styles.kvVal}>{limit}</Text>
            </View>
          ))}
        </View>

        {/* Terms */}
        <View style={styles.card}>
          <View style={styles.iconRow}>
            <Ionicons name="document-text-outline" size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>TERMS SUMMARY</Text>
          </View>
          <Text style={styles.bodyText}>{policy.terms_summary}</Text>
        </View>

        <Text style={styles.footnote}>Version {policy.version} · Questions? {policy.support_email}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: any, mode: "light" | "dark") =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: space.md,
      paddingVertical: space.sm,
      borderBottomColor: c.border,
      borderBottomWidth: 1,
    },
    backBtn: {
      width: 38,
      height: 38,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { fontFamily: fonts.heading, fontSize: 13, color: c.textPrimary, letterSpacing: 3 },
    title: { fontFamily: fonts.heading, fontSize: 28, color: c.textPrimary, lineHeight: 32 },
    subtitle: { fontFamily: fonts.body, fontSize: 13, color: c.textSecondary, marginTop: space.xs, marginBottom: space.lg, lineHeight: 18 },
    card: {
      backgroundColor: c.surface,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: radii.lg,
      padding: space.md,
      marginBottom: space.md,
      ...cardShadow(mode),
    },
    iconRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.sm },
    sectionTitle: { fontFamily: fonts.bodySemi, fontSize: 11, color: c.textPrimary, letterSpacing: 2 },
    smallLabel: { fontFamily: fonts.bodyMedium, fontSize: 10, color: c.textTertiary, letterSpacing: 1.5 },
    bodyText: { fontFamily: fonts.body, fontSize: 13, color: c.textPrimary, lineHeight: 20 },
    bullet: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginVertical: 4, paddingLeft: 4 },
    bulletText: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, color: c.textPrimary, lineHeight: 18 },
    kvRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomColor: c.border, borderBottomWidth: 1 },
    kvKey: { fontFamily: fonts.monoBold, fontSize: 10, color: c.textTertiary, letterSpacing: 1 },
    kvVal: { fontFamily: fonts.body, fontSize: 12, color: c.textPrimary },
    footnote: { fontFamily: fonts.body, fontSize: 11, color: c.textTertiary, textAlign: "center", marginTop: space.md },
  });
