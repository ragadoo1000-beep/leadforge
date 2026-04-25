import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Linking,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/lib/api";
import { colors, fonts, radii, space } from "../../src/theme";

const STATUSES = ["new", "saved", "contacted", "replied", "closed"] as const;

export default function LeadDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [savingStatus, setSavingStatus] = useState<string | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);

  const load = useCallback(async () => {
    try {
      const l = await api.getLead(String(id));
      setLead(l);
      setNotes(l.my_notes || "");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not load lead");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (status: string) => {
    setSavingStatus(status);
    try {
      await api.saveUserLead({ lead_id: String(id), status });
      setLead((l: any) => ({ ...l, my_status: status }));
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSavingStatus(null);
    }
  };

  const [verifying, setVerifying] = useState(false);
  const [marking, setMarking] = useState(false);

  const runVerification = async () => {
    setVerifying(true);
    try {
      const updated = await api.verifyLead(String(id));
      setLead(updated);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const toggleVerified = async () => {
    setMarking(true);
    try {
      const res = await api.toggleVerifiedFlag(String(id));
      setLead((l: any) => ({
        ...l,
        i_verified: res.i_verified,
        verified_count: res.verified_count,
      }));
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setMarking(false);
    }
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await api.saveUserLead({
        lead_id: String(id),
        status: lead?.my_status || "saved",
        notes,
      });
      Alert.alert("Saved", "Notes updated");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSavingNotes(false);
    }
  };

  if (loading || !lead) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const intentColor =
    lead.intent === "High" ? colors.success : lead.intent === "Medium" ? colors.warning : colors.textTertiary;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.subreddit}>r/{lead.subreddit}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }}>
        <View style={styles.scoreRow}>
          <View>
            <Text style={styles.scoreLabel}>LEAD SCORE</Text>
            <Text style={[styles.score, { color: intentColor }]} testID="detail-score">
              {lead.score}
              <Text style={styles.scoreSlash}>/100</Text>
            </Text>
          </View>
          <View style={[styles.intentBox, { borderColor: intentColor }]}>
            <Text style={[styles.intentText, { color: intentColor }]}>{lead.intent.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.title} testID="detail-title">{lead.title}</Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>AI SUMMARY</Text>
          <Text style={styles.summaryText}>{lead.summary}</Text>
        </View>

        {/* ============ Verification Panel ============ */}
        <Text style={styles.sectionLabel}>VERIFICATION</Text>
        <View style={styles.verifyBox} testID="verification-panel">
          {/* Spam / Trust Score (always available) */}
          <View style={styles.verifyRow}>
            <View style={styles.verifyIcon}>
              <Ionicons
                name={(lead.spam_score ?? 0) >= 70 ? "shield-checkmark" : (lead.spam_score ?? 0) >= 40 ? "shield-outline" : "warning"}
                size={18}
                color={
                  (lead.spam_score ?? 0) >= 70
                    ? colors.success
                    : (lead.spam_score ?? 0) >= 40
                    ? colors.warning
                    : colors.error
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.verifyTitle}>AI Trust Score</Text>
              <Text style={styles.verifySub}>
                {lead.spam_score ?? 60}/100
                {lead.spam_flags?.length
                  ? ` · ${(lead.spam_flags as string[]).slice(0, 3).join(", ")}`
                  : ""}
              </Text>
            </View>
          </View>

          {/* Poster Reputation */}
          <View style={styles.verifyRow}>
            <View style={styles.verifyIcon}>
              <Ionicons
                name={lead.poster_trust ? "person-circle" : "person-outline"}
                size={18}
                color={
                  lead.poster_trust
                    ? lead.poster_trust.score >= 70
                      ? colors.success
                      : lead.poster_trust.score >= 40
                      ? colors.warning
                      : colors.error
                    : colors.textTertiary
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.verifyTitle}>
                Poster: u/{lead.author}
              </Text>
              <Text style={styles.verifySub}>
                {lead.poster_trust
                  ? `${lead.poster_trust.label} · ${lead.poster_profile?.karma ?? 0} karma · ${
                      lead.poster_profile?.age_days ?? 0
                    }d old${lead.poster_profile?.source === "demo" ? " (demo)" : ""}`
                  : "Tap Verify to check reputation"}
              </Text>
            </View>
          </View>

          {/* Freshness */}
          <View style={styles.verifyRow}>
            <View style={styles.verifyIcon}>
              <Ionicons
                name={
                  lead.freshness ? (lead.freshness.alive ? "checkmark-circle" : "close-circle") : "time-outline"
                }
                size={18}
                color={
                  lead.freshness
                    ? lead.freshness.alive
                      ? colors.success
                      : colors.error
                    : colors.textTertiary
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.verifyTitle}>Post Freshness</Text>
              <Text style={styles.verifySub}>
                {lead.freshness
                  ? lead.freshness.alive
                    ? `Live${lead.freshness.source === "demo" ? " (demo)" : ""}`
                    : "Removed or unreachable"
                  : "Tap Verify to check"}
              </Text>
            </View>
          </View>

          {/* Community verified count */}
          <View style={styles.verifyRow}>
            <View style={styles.verifyIcon}>
              <Ionicons
                name={(lead.verified_count ?? 0) > 0 ? "people" : "people-outline"}
                size={18}
                color={(lead.verified_count ?? 0) > 0 ? colors.primary : colors.textTertiary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.verifyTitle}>Community-Verified</Text>
              <Text style={styles.verifySub}>
                {lead.verified_count ?? 0} freelancer
                {(lead.verified_count ?? 0) === 1 ? "" : "s"} confirmed legit
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.sm }}>
            <TouchableOpacity
              testID="run-verification-btn"
              style={[styles.verifyBtn, verifying && { opacity: 0.7 }]}
              onPress={runVerification}
              disabled={verifying}
              activeOpacity={0.8}
            >
              {verifying ? (
                <ActivityIndicator color={colors.textPrimary} size="small" />
              ) : (
                <>
                  <Ionicons name="scan-outline" size={14} color={colors.textPrimary} />
                  <Text style={styles.verifyBtnText}>RUN CHECK</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              testID="mark-verified-btn"
              style={[
                styles.verifyBtn,
                lead.i_verified && { borderColor: colors.primary, backgroundColor: "rgba(255,92,0,0.15)" },
                marking && { opacity: 0.7 },
              ]}
              onPress={toggleVerified}
              disabled={marking}
              activeOpacity={0.8}
            >
              <Ionicons
                name={lead.i_verified ? "checkmark-done" : "thumbs-up-outline"}
                size={14}
                color={lead.i_verified ? colors.primary : colors.textPrimary}
              />
              <Text style={[styles.verifyBtnText, lead.i_verified && { color: colors.primary }]}>
                {lead.i_verified ? "VERIFIED" : "MARK LEGIT"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionLabel}>FULL POST</Text>
        <Text style={styles.postBody}>{lead.content || "(No body provided.)"}</Text>

        <TouchableOpacity
          testID="open-reddit-btn"
          style={styles.linkBtn}
          onPress={() => Linking.openURL(lead.url)}
          activeOpacity={0.7}
        >
          <Ionicons name="open-outline" size={16} color={colors.textPrimary} />
          <Text style={styles.linkText}>VIEW ON REDDIT</Text>
        </TouchableOpacity>

        <View style={{ height: space.lg }} />
        <TouchableOpacity
          testID="generate-message-btn"
          style={styles.primaryBtn}
          onPress={() => router.push(`/message/${lead.id}`)}
          activeOpacity={0.8}
        >
          <Ionicons name="sparkles" size={18} color="#fff" />
          <Text style={styles.primaryText}>GENERATE AI MESSAGE</Text>
        </TouchableOpacity>

        <View style={{ height: space.lg }} />
        <Text style={styles.sectionLabel}>PIPELINE STATUS</Text>
        <View style={styles.statusRow}>
          {STATUSES.map((s) => {
            const active = lead.my_status === s;
            return (
              <TouchableOpacity
                key={s}
                testID={`status-${s}`}
                style={[styles.statusChip, active && { borderColor: colors.primary, backgroundColor: "rgba(255,92,0,0.15)" }]}
                onPress={() => updateStatus(s)}
                disabled={savingStatus !== null}
                activeOpacity={0.8}
              >
                <Text style={[styles.statusText, active && { color: colors.primary }]}>
                  {savingStatus === s ? "..." : s.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: space.lg }} />
        <Text style={styles.sectionLabel}>NOTES</Text>
        <TextInput
          testID="notes-input"
          value={notes}
          onChangeText={setNotes}
          placeholder="Private notes about this lead..."
          placeholderTextColor={colors.textTertiary}
          multiline
          style={[styles.input, { minHeight: 90, textAlignVertical: "top" }]}
        />
        <TouchableOpacity
          testID="save-notes-btn"
          style={styles.secondaryBtn}
          onPress={saveNotes}
          disabled={savingNotes}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryText}>{savingNotes ? "SAVING..." : "SAVE NOTES"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: space.md, paddingVertical: space.sm,
    borderBottomColor: colors.border, borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  subreddit: { fontFamily: fonts.monoBold, fontSize: 12, color: colors.textSecondary, letterSpacing: 1 },
  scoreRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  scoreLabel: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.textTertiary, letterSpacing: 1.5 },
  score: { fontFamily: fonts.monoBold, fontSize: 48, lineHeight: 52, marginTop: 4 },
  scoreSlash: { fontSize: 18, color: colors.textTertiary },
  intentBox: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radii.md, borderWidth: 1 },
  intentText: { fontFamily: fonts.monoBold, fontSize: 12, letterSpacing: 1.5 },
  title: { fontFamily: fonts.heading, fontSize: 22, color: colors.textPrimary, marginTop: space.lg, lineHeight: 28 },
  summaryBox: {
    marginTop: space.lg, padding: space.md,
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.md,
  },
  summaryLabel: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.primary, letterSpacing: 1.5 },
  summaryText: { fontFamily: fonts.body, fontSize: 14, color: colors.textPrimary, marginTop: 6, lineHeight: 20 },
  sectionLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textTertiary, letterSpacing: 1.5, marginTop: space.lg, marginBottom: space.sm },
  postBody: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
  linkBtn: {
    marginTop: space.md, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: space.sm, paddingVertical: 12,
    borderColor: colors.border, borderWidth: 1, borderRadius: radii.md,
  },
  linkText: { color: colors.textPrimary, fontFamily: fonts.bodySemi, fontSize: 12, letterSpacing: 1.5 },
  primaryBtn: {
    backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm,
  },
  primaryText: { color: "#fff", fontFamily: fonts.bodySemi, fontSize: 14, letterSpacing: 1.5 },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  statusChip: {
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.md,
  },
  statusText: { fontFamily: fonts.monoBold, fontSize: 10, color: colors.textSecondary, letterSpacing: 1 },
  input: {
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.md,
    paddingHorizontal: space.md, paddingVertical: 12, color: colors.textPrimary,
    fontFamily: fonts.body, fontSize: 14,
  },
  secondaryBtn: {
    marginTop: space.sm, paddingVertical: 12, alignItems: "center",
    borderColor: colors.border, borderWidth: 1, borderRadius: radii.md,
  },
  secondaryText: { color: colors.textPrimary, fontFamily: fonts.bodySemi, fontSize: 12, letterSpacing: 1.5 },
  verifyBox: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: space.md,
    gap: space.sm,
  },
  verifyRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  verifyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  verifyTitle: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textPrimary },
  verifySub: { fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  verifyBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceElevated,
  },
  verifyBtnText: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.textPrimary, letterSpacing: 1 },
});
