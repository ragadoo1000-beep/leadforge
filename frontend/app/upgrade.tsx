import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ImageBackground,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/lib/api";
import { useAuth } from "../src/contexts/AuthContext";
import { colors, fonts, radii, space } from "../src/theme";

const FEATURES = [
  { icon: "infinite", title: "Unlimited Leads", sub: "Free tier capped at 10/day. Unlock the firehose." },
  { icon: "chatbubbles", title: "Unlimited AI Messages", sub: "Free tier: 5/day. Premium: as many as you can send." },
  { icon: "trending-up", title: "Advanced Lead Scoring", sub: "Deeper qualification with budget & urgency signals." },
  { icon: "flash", title: "Real-Time Updates", sub: "New leads as soon as they hit Reddit." },
  { icon: "stats-chart", title: "CRM & Analytics", sub: "Track every touchpoint, conversion, and reply." },
];

export default function UpgradeScreen() {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      await api.togglePremium();
      await refresh();
    } catch {}
    setBusy(false);
  };

  const isPremium = !!user?.is_premium;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ImageBackground
        source={{
          uri: "https://images.unsplash.com/photo-1770745560263-a8fc696de90b?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzV8MHwxfHNlYXJjaHwyfHxkYXJrJTIwYWJzdHJhY3QlMjB0ZXh0dXJlfGVufDB8fHx8MTc3NzA2NDIxNXww&ixlib=rb-4.1.0&q=85",
        }}
        style={styles.bg}
        resizeMode="cover"
      >
        <View style={styles.overlay} />
        <View style={styles.headerRow}>
          <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="close" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}>
          <Text style={styles.overline}>LEADFORGE PREMIUM</Text>
          <Text style={styles.title}>Forge faster.</Text>
          <Text style={styles.title2}>Close more.</Text>

          <View style={{ height: space.xl }} />
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.row}>
              <View style={styles.iconBox}>
                <Ionicons name={f.icon as any} size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{f.title}</Text>
                <Text style={styles.rowSub}>{f.sub}</Text>
              </View>
            </View>
          ))}

          <View style={{ height: space.xl }} />
          <View style={styles.priceBox}>
            <Text style={styles.priceLabel}>MVP DEMO MODE</Text>
            <Text style={styles.priceText}>Free toggle</Text>
            <Text style={styles.priceSub}>Real Stripe billing coming soon.</Text>
          </View>

          <TouchableOpacity
            testID="toggle-premium-btn"
            style={[styles.cta, busy && { opacity: 0.7 }]}
            onPress={toggle}
            disabled={busy}
            activeOpacity={0.8}
          >
            <Text style={styles.ctaText}>
              {isPremium ? "DEACTIVATE PREMIUM" : "ACTIVATE PREMIUM"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  bg: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10,10,10,0.85)" },
  headerRow: { flexDirection: "row", justifyContent: "flex-end", padding: space.md },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  overline: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.primary, letterSpacing: 3 },
  title: { fontFamily: fonts.heading, fontSize: 40, color: colors.textPrimary, lineHeight: 44, marginTop: space.sm },
  title2: { fontFamily: fonts.heading, fontSize: 40, color: colors.primary, lineHeight: 44 },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.md, marginBottom: space.sm },
  iconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,92,0,0.15)", alignItems: "center", justifyContent: "center" },
  rowTitle: { fontFamily: fonts.headingMedium, fontSize: 15, color: colors.textPrimary },
  rowSub: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  priceBox: { padding: space.lg, backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: 1, borderRadius: radii.md, alignItems: "center" },
  priceLabel: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.primary, letterSpacing: 2 },
  priceText: { fontFamily: fonts.heading, fontSize: 32, color: colors.textPrimary, marginTop: 4 },
  priceSub: { fontFamily: fonts.body, fontSize: 12, color: colors.textTertiary, marginTop: 4 },
  cta: { marginTop: space.lg, backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: 16, alignItems: "center" },
  ctaText: { fontFamily: fonts.bodySemi, color: "#fff", fontSize: 14, letterSpacing: 1.5 },
});
