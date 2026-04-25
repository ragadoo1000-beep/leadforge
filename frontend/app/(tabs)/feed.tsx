import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { api } from "../../src/lib/api";
import { useAuth } from "../../src/contexts/AuthContext";
import { colors, fonts, radii, space } from "../../src/theme";

type Lead = {
  id: string;
  title: string;
  summary: string;
  subreddit: string;
  score: number;
  intent: "High" | "Medium" | "Low";
  timestamp: string;
  my_status?: string | null;
};

function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return `${Math.floor(d)}s`;
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 75 ? colors.success : score >= 50 ? colors.warning : colors.textTertiary;
  return (
    <View style={[styles.scoreBadge, { borderColor: color }]} testID="lead-score-badge">
      <Text style={[styles.scoreText, { color }]}>
        {score}
        <Text style={styles.scoreSlash}>/100</Text>
      </Text>
    </View>
  );
}

function IntentPill({ intent }: { intent: string }) {
  const styleMap: Record<string, any> = {
    High: { bg: colors.successBg, text: colors.success, border: "rgba(16,185,129,0.3)" },
    Medium: { bg: colors.warningBg, text: colors.warning, border: "rgba(245,158,11,0.3)" },
    Low: { bg: colors.surface, text: colors.textTertiary, border: colors.border },
  };
  const s = styleMap[intent] || styleMap.Low;
  return (
    <View
      style={[styles.pill, { backgroundColor: s.bg, borderColor: s.border }]}
      testID="lead-intent-pill"
    >
      <Text style={[styles.pillText, { color: s.text }]}>{intent.toUpperCase()}</Text>
    </View>
  );
}

export default function FeedScreen() {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<{ leads_today: number; messages_today: number } | null>(null);
  const [limitMsg, setLimitMsg] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
    try {
      const res = await api.getFeed();
      setLeads(res.leads || []);
    } catch {}
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const s = await api.myStats();
      setStats({ leads_today: s.leads_today, messages_today: s.messages_today });
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      await loadFeed();
      await loadStats();
      setLoading(false);
    })();
  }, [loadFeed, loadStats]);

  const handleFetchNew = async () => {
    setFetching(true);
    setLimitMsg(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const res = await api.fetchLeads();
      if (res.limit_reached) {
        setLimitMsg("Daily lead limit reached. Upgrade for unlimited.");
      } else if ((res.new_count || 0) === 0) {
        setLimitMsg("No new leads matched your filters. Try again later.");
      }
      await loadFeed();
      await loadStats();
      await refresh();
    } catch (e: any) {
      setLimitMsg(e.message || "Failed to fetch leads");
    } finally {
      setFetching(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFeed();
    await loadStats();
    setRefreshing(false);
  };

  const isPremium = user?.is_premium;
  const dailyCap = isPremium ? 1000 : 10;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.overline}>LEAD FEED</Text>
          <Text style={styles.headerTitle}>Hunt mode</Text>
        </View>
        <View style={styles.streakBox} testID="streak-box">
          <Ionicons name="flame" size={14} color={colors.primary} />
          <Text style={styles.streakText}>{user?.streak ?? 0}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>LEADS TODAY</Text>
          <Text style={styles.statVal} testID="leads-today-count">
            {stats?.leads_today ?? 0}
            <Text style={styles.statCap}>/{dailyCap}</Text>
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>MESSAGES</Text>
          <Text style={styles.statVal} testID="messages-today-count">
            {stats?.messages_today ?? 0}
            <Text style={styles.statCap}>/{isPremium ? 1000 : 5}</Text>
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>XP</Text>
          <Text style={styles.statVal} testID="xp-count">{user?.xp ?? 0}</Text>
        </View>
      </View>

      <TouchableOpacity
        testID="fetch-leads-btn"
        style={[styles.fetchBtn, fetching && { opacity: 0.7 }]}
        onPress={handleFetchNew}
        disabled={fetching}
        activeOpacity={0.8}
      >
        {fetching ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="flash" size={16} color="#fff" />
            <Text style={styles.fetchBtnText}>FORGE NEW LEADS</Text>
          </>
        )}
      </TouchableOpacity>

      {limitMsg && (
        <Text style={styles.limitMsg} testID="limit-msg">
          {limitMsg}
        </Text>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : leads.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="search-outline" size={40} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>No leads yet</Text>
          <Text style={styles.emptySub}>Tap "Forge New Leads" to scan Reddit.</Text>
        </View>
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: space.md, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`lead-card-${item.id}`}
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => router.push(`/lead/${item.id}`)}
            >
              <View style={styles.cardTop}>
                <Text style={styles.subreddit}>r/{item.subreddit}</Text>
                <ScoreBadge score={item.score} />
              </View>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.cardSummary} numberOfLines={2}>
                {item.summary}
              </Text>
              <View style={styles.cardFooter}>
                <IntentPill intent={item.intent} />
                <Text style={styles.timeText}>{timeAgo(item.timestamp)} ago</Text>
                {item.my_status && (
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{item.my_status.toUpperCase()}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  overline: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.primary, letterSpacing: 2 },
  headerTitle: { fontFamily: fonts.heading, fontSize: 28, color: colors.textPrimary, marginTop: 4 },
  streakBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
  },
  streakText: { color: colors.textPrimary, fontFamily: fonts.monoBold, fontSize: 13 },
  statsRow: { flexDirection: "row", gap: space.sm, paddingHorizontal: space.lg, marginTop: space.sm },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: space.sm,
  },
  statLabel: { fontFamily: fonts.bodyMedium, fontSize: 9, color: colors.textTertiary, letterSpacing: 1.5 },
  statVal: { fontFamily: fonts.monoBold, fontSize: 20, color: colors.textPrimary, marginTop: 2 },
  statCap: { color: colors.textTertiary, fontSize: 12 },
  fetchBtn: {
    margin: space.lg,
    marginBottom: space.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: space.sm,
  },
  fetchBtnText: { color: "#fff", fontFamily: fonts.bodySemi, fontSize: 13, letterSpacing: 1.5 },
  limitMsg: {
    paddingHorizontal: space.lg,
    color: colors.warning,
    fontFamily: fonts.body,
    fontSize: 12,
    marginBottom: space.sm,
  },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl },
  emptyTitle: { fontFamily: fonts.headingMedium, fontSize: 18, color: colors.textPrimary, marginTop: space.md },
  emptySub: { fontFamily: fonts.body, color: colors.textSecondary, marginTop: 4, textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: space.md,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: space.sm },
  subreddit: { fontFamily: fonts.monoBold, fontSize: 11, color: colors.textTertiary, letterSpacing: 1 },
  scoreBadge: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  scoreText: { fontFamily: fonts.monoBold, fontSize: 13 },
  scoreSlash: { fontSize: 10, opacity: 0.6 },
  cardTitle: { fontFamily: fonts.headingMedium, fontSize: 16, color: colors.textPrimary, lineHeight: 22 },
  cardSummary: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: space.xs, lineHeight: 18 },
  cardFooter: { flexDirection: "row", alignItems: "center", marginTop: space.md, gap: space.sm },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderWidth: 1 },
  pillText: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 1 },
  timeText: { fontFamily: fonts.mono, color: colors.textTertiary, fontSize: 11 },
  statusBadge: { marginLeft: "auto", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderWidth: 1, borderColor: colors.info, backgroundColor: colors.infoBg },
  statusText: { fontFamily: fonts.monoBold, fontSize: 9, color: colors.info, letterSpacing: 1 },
});
