import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/lib/api";
import { colors, fonts, radii, space } from "../../src/theme";

const TABS = ["new", "saved", "contacted", "replied", "closed"] as const;
type TabKey = (typeof TABS)[number];

export default function CRMScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("saved");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.listUserLeads();
      setItems(res.user_leads || []);
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = items.filter((i) => i.my_status === tab);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.overline}>CRM</Text>
        <Text style={styles.title}>Pipeline</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
      >
        {TABS.map((t) => {
          const count = items.filter((i) => i.my_status === t).length;
          const active = tab === t;
          return (
            <TouchableOpacity
              key={t}
              testID={`crm-tab-${t}`}
              onPress={() => setTab(t)}
              style={[styles.tab, active && styles.tabActive]}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {t.toUpperCase()}
              </Text>
              <Text style={[styles.tabCount, active && styles.tabCountActive]}>
                {count}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="folder-open-outline" size={36} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>No leads in {tab}</Text>
          <Text style={styles.emptySub}>Save leads from the Feed to start tracking.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: space.md, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`crm-lead-${item.id}`}
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => router.push(`/lead/${item.id}`)}
            >
              <View style={styles.cardTop}>
                <Text style={styles.subreddit}>r/{item.subreddit}</Text>
                <Text style={styles.scoreText}>{item.score}/100</Text>
              </View>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.title}
              </Text>
              {item.my_notes ? (
                <Text style={styles.notes} numberOfLines={2}>
                  ✎ {item.my_notes}
                </Text>
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { padding: space.lg, paddingBottom: space.sm },
  overline: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.primary, letterSpacing: 2 },
  title: { fontFamily: fonts.heading, fontSize: 28, color: colors.textPrimary, marginTop: 4 },
  tabsRow: { paddingHorizontal: space.lg, gap: space.xs, paddingVertical: space.sm },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginRight: 8,
  },
  tabActive: { borderColor: colors.primary, backgroundColor: colors.surfaceElevated },
  tabText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textTertiary, letterSpacing: 1 },
  tabTextActive: { color: colors.textPrimary },
  tabCount: {
    fontFamily: fonts.monoBold,
    fontSize: 11,
    color: colors.textTertiary,
    backgroundColor: colors.background,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tabCountActive: { color: colors.primary },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl },
  emptyTitle: { fontFamily: fonts.headingMedium, fontSize: 16, color: colors.textPrimary, marginTop: space.md },
  emptySub: { fontFamily: fonts.body, color: colors.textSecondary, marginTop: 4, textAlign: "center" },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.md, padding: space.md },
  cardTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: space.sm },
  subreddit: { fontFamily: fonts.monoBold, fontSize: 11, color: colors.textTertiary, letterSpacing: 1 },
  scoreText: { fontFamily: fonts.monoBold, fontSize: 12, color: colors.success },
  cardTitle: { fontFamily: fonts.headingMedium, fontSize: 15, color: colors.textPrimary, lineHeight: 21 },
  notes: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: space.sm, fontStyle: "italic" },
});
