import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/lib/api";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import { fonts, radii, space, cardShadow } from "../../src/theme";

export default function ProfileScreen() {
  const { colors, mode, toggle } = useTheme();
  const styles = makeStyles(colors, mode);
  const { user, logout, refresh } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [leaders, setLeaders] = useState<any[]>([]);
  const [toggling, setToggling] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([api.myStats(), api.leaderboard()]);
      setStats(s);
      setLeaders(l.leaderboard || []);
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

  const handleTogglePremium = async () => {
    setToggling(true);
    try {
      await api.togglePremium();
      await refresh();
      await load();
    } catch {}
    setToggling(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 100 }}>
        <Text style={styles.overline}>PROFILE</Text>
        <View style={styles.headerRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.name?.[0] || "U").toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} testID="profile-name">{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <View style={styles.badges}>
              <View style={[styles.badge, user?.is_premium && { borderColor: colors.primary, backgroundColor: "rgba(255,92,0,0.15)" }]}>
                <Text style={[styles.badgeText, user?.is_premium && { color: colors.primary }]}>
                  {user?.is_premium ? "PREMIUM" : "FREE"}
                </Text>
              </View>
              <View style={styles.badge}>
                <Ionicons name="flame" size={10} color={colors.primary} />
                <Text style={styles.badgeText}>{user?.streak ?? 0} STREAK</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ height: space.lg }} />
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>XP</Text>
            <Text style={styles.statVal} testID="stat-xp">{stats?.xp ?? 0}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>MESSAGES</Text>
            <Text style={styles.statVal}>{stats?.messages_generated ?? 0}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>CONTACTED</Text>
            <Text style={styles.statVal}>{stats?.leads_contacted ?? 0}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>REPLIES</Text>
            <Text style={styles.statVal}>{stats?.replies ?? 0}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>CLOSED</Text>
            <Text style={[styles.statVal, { color: colors.success }]}>{stats?.deals_closed ?? 0}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>STREAK</Text>
            <Text style={styles.statVal}>{stats?.streak ?? 0}</Text>
          </View>
        </View>

        <View style={{ height: space.lg }} />
        <Text style={styles.sectionLabel}>SETTINGS</Text>

        <View style={styles.row}>
          <Ionicons
            name={mode === "dark" ? "moon" : "sunny"}
            size={18}
            color={colors.primary}
            style={{ marginRight: space.sm }}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{mode === "dark" ? "Dark Mode" : "Light Mode"}</Text>
            <Text style={styles.rowSub}>Switch theme</Text>
          </View>
          <Switch
            testID="theme-toggle"
            value={mode === "dark"}
            onValueChange={toggle}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Premium Tier</Text>
            <Text style={styles.rowSub}>Unlimited leads & messages</Text>
          </View>
          <Switch
            testID="premium-toggle"
            value={!!user?.is_premium}
            onValueChange={handleTogglePremium}
            disabled={toggling}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>

        <TouchableOpacity
          testID="upgrade-btn"
          style={styles.row}
          onPress={() => router.push("/upgrade")}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Subscription Plans</Text>
            <Text style={styles.rowSub}>3 tiers · 7-day free trial</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity
          testID="edit-profile-btn"
          style={styles.row}
          onPress={() => router.push("/onboarding")}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Edit Profile & Preferences</Text>
            <Text style={styles.rowSub}>{user?.profession} · {user?.tone_preference}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity
          testID="how-it-works-btn"
          style={styles.row}
          onPress={() => router.push("/compliance")}
          activeOpacity={0.7}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={18}
            color={colors.primary}
            style={{ marginRight: space.sm }}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>How LeadForge Works</Text>
            <Text style={styles.rowSub}>Privacy · Terms · Disclaimer · Data we store</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity
          testID="delete-account-btn"
          style={[styles.row, { borderColor: colors.error }]}
          onPress={() => {
            const confirmDelete = async () => {
              try {
                await api.deleteAccount();
                await logout();
                router.replace("/login");
              } catch (e: any) {
                Alert.alert("Error", e.message || "Could not delete account");
              }
            };
            const message =
              "This permanently removes your account, saved leads, messages, invoices, and cancels any subscription. This cannot be undone.";
            if (Platform.OS === "web") {
              if (typeof window !== "undefined" && window.confirm(message)) {
                confirmDelete();
              }
            } else {
              Alert.alert("Delete Account?", message, [
                { text: "Cancel", style: "cancel" },
                { text: "Delete Forever", style: "destructive", onPress: confirmDelete },
              ]);
            }
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name="trash-outline"
            size={18}
            color={colors.error}
            style={{ marginRight: space.sm }}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.error }]}>Delete Account</Text>
            <Text style={styles.rowSub}>Permanently erase all your data</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.error} />
        </TouchableOpacity>

        <View style={{ height: space.lg }} />
        <Text style={styles.sectionLabel}>LEADERBOARD</Text>
        {leaders.slice(0, 10).map((u, idx) => {
          const isMe = u.id === user?.id;
          return (
            <View
              key={u.id}
              style={[styles.leadRow, isMe && { borderColor: colors.primary }]}
              testID={`leaderboard-row-${idx}`}
            >
              <Text style={styles.leadRank}>#{idx + 1}</Text>
              <Text style={[styles.leadName, isMe && { color: colors.primary }]}>
                {u.name || "Anon"}{isMe ? " (you)" : ""}
              </Text>
              <Text style={styles.leadXp}>{u.xp || 0} XP</Text>
            </View>
          );
        })}

        <View style={{ height: space.lg }} />
        <TouchableOpacity
          testID="logout-btn"
          style={styles.logoutBtn}
          onPress={async () => {
            await logout();
            router.replace("/login");
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutText}>SIGN OUT</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: any, mode: "light" | "dark") => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  overline: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.primary, letterSpacing: 2 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.sm },
  avatar: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.heading, fontSize: 28, color: "#fff" },
  name: { fontFamily: fonts.heading, fontSize: 22, color: colors.textPrimary },
  email: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  badges: { flexDirection: "row", gap: space.xs, marginTop: space.sm },
  badge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface,
    flexDirection: "row", alignItems: "center", gap: 4,
  },
  badgeText: { fontFamily: fonts.monoBold, fontSize: 9, color: colors.textSecondary, letterSpacing: 1 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  statCard: {
    flexBasis: "31%", flexGrow: 1,
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.md, padding: space.sm,
    ...cardShadow(mode),
  },
  statLabel: { fontFamily: fonts.bodyMedium, fontSize: 9, color: colors.textTertiary, letterSpacing: 1.5 },
  statVal: { fontFamily: fonts.monoBold, fontSize: 22, color: colors.textPrimary, marginTop: 4 },
  sectionLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textTertiary, letterSpacing: 1.5, marginBottom: space.sm },
  row: {
    flexDirection: "row", alignItems: "center", padding: space.md,
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.md, marginBottom: space.sm,
    ...cardShadow(mode),
  },
  rowTitle: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.textPrimary },
  rowSub: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  leadRow: {
    flexDirection: "row", alignItems: "center", padding: space.sm,
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.md, marginBottom: 6,
  },
  leadRank: { fontFamily: fonts.monoBold, fontSize: 12, color: colors.textTertiary, width: 32 },
  leadName: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.textPrimary },
  leadXp: { fontFamily: fonts.monoBold, fontSize: 12, color: colors.success },
  logoutBtn: {
    paddingVertical: 14, alignItems: "center",
    borderColor: colors.border, borderWidth: 1, borderRadius: radii.md,
  },
  logoutText: { fontFamily: fonts.bodySemi, color: colors.error, letterSpacing: 1.5, fontSize: 13 },
});
