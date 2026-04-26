import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { api } from "../../src/lib/api";
import { useAuth } from "../../src/contexts/AuthContext";
import { colors, fonts, radii, space } from "../../src/theme";

const TONES = ["Formal", "Casual", "Persuasive"] as const;

export default function MessageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [activeTab, setActiveTab] = useState<"reddit" | "email">("reddit");
  const [tone, setTone] = useState<string>(user?.tone_preference || "Casual");
  const [reddit, setReddit] = useState("");
  const [email, setEmail] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async (toneOverride?: string) => {
    setGenerating(true);
    setError(null);
    try {
      const res = await api.generateMessage(String(id), toneOverride || tone);
      setReddit(res.reddit_dm || "");
      setEmail(res.email || "");
      await refresh();
    } catch (e: any) {
      setError(e.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = async () => {
    const text = activeTab === "reddit" ? reddit : email;
    await Clipboard.setStringAsync(text);
    api.trackEvent("message_copied", { channel: activeTab });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Alert.alert("Copied", "Message copied to clipboard.");
  };

  const handleToneChange = async (t: string) => {
    setTone(t);
    await generate(t);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>AI MESSAGE</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 100 }}>
        <Text style={styles.sectionLabel}>TONE</Text>
        <View style={styles.toneRow}>
          {TONES.map((t) => {
            const active = tone === t;
            return (
              <TouchableOpacity
                key={t}
                testID={`tone-${t.toLowerCase()}`}
                style={[styles.toneChip, active && styles.toneChipActive]}
                onPress={() => handleToneChange(t)}
                disabled={generating}
                activeOpacity={0.8}
              >
                <Text style={[styles.toneText, active && { color: "#fff" }]}>{t}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: space.lg }} />
        <View style={styles.tabRow}>
          <TouchableOpacity
            testID="msg-tab-reddit"
            style={[styles.tabBtn, activeTab === "reddit" && styles.tabBtnActive]}
            onPress={() => setActiveTab("reddit")}
            activeOpacity={0.8}
          >
            <Ionicons name="chatbubble-outline" size={14} color={activeTab === "reddit" ? colors.primary : colors.textTertiary} />
            <Text style={[styles.tabText, activeTab === "reddit" && { color: colors.primary }]}>REDDIT DM</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="msg-tab-email"
            style={[styles.tabBtn, activeTab === "email" && styles.tabBtnActive]}
            onPress={() => setActiveTab("email")}
            activeOpacity={0.8}
          >
            <Ionicons name="mail-outline" size={14} color={activeTab === "email" ? colors.primary : colors.textTertiary} />
            <Text style={[styles.tabText, activeTab === "email" && { color: colors.primary }]}>EMAIL</Text>
          </TouchableOpacity>
        </View>

        {generating ? (
          <View style={styles.genBox}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.genText}>Forging your message...</Text>
          </View>
        ) : error ? (
          <View style={styles.genBox}>
            <Text style={styles.errText} testID="msg-error">{error}</Text>
            <TouchableOpacity onPress={() => generate()} style={styles.retryBtn} testID="retry-btn">
              <Text style={styles.retryText}>RETRY</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TextInput
              testID="msg-textarea"
              value={activeTab === "reddit" ? reddit : email}
              onChangeText={(v) => (activeTab === "reddit" ? setReddit(v) : setEmail(v))}
              multiline
              style={styles.msgArea}
              placeholderTextColor={colors.textTertiary}
            />
            <View style={styles.actions}>
              <TouchableOpacity
                testID="regenerate-btn"
                style={styles.secondaryBtn}
                onPress={() => generate()}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={14} color={colors.textPrimary} />
                <Text style={styles.secondaryText}>REGENERATE</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="copy-btn"
                style={styles.primaryBtn}
                onPress={copy}
                activeOpacity={0.8}
              >
                <Ionicons name="copy-outline" size={14} color="#fff" />
                <Text style={styles.primaryText}>COPY</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.tip}>
              💡 Tip: Edit before sending. Personal touches outperform AI-perfect copy.
            </Text>
            <View style={styles.complianceBanner} testID="manual-send-banner">
              <Ionicons name="hand-left-outline" size={14} color={colors.warning} />
              <Text style={styles.complianceText}>
                You must initiate this outreach manually. LeadForge never sends messages on your behalf.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: space.md, paddingVertical: space.sm,
    borderBottomColor: colors.border, borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.heading, fontSize: 14, color: colors.textPrimary, letterSpacing: 3 },
  sectionLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textTertiary, letterSpacing: 1.5, marginBottom: space.sm },
  toneRow: { flexDirection: "row", gap: space.sm },
  toneChip: {
    flex: 1, paddingVertical: 10, alignItems: "center",
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.md,
  },
  toneChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  toneText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textSecondary },
  tabRow: { flexDirection: "row", gap: space.sm, marginBottom: space.md },
  tabBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10,
    borderColor: colors.border, borderWidth: 1, borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  tabBtnActive: { borderColor: colors.primary },
  tabText: { fontFamily: fonts.monoBold, fontSize: 11, color: colors.textTertiary, letterSpacing: 1 },
  msgArea: {
    minHeight: 220, padding: space.md,
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.md,
    color: colors.textPrimary, fontFamily: fonts.body, fontSize: 14, lineHeight: 22,
    textAlignVertical: "top",
  },
  actions: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  secondaryBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 12, borderColor: colors.border, borderWidth: 1, borderRadius: radii.md,
  },
  secondaryText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textPrimary, letterSpacing: 1.5 },
  primaryBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 12, backgroundColor: colors.primary, borderRadius: radii.md,
  },
  primaryText: { fontFamily: fonts.bodySemi, fontSize: 12, color: "#fff", letterSpacing: 1.5 },
  tip: { marginTop: space.md, fontFamily: fonts.body, fontSize: 12, color: colors.textTertiary, lineHeight: 18 },
  complianceBanner: {
    marginTop: space.md,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.sm,
    backgroundColor: colors.warningBg,
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: radii.md,
  },
  complianceText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.warning,
    lineHeight: 15,
  },
  genBox: { padding: space.xl, alignItems: "center", gap: space.md, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.md },
  genText: { fontFamily: fonts.body, color: colors.textSecondary },
  errText: { color: colors.error, fontFamily: fonts.body, textAlign: "center" },
  retryBtn: { paddingHorizontal: space.lg, paddingVertical: 10, backgroundColor: colors.primary, borderRadius: radii.md },
  retryText: { color: "#fff", fontFamily: fonts.bodySemi, letterSpacing: 1.5 },
});
