import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { api } from "../src/lib/api";
import { useAuth } from "../src/contexts/AuthContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { fonts, radii, space, cardShadow } from "../src/theme";
import PressScale from "../src/components/PressScale";

type Plan = {
  id: "minimum" | "professional" | "expert";
  name: string;
  tagline: string;
  monthly_inr: number;
  annual_inr: number;
  features: string[];
};

export default function UpgradeScreen() {
  const { colors, mode } = useTheme();
  const { user, refresh } = useAuth();
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [period, setPeriod] = useState<"monthly" | "annual">("monthly");
  const [selected, setSelected] = useState<Plan["id"]>("professional");
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [trialDays, setTrialDays] = useState(7);
  const [billing, setBilling] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const [p, b] = await Promise.all([api.billingPlans(), api.billingMe()]);
        setPlans(p.plans || []);
        setTrialDays(p.trial_days || 7);
        setBilling(b);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const handleSubscribe = async () => {
    if (subscribing) return;
    setSubscribing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const res = await api.createSubscription(selected, period);
      if (res.demo_mode) {
        Alert.alert(
          "Trial Activated",
          `Your ${TIER_NAMES[selected]} plan trial is live. ${trialDays} days free, no charge.\n\n(Razorpay keys not yet configured — running in demo mode.)`,
          [{ text: "Awesome", onPress: () => router.replace("/(tabs)/feed") }]
        );
        await refresh();
      } else if (res.short_url) {
        // Open Razorpay checkout
        const url = res.short_url as string;
        const callbackUrl = `${process.env.EXPO_PUBLIC_BACKEND_URL}/auth-callback`;
        if (Platform.OS === "web") {
          window.location.href = url;
          return;
        }
        await WebBrowser.openAuthSessionAsync(url, callbackUrl);
        await refresh();
        Alert.alert(
          "Almost there",
          "Once your card is authorized, your trial activates automatically. Check the Profile tab for status."
        );
        router.replace("/(tabs)/profile");
      } else {
        Alert.alert("Error", "Could not start subscription.");
      }
    } catch (e: any) {
      Alert.alert("Subscription Failed", e.message || "Try again later.");
    } finally {
      setSubscribing(false);
    }
  };

  const handleCancel = () => {
    Alert.alert("Cancel Subscription", "Are you sure? You'll lose premium access at the end of your trial.", [
      { text: "Keep Plan", style: "cancel" },
      {
        text: "Cancel Plan",
        style: "destructive",
        onPress: async () => {
          try {
            await api.cancelSubscription();
            await refresh();
            Alert.alert("Cancelled", "Your subscription has been cancelled.");
          } catch (e: any) {
            Alert.alert("Error", e.message);
          }
        },
      },
    ]);
  };

  const styles = makeStyles(colors, mode);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const isActive = billing?.subscription_status === "trial" || billing?.subscription_status === "active";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <PressScale
            testID="back-btn"
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Ionicons name="close" size={20} color={colors.textPrimary} />
          </PressScale>
        </View>

        <Animated.View entering={FadeInDown.duration(400)}>
          <Text style={styles.overline}>UNLOCK LEADFORGE</Text>
          <Text style={styles.title}>Forge faster.</Text>
          <Text style={[styles.title, { color: colors.primary }]}>Win more deals.</Text>
          <Text style={styles.subtitle}>
            7-day free trial · Cancel anytime · Pay in INR or USD
          </Text>
        </Animated.View>

        {isActive && (
          <Animated.View entering={FadeIn.duration(300).delay(100)} style={styles.activeBanner}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.activeTitle}>
                {billing?.plan_tier ? TIER_NAMES[billing.plan_tier as Plan["id"]] : "Plan"} —{" "}
                {(billing?.subscription_status || "").toUpperCase()}
              </Text>
              <Text style={styles.activeSub}>
                {billing?.trial_ends_at
                  ? `Trial until ${new Date(billing.trial_ends_at).toLocaleDateString()}`
                  : "Active"}
              </Text>
            </View>
            <PressScale testID="cancel-btn" onPress={handleCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </PressScale>
          </Animated.View>
        )}

        {/* Period toggle */}
        <View style={styles.periodToggle}>
          <PressScale
            testID="period-monthly"
            onPress={() => setPeriod("monthly")}
            style={[styles.periodBtn, period === "monthly" && styles.periodBtnActive]}
          >
            <Text style={[styles.periodText, period === "monthly" && styles.periodTextActive]}>
              Monthly
            </Text>
          </PressScale>
          <PressScale
            testID="period-annual"
            onPress={() => setPeriod("annual")}
            style={[styles.periodBtn, period === "annual" && styles.periodBtnActive]}
          >
            <Text style={[styles.periodText, period === "annual" && styles.periodTextActive]}>
              Annual
            </Text>
            <View style={styles.saveBadge}>
              <Text style={styles.saveText}>SAVE 20%</Text>
            </View>
          </PressScale>
        </View>

        {/* Plan cards */}
        {plans.map((plan, idx) => {
          const active = selected === plan.id;
          const price = period === "monthly" ? plan.monthly_inr : plan.annual_inr;
          const perUnit = period === "monthly" ? "/mo" : "/yr";
          const recommended = plan.id === "professional";
          return (
            <Animated.View
              key={plan.id}
              entering={FadeInDown.duration(400).delay(150 + idx * 80)}
            >
              <PressScale
                testID={`plan-${plan.id}`}
                onPress={() => setSelected(plan.id)}
                style={[styles.planCard, active && styles.planCardActive]}
                scaleTo={0.985}
              >
                {recommended && (
                  <View style={styles.recommendBadge}>
                    <Text style={styles.recommendText}>MOST POPULAR</Text>
                  </View>
                )}
                <View style={styles.planHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.planName, active && { color: colors.primary }]}>{plan.name}</Text>
                    <Text style={styles.planTagline}>{plan.tagline}</Text>
                  </View>
                  <View
                    style={[styles.radio, active && { borderColor: colors.primary, backgroundColor: colors.primary }]}
                  >
                    {active && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                </View>

                <View style={styles.priceRow}>
                  <Text style={styles.currency}>₹</Text>
                  <Text style={styles.price}>{price.toLocaleString("en-IN")}</Text>
                  <Text style={styles.perUnit}>{perUnit}</Text>
                </View>
                {period === "annual" && (
                  <Text style={styles.equivalent}>
                    ≈ ₹{Math.round(price / 12).toLocaleString("en-IN")}/mo
                  </Text>
                )}

                <View style={styles.featureList}>
                  {plan.features.map((f) => (
                    <View key={f} style={styles.featureRow}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={active ? colors.primary : colors.success}
                      />
                      <Text style={styles.featureText}>{f}</Text>
                    </View>
                  ))}
                </View>
              </PressScale>
            </Animated.View>
          );
        })}

        <Animated.View entering={FadeInDown.duration(400).delay(420)}>
          <PressScale
            testID="subscribe-btn"
            onPress={handleSubscribe}
            disabled={subscribing}
            style={[styles.cta, subscribing && { opacity: 0.7 }]}
          >
            {subscribing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="flash" size={18} color="#fff" />
                <Text style={styles.ctaText}>
                  START {trialDays}-DAY FREE TRIAL
                </Text>
              </>
            )}
          </PressScale>
          <Text style={styles.fineprint}>
            No charge for {trialDays} days. Cancel anytime in Profile. After trial: ₹
            {(period === "monthly" ? plans.find((p) => p.id === selected)?.monthly_inr : plans.find((p) => p.id === selected)?.annual_inr) || 0}
            {period === "monthly" ? "/month" : "/year"} until you cancel.
          </Text>

          <View style={styles.paymentLogos}>
            <View style={styles.payLogo}><Text style={styles.payLogoText}>UPI</Text></View>
            <View style={styles.payLogo}><Text style={styles.payLogoText}>VISA</Text></View>
            <View style={styles.payLogo}><Text style={styles.payLogoText}>MASTERCARD</Text></View>
            <View style={styles.payLogo}><Text style={styles.payLogoText}>RUPAY</Text></View>
            <View style={styles.payLogo}><Text style={styles.payLogoText}>NETBANKING</Text></View>
          </View>
          <Text style={styles.secured}>🔒 Secured by Razorpay · SSL encrypted</Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const TIER_NAMES: Record<Plan["id"], string> = {
  minimum: "Minimum",
  professional: "Professional",
  expert: "Expert",
};

const makeStyles = (c: any, mode: "light" | "dark") =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    headerRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: space.md },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: c.surface,
      borderColor: c.border,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    overline: { fontFamily: fonts.bodyMedium, fontSize: 11, color: c.primary, letterSpacing: 2.5 },
    title: { fontFamily: fonts.heading, fontSize: 36, color: c.textPrimary, lineHeight: 42, marginTop: space.xs },
    subtitle: { fontFamily: fonts.body, fontSize: 14, color: c.textSecondary, marginTop: space.sm, marginBottom: space.lg },

    activeBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      padding: space.md,
      borderRadius: radii.md,
      backgroundColor: c.successBg,
      borderColor: c.success,
      borderWidth: 1,
      marginBottom: space.md,
    },
    activeTitle: { fontFamily: fonts.bodySemi, fontSize: 13, color: c.textPrimary },
    activeSub: { fontFamily: fonts.body, fontSize: 11, color: c.textSecondary, marginTop: 2 },
    cancelText: { fontFamily: fonts.bodySemi, color: c.error, fontSize: 12 },

    periodToggle: {
      flexDirection: "row",
      backgroundColor: c.surface,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: radii.pill,
      padding: 4,
      marginBottom: space.lg,
    },
    periodBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: radii.pill,
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      gap: 6,
    },
    periodBtnActive: { backgroundColor: c.primary },
    periodText: { fontFamily: fonts.bodySemi, fontSize: 13, color: c.textSecondary },
    periodTextActive: { color: "#fff" },
    saveBadge: { backgroundColor: c.successBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    saveText: { fontFamily: fonts.monoBold, fontSize: 9, color: c.success, letterSpacing: 1 },

    planCard: {
      backgroundColor: c.surface,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: radii.lg,
      padding: space.lg,
      marginBottom: space.md,
      ...cardShadow(mode),
    },
    planCardActive: { borderColor: c.primary, borderWidth: 2 },
    recommendBadge: {
      position: "absolute",
      top: -8,
      right: 16,
      backgroundColor: c.primary,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: radii.sm,
    },
    recommendText: { fontFamily: fonts.monoBold, fontSize: 9, color: "#fff", letterSpacing: 1.5 },
    planHeader: { flexDirection: "row", alignItems: "flex-start" },
    planName: { fontFamily: fonts.heading, fontSize: 22, color: c.textPrimary },
    planTagline: { fontFamily: fonts.body, fontSize: 12, color: c.textSecondary, marginTop: 2 },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    priceRow: { flexDirection: "row", alignItems: "flex-end", marginTop: space.md },
    currency: { fontFamily: fonts.heading, fontSize: 22, color: c.textPrimary, marginBottom: 8 },
    price: { fontFamily: fonts.heading, fontSize: 44, lineHeight: 48, color: c.textPrimary },
    perUnit: { fontFamily: fonts.body, fontSize: 14, color: c.textSecondary, marginBottom: 10, marginLeft: 4 },
    equivalent: { fontFamily: fonts.mono, fontSize: 11, color: c.textTertiary, marginTop: 2 },

    featureList: { marginTop: space.md, gap: 8 },
    featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    featureText: { fontFamily: fonts.body, fontSize: 13, color: c.textPrimary, flex: 1 },

    cta: {
      marginTop: space.md,
      backgroundColor: c.primary,
      borderRadius: radii.md,
      paddingVertical: 18,
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      gap: space.sm,
      ...cardShadow(mode),
    },
    ctaText: { fontFamily: fonts.bodySemi, fontSize: 14, color: "#fff", letterSpacing: 1.5 },
    fineprint: { fontFamily: fonts.body, fontSize: 11, color: c.textTertiary, marginTop: space.sm, textAlign: "center", lineHeight: 16 },
    paymentLogos: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, marginTop: space.md },
    payLogo: { backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    payLogoText: { fontFamily: fonts.monoBold, fontSize: 9, color: c.textTertiary, letterSpacing: 0.5 },
    secured: { fontFamily: fonts.body, fontSize: 10, color: c.textTertiary, textAlign: "center", marginTop: space.sm },
  });
