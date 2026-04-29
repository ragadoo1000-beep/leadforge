import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  Pressable,
  useWindowDimensions,
  Platform,
  Linking,
  Animated,
  Easing,
  Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";

// ===== Landing-specific dark palette (locked, independent from app theme) =====
const C = {
  bg: "#0A0A0F",
  bgAlt: "#0E0E14",
  surface: "#131319",
  surfaceHi: "#181820",
  border: "#1F1F2A",
  borderHi: "#2A2A38",
  text: "#FFFFFF",
  textMuted: "#9CA3AF",
  textDim: "#6B7280",
  primary: "#6366F1", // electric indigo
  primary2: "#8B5CF6", // purple
  accent: "#22D3EE", // cyan accent
  success: "#10B981",
  danger: "#EF4444",
};

const FONT = {
  heading: "Sora_700Bold",
  headingMid: "Sora_600SemiBold",
  body: "Geist_400Regular",
  bodyMid: "Geist_500Medium",
  bodySemi: "Geist_600SemiBold",
  mono: "GeistMono_500Medium",
};

// ===== Reusable: fade + rise on mount =====
function FadeRise({
  children,
  delay = 0,
  distance = 16,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  style?: any;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(distance)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 600,
        delay,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 600,
        delay,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();
  }, [delay, opacity, translateY]);
  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

// ===== Subtle floating animation for hero mockup =====
function Floating({ children, amplitude = 6, duration = 4200, delay = 0 }: { children: React.ReactNode; amplitude?: number; duration?: number; delay?: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, {
          toValue: 1,
          duration,
          delay,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
        Animated.timing(t, {
          toValue: 0,
          duration,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [t, duration, delay]);
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, -amplitude] });
  return <Animated.View style={{ transform: [{ translateY }] }}>{children}</Animated.View>;
}

// ===== Pressable with hover lift (web) =====
function HoverPress({
  children,
  onPress,
  style,
  testID,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: any;
  testID?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const lift = hovered ? -2 : 0;
  const scale = pressed ? 0.98 : 1;
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      testID={testID}
      style={[
        style,
        { transform: [{ translateY: lift }, { scale }] },
        Platform.OS === "web" ? ({ transition: "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease, background-color 180ms ease" } as any) : null,
      ]}
    >
      {children}
    </Pressable>
  );
}

// ===== Hero mockup card (the main animated product preview) =====
function HeroMockup() {
  return (
    <View style={mockup.wrap}>
      {/* Glow halos */}
      <View style={mockup.glow1} pointerEvents="none" />
      <View style={mockup.glow2} pointerEvents="none" />

      {/* Main card */}
      <Floating amplitude={6} duration={4800}>
        <View style={[mockup.card, mockup.cardTilt]}>
          <View style={mockup.cardHeader}>
            <View style={mockup.dotRow}>
              <View style={[mockup.dot, { backgroundColor: "#FF5F57" }]} />
              <View style={[mockup.dot, { backgroundColor: "#FEBC2E" }]} />
              <View style={[mockup.dot, { backgroundColor: "#28C840" }]} />
            </View>
            <Text style={mockup.cardHeaderText}>r/forhire · 3 min ago</Text>
          </View>

          <View style={{ padding: 18 }}>
            <View style={mockup.scoreRow}>
              <View style={mockup.scorePill}>
                <View style={mockup.scoreDot} />
                <Text style={mockup.scorePillText}>AI Score 92/100</Text>
              </View>
              <View style={mockup.tagPill}>
                <Text style={mockup.tagPillText}>High intent</Text>
              </View>
            </View>

            <Text style={mockup.title}>
              [Hiring] Need a React Native dev for SaaS dashboard ($3k–$5k)
            </Text>

            <Text style={mockup.body}>
              We're a small team launching a B2B analytics product. Looking for
              someone to ship the mobile dashboard end-to-end. Contract first,
              long-term if it fits.
            </Text>

            <View style={mockup.metaRow}>
              <View style={mockup.metaItem}>
                <Ionicons name="trending-up" size={14} color={C.success} />
                <Text style={mockup.metaText}>Strong intent</Text>
              </View>
              <View style={mockup.metaItem}>
                <Ionicons name="shield-checkmark" size={14} color={C.accent} />
                <Text style={mockup.metaText}>Verified poster</Text>
              </View>
              <View style={mockup.metaItem}>
                <Ionicons name="time-outline" size={14} color={C.textMuted} />
                <Text style={mockup.metaText}>Fresh</Text>
              </View>
            </View>

            <View style={mockup.btnRow}>
              <View style={mockup.primaryBtn}>
                <Ionicons name="sparkles" size={14} color="#fff" />
                <Text style={mockup.primaryBtnText}>Generate message</Text>
              </View>
              <View style={mockup.ghostBtn}>
                <Text style={mockup.ghostBtnText}>Save</Text>
              </View>
            </View>
          </View>
        </View>
      </Floating>

      {/* Floating secondary card: AI message preview */}
      <View style={mockup.miniWrap} pointerEvents="none">
        <Floating amplitude={9} duration={5200} delay={400}>
          <View style={[mockup.miniCard, mockup.miniTilt]}>
            <View style={mockup.miniHeader}>
              <View style={mockup.aiBadge}>
                <Ionicons name="sparkles" size={11} color="#fff" />
                <Text style={mockup.aiBadgeText}>AI Draft</Text>
              </View>
              <Text style={mockup.miniHeaderText}>0.8s</Text>
            </View>
            <Text style={mockup.miniBody}>
              "Hey! I noticed you're hiring for a RN dashboard. I shipped a
              similar B2B app last month — happy to share a 60s loom of the
              flow if useful…"
            </Text>
            <View style={mockup.copyRow}>
              <Ionicons name="copy-outline" size={12} color={C.textMuted} />
              <Text style={mockup.copyText}>Copy & send manually</Text>
            </View>
          </View>
        </Floating>
      </View>
    </View>
  );
}

// ===== Main Landing Screen =====
export default function LandingScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 980;
  const isTablet = width >= 720 && width < 980;

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedMsg, setSubmittedMsg] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [legalKey, setLegalKey] = useState<null | "privacy" | "terms" | "disclaimer">(null);

  const heroEmailRef = useRef<TextInput>(null);
  const ctaSectionRef = useRef<View>(null);
  const howItWorksRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);

  const sectionPositions = useRef<Record<string, number>>({});

  useEffect(() => {
    api.earlyAccessCount().then((r: any) => setCount(r?.count ?? null)).catch(() => {});
  }, []);

  const onSubmit = async () => {
    setSubmitError(null);
    setSubmittedMsg(null);
    const e = email.trim();
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setSubmitError("Please enter a valid email.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.earlyAccessSignup({ email: e, role: role || undefined, source: "landing" });
      if (res?.already_registered) {
        setSubmittedMsg("You're already on the list. We'll be in touch soon.");
      } else {
        setSubmittedMsg("You're in! Watch your inbox for early access.");
      }
      setEmail("");
      setRole("");
      // refresh counter optimistically
      setCount((c) => (c == null ? c : c + 1));
    } catch (err: any) {
      setSubmitError(err?.message || "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const scrollToSection = (key: string) => {
    const y = sectionPositions.current[key];
    if (y != null && scrollRef.current) {
      scrollRef.current.scrollTo({ y: Math.max(0, y - 24), animated: true });
    }
  };

  const onSectionLayout = (key: string) => (e: any) => {
    sectionPositions.current[key] = e.nativeEvent.layout.y;
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={s.root}
      contentContainerStyle={{ paddingBottom: 0 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ============== Top Nav ============== */}
      <View style={[s.nav, { paddingHorizontal: isDesktop ? 64 : 20 }]}>
        <View style={s.navInner}>
          <View style={s.brandRow}>
            <View style={s.logoMark}>
              <LinearGradient
                colors={[C.primary, C.primary2]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.logoGradient}
              />
              <Ionicons name="flash" size={14} color="#fff" style={{ position: "absolute" }} />
            </View>
            <Text style={s.brandName}>LeadForge AI</Text>
          </View>

          {isDesktop && (
            <View style={s.navLinks}>
              <Pressable onPress={() => scrollToSection("how")}>
                <Text style={s.navLink}>How it works</Text>
              </Pressable>
              <Pressable onPress={() => scrollToSection("features")}>
                <Text style={s.navLink}>Features</Text>
              </Pressable>
              <Pressable onPress={() => scrollToSection("proof")}>
                <Text style={s.navLink}>Customers</Text>
              </Pressable>
            </View>
          )}

          <View style={s.navCtas}>
            <HoverPress onPress={() => scrollToSection("cta")} style={s.navCta}>
              <Text style={s.navCtaText}>Get early access</Text>
            </HoverPress>
          </View>
        </View>
      </View>

      {/* ============== HERO ============== */}
      <View style={[s.hero, { paddingHorizontal: isDesktop ? 64 : 20 }]}>
        {/* Background grid + radial glow */}
        <View pointerEvents="none" style={s.heroBgGlow} />
        <View pointerEvents="none" style={s.heroBgGlow2} />

        <View style={[s.heroInner, { flexDirection: isDesktop ? "row" : "column", alignItems: isDesktop ? "center" : "stretch", gap: isDesktop ? 56 : 36 }]}>
          {/* Left: copy */}
          <View style={{ flex: isDesktop ? 1 : undefined, maxWidth: isDesktop ? 620 : undefined }}>
            <FadeRise delay={0}>
              <View style={s.heroBadge}>
                <View style={s.heroBadgeDot} />
                <Text style={s.heroBadgeText}>Now in private beta</Text>
              </View>
            </FadeRise>

            <FadeRise delay={80}>
              <Text style={[s.heroTitle, { fontSize: isDesktop ? 60 : isTablet ? 48 : 38, lineHeight: isDesktop ? 66 : isTablet ? 54 : 44 }]}>
                Get freelance clients{"\n"}from Reddit{" "}
                <Text style={s.heroTitleAccent}>without wasting hours</Text>
              </Text>
            </FadeRise>

            <FadeRise delay={160}>
              <Text style={[s.heroSubtitle, { fontSize: isDesktop ? 19 : 17 }]}>
                LeadForge AI finds real client opportunities and helps you write personalized outreach messages in seconds.
              </Text>
            </FadeRise>

            <FadeRise delay={240}>
              <View style={[s.heroCtaRow, { flexDirection: width < 480 ? "column" : "row" }]}>
                <HoverPress onPress={() => scrollToSection("cta")} style={s.primaryBtn}>
                  <Text style={s.primaryBtnText}>Get Early Access</Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </HoverPress>
                <HoverPress onPress={() => scrollToSection("how")} style={s.secondaryBtn}>
                  <Ionicons name="play-circle-outline" size={16} color={C.text} />
                  <Text style={s.secondaryBtnText}>See how it works</Text>
                </HoverPress>
              </View>
            </FadeRise>

            <FadeRise delay={320}>
              <View style={s.trustRow}>
                <Ionicons name="lock-closed-outline" size={14} color={C.textMuted} />
                <Text style={s.trustText}>No automation. You stay in control.</Text>
              </View>
            </FadeRise>
          </View>

          {/* Right: mockup */}
          <View style={{ flex: isDesktop ? 1 : undefined, alignItems: "center", justifyContent: "center", minHeight: isDesktop ? 480 : 420 }}>
            <FadeRise delay={300} distance={24}>
              <HeroMockup />
            </FadeRise>
          </View>
        </View>
      </View>

      {/* ============== Logos / trust strip ============== */}
      <View style={[s.logoStrip, { paddingHorizontal: isDesktop ? 64 : 20 }]}>
        <Text style={s.logoStripText}>
          Trusted by early-stage freelancers shipping from{"  "}
          <Text style={{ color: C.text }}>Reddit</Text>,{" "}
          <Text style={{ color: C.text }}>X</Text>,{" "}
          <Text style={{ color: C.text }}>Discord</Text> & more
        </Text>
      </View>

      {/* ============== HOW IT WORKS ============== */}
      <View
        onLayout={onSectionLayout("how")}
        style={[s.section, { paddingHorizontal: isDesktop ? 64 : 20 }]}
      >
        <FadeRise>
          <Text style={s.eyebrow}>How it works</Text>
          <Text style={s.sectionTitle}>From signal to outreach in three steps.</Text>
          <Text style={s.sectionSubtitle}>
            No spam. No automation. Just better leads, faster — so you can focus on doing the work.
          </Text>
        </FadeRise>

        <View
          style={[
            s.stepsGrid,
            { flexDirection: isDesktop ? "row" : "column", gap: isDesktop ? 20 : 16 },
          ]}
        >
          {STEPS.map((step, i) => (
            <FadeRise key={step.title} delay={120 * i} style={{ flex: isDesktop ? 1 : undefined }}>
              <StepCard index={i + 1} step={step} />
            </FadeRise>
          ))}
        </View>
      </View>

      {/* ============== FEATURES ============== */}
      <View
        onLayout={onSectionLayout("features")}
        style={[s.section, { paddingHorizontal: isDesktop ? 64 : 20 }]}
      >
        <FadeRise>
          <Text style={s.eyebrow}>Features</Text>
          <Text style={s.sectionTitle}>Everything you need to land your next client.</Text>
          <Text style={s.sectionSubtitle}>
            Built for freelancers who want signal over noise. No bloat, no dark patterns.
          </Text>
        </FadeRise>

        <View
          style={[
            s.featuresGrid,
            { flexDirection: isDesktop || isTablet ? "row" : "column", flexWrap: "wrap", gap: 16 },
          ]}
        >
          {FEATURES.map((f, i) => (
            <FadeRise
              key={f.title}
              delay={80 * i}
              style={{
                width: isDesktop ? "calc(50% - 8px)" as any : isTablet ? "calc(50% - 8px)" as any : "100%",
              }}
            >
              <FeatureCard feature={f} />
            </FadeRise>
          ))}
        </View>
      </View>

      {/* ============== SOCIAL PROOF ============== */}
      <View
        onLayout={onSectionLayout("proof")}
        style={[s.section, { paddingHorizontal: isDesktop ? 64 : 20 }]}
      >
        <FadeRise>
          <Text style={s.eyebrow}>Used by early freelancers</Text>
          <Text style={s.sectionTitle}>What our beta users are saying.</Text>
        </FadeRise>

        <View
          style={[
            s.testimonialsGrid,
            { flexDirection: isDesktop ? "row" : "column", gap: 16 },
          ]}
        >
          {TESTIMONIALS.map((t, i) => (
            <FadeRise key={t.name} delay={80 * i} style={{ flex: isDesktop ? 1 : undefined }}>
              <TestimonialCard t={t} />
            </FadeRise>
          ))}
        </View>
      </View>

      {/* ============== EMAIL CAPTURE ============== */}
      <View
        onLayout={onSectionLayout("cta")}
        style={[s.ctaSection, { paddingHorizontal: isDesktop ? 64 : 20 }]}
      >
        <View style={s.ctaCard}>
          <View pointerEvents="none" style={s.ctaGlow} />

          <FadeRise>
            <Text style={s.ctaTitle}>Be first to access LeadForge AI</Text>
            <Text style={s.ctaSubtitle}>
              We're letting in a small batch of freelancers each week. Join the list to skip the queue.
            </Text>
          </FadeRise>

          <FadeRise delay={120}>
            <View
              style={[
                s.formRow,
                { flexDirection: width < 720 ? "column" : "row", gap: 10 },
              ]}
            >
              <View style={[s.inputWrap, { flex: width < 720 ? undefined : 1.4 }]}>
                <Ionicons name="mail-outline" size={16} color={C.textMuted} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@email.com"
                  placeholderTextColor={C.textDim}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={s.input}
                  testID="early-access-email"
                />
              </View>

              <View style={[s.selectWrap, { flex: width < 720 ? undefined : 1 }]}>
                <Pressable
                  style={s.selectBtn}
                  onPress={() => setShowRoleMenu((v) => !v)}
                  testID="early-access-role"
                >
                  <Ionicons name="briefcase-outline" size={16} color={C.textMuted} />
                  <Text style={[s.selectText, { color: role ? C.text : C.textDim }]} numberOfLines={1}>
                    {role || "What do you do?"}
                  </Text>
                  <Ionicons
                    name={showRoleMenu ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={C.textMuted}
                  />
                </Pressable>
                {showRoleMenu && (
                  <View style={s.selectMenu}>
                    {ROLES.map((r) => (
                      <Pressable
                        key={r}
                        style={({ hovered }: any) => [
                          s.selectItem,
                          hovered ? { backgroundColor: C.surfaceHi } : null,
                        ]}
                        onPress={() => {
                          setRole(r);
                          setShowRoleMenu(false);
                        }}
                      >
                        <Text style={s.selectItemText}>{r}</Text>
                        {role === r ? (
                          <Ionicons name="checkmark" size={14} color={C.primary} />
                        ) : null}
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              <HoverPress
                onPress={onSubmit}
                style={[s.primaryBtn, { paddingHorizontal: 22 }]}
                testID="early-access-submit"
              >
                <Text style={s.primaryBtnText}>
                  {submitting ? "Joining…" : "Join Early Access"}
                </Text>
                {!submitting ? (
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                ) : null}
              </HoverPress>
            </View>
          </FadeRise>

          {submittedMsg ? (
            <View style={[s.formNote, { borderColor: "rgba(16,185,129,0.35)", backgroundColor: "rgba(16,185,129,0.08)" }]}>
              <Ionicons name="checkmark-circle" size={14} color={C.success} />
              <Text style={[s.formNoteText, { color: "#A7F3D0" }]}>{submittedMsg}</Text>
            </View>
          ) : null}
          {submitError ? (
            <View style={[s.formNote, { borderColor: "rgba(239,68,68,0.35)", backgroundColor: "rgba(239,68,68,0.08)" }]}>
              <Ionicons name="alert-circle" size={14} color={C.danger} />
              <Text style={[s.formNoteText, { color: "#FCA5A5" }]}>{submitError}</Text>
            </View>
          ) : null}

          <FadeRise delay={200}>
            <View style={s.metaRow}>
              <View style={s.metaItem}>
                <Ionicons name="lock-closed-outline" size={12} color={C.textMuted} />
                <Text style={s.metaText}>We'll never share your email.</Text>
              </View>
              {count != null ? (
                <View style={s.metaItem}>
                  <Ionicons name="people-outline" size={12} color={C.textMuted} />
                  <Text style={s.metaText}>{count.toLocaleString()} freelancers on the list</Text>
                </View>
              ) : null}
            </View>
          </FadeRise>
        </View>
      </View>

      {/* ============== FOOTER ============== */}
      <View style={[s.footer, { paddingHorizontal: isDesktop ? 64 : 20 }]}>
        <View style={[s.footerInner, { flexDirection: isDesktop ? "row" : "column", gap: isDesktop ? 0 : 20 }]}>
          <View style={s.brandRow}>
            <View style={s.logoMark}>
              <LinearGradient colors={[C.primary, C.primary2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.logoGradient} />
              <Ionicons name="flash" size={14} color="#fff" style={{ position: "absolute" }} />
            </View>
            <Text style={s.brandName}>LeadForge AI</Text>
          </View>

          <View style={s.footerLinks}>
            <Pressable onPress={() => setLegalKey("privacy")}>
              <Text style={s.footerLink}>Privacy Policy</Text>
            </Pressable>
            <Pressable onPress={() => setLegalKey("terms")}>
              <Text style={s.footerLink}>Terms</Text>
            </Pressable>
            <Pressable onPress={() => setLegalKey("disclaimer")}>
              <Text style={s.footerLink}>Disclaimer</Text>
            </Pressable>
            <Pressable onPress={() => Linking.openURL("mailto:hello@leadforge.app")}>
              <Text style={s.footerLink}>Contact</Text>
            </Pressable>
          </View>
        </View>

        <Text style={s.footerDisclaimer}>
          We are not affiliated with Reddit. We do not guarantee results.
        </Text>
        <Text style={s.footerCopy}>© {new Date().getFullYear()} LeadForge AI. Built for freelancers.</Text>
      </View>

      {/* ============== Legal Modal ============== */}
      <LegalModal
        legalKey={legalKey}
        onClose={() => setLegalKey(null)}
        isDesktop={isDesktop}
      />
    </ScrollView>
  );
}

// ===== Legal Modal =====
const LEGAL_CONTENT: Record<string, { title: string; body: string }> = {
  privacy: {
    title: "Privacy Policy",
    body:
`We collect the bare minimum needed to deliver LeadForge AI:
• Your email address (only used to send you product updates and access notifications).
• Optional role you select (Designer, Developer, Marketer, or Other) so we can prioritize features.

We do not:
• Sell your data to third parties.
• Use third-party advertising trackers.
• Store any private message content you generate.

You can request deletion of your data at any time by emailing hello@leadforge.app. We will remove your record within 30 days.

Last updated: April 2026.`,
  },
  terms: {
    title: "Terms of Service",
    body:
`By joining the LeadForge AI early access list you acknowledge:
• Early access is offered as-is, with no uptime or feature guarantees during beta.
• You will use LeadForge AI to identify hiring opportunities you found through publicly available content.
• You will not use LeadForge AI to send unsolicited bulk messages, spam, or to violate the terms of service of any platform (including Reddit).
• You remain solely responsible for every outreach message you send. LeadForge AI does not auto-send messages on your behalf.
• We may update or discontinue features at any time during the beta period.

Last updated: April 2026.`,
  },
  disclaimer: {
    title: "Disclaimer",
    body:
`LeadForge AI is an independent product. We are not affiliated with, endorsed by, or sponsored by Reddit, Inc. or any subreddit moderation team.

Results vary. Signing up for early access does not guarantee that you will land clients, win projects, or generate any specific level of income. Outcomes depend on your skills, market fit, and the effort you put into your outreach.

The AI scoring is a heuristic and may surface false positives. Always review every lead and message before sending.

Last updated: April 2026.`,
  },
};

function LegalModal({
  legalKey,
  onClose,
  isDesktop,
}: {
  legalKey: null | "privacy" | "terms" | "disclaimer";
  onClose: () => void;
  isDesktop: boolean;
}) {
  const visible = !!legalKey;
  const data = legalKey ? LEGAL_CONTENT[legalKey] : null;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={legal.scrim} onPress={onClose} />
      <View style={legal.center} pointerEvents="box-none">
        <View
          style={[
            legal.card,
            { width: isDesktop ? 640 : "92%", maxWidth: 640, maxHeight: "82%" as any },
          ]}
        >
          <View style={legal.head}>
            <Text style={legal.title}>{data?.title}</Text>
            <Pressable onPress={onClose} hitSlop={10} style={legal.close}>
              <Ionicons name="close" size={18} color={C.textMuted} />
            </Pressable>
          </View>
          <ScrollView style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
            <Text style={legal.body}>{data?.body}</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ===== Step Card =====
function StepCard({ index, step }: { index: number; step: { icon: any; title: string; desc: string } }) {
  return (
    <View style={cards.step}>
      <View style={cards.stepIndex}>
        <Text style={cards.stepIndexText}>0{index}</Text>
      </View>
      <View style={cards.stepIcon}>
        <Ionicons name={step.icon} size={20} color={C.primary} />
      </View>
      <Text style={cards.stepTitle}>{step.title}</Text>
      <Text style={cards.stepDesc}>{step.desc}</Text>
    </View>
  );
}

// ===== Feature Card =====
function FeatureCard({ feature }: { feature: { icon: any; title: string; desc: string } }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[
        cards.feature,
        hovered
          ? {
              borderColor: C.borderHi,
              transform: [{ translateY: -3 }],
              shadowColor: C.primary,
              shadowOpacity: 0.18,
              shadowRadius: 22,
              shadowOffset: { width: 0, height: 8 },
            }
          : null,
        Platform.OS === "web"
          ? ({
              transition: "transform 200ms ease, border-color 200ms ease, box-shadow 200ms ease",
              cursor: "default",
            } as any)
          : null,
      ]}
    >
      <View style={cards.featureIcon}>
        <Ionicons name={feature.icon} size={18} color={C.primary} />
      </View>
      <Text style={cards.featureTitle}>{feature.title}</Text>
      <Text style={cards.featureDesc}>{feature.desc}</Text>
    </Pressable>
  );
}

// ===== Testimonial Card =====
function TestimonialCard({ t }: { t: { name: string; role: string; quote: string; initials: string } }) {
  return (
    <View style={cards.testimonial}>
      <Ionicons name="logo-reddit" size={16} color={C.textDim} style={{ position: "absolute", top: 18, right: 18 }} />
      <Text style={cards.testimonialQuote}>"{t.quote}"</Text>
      <View style={cards.testimonialFooter}>
        <View style={cards.avatar}>
          <Text style={cards.avatarText}>{t.initials}</Text>
        </View>
        <View>
          <Text style={cards.testimonialName}>{t.name}</Text>
          <Text style={cards.testimonialRole}>{t.role}</Text>
        </View>
      </View>
    </View>
  );
}

// ===== Static content =====
const STEPS = [
  {
    icon: "search-outline" as any,
    title: "Find Opportunities",
    desc: "Discover real hiring posts from Reddit instantly — surfaced the moment they go live.",
  },
  {
    icon: "analytics-outline" as any,
    title: "AI Scores Leads",
    desc: "See which opportunities are worth your time. Intent, budget signals and poster reputation, ranked.",
  },
  {
    icon: "send-outline" as any,
    title: "Generate Outreach",
    desc: "Get personalized messages you can copy and send. You stay in control — always manual.",
  },
];

const FEATURES = [
  {
    icon: "flame-outline" as any,
    title: "High-intent lead detection",
    desc: "We filter out the noise and surface only posts with real hiring intent — budget hints, urgency cues and verified posters.",
  },
  {
    icon: "sparkles-outline" as any,
    title: "AI-powered message generation",
    desc: "Draft tailored, on-brand outreach in seconds. Tweak the tone, copy, and send from your own inbox.",
  },
  {
    icon: "grid-outline" as any,
    title: "Clean lead dashboard",
    desc: "A focused feed with statuses, notes and follow-up reminders. No spreadsheets, no clutter.",
  },
  {
    icon: "shield-checkmark-outline" as any,
    title: "Manual outreach (no automation)",
    desc: "We never DM, comment or post on your behalf. You stay 100% in control of every message.",
  },
];

const TESTIMONIALS = [
  {
    name: "Aman R.",
    role: "Full-stack freelancer",
    initials: "AR",
    quote:
      "I went from refreshing Reddit for an hour to getting 3 qualified leads before my coffee. The AI scoring is the killer feature.",
  },
  {
    name: "Priya S.",
    role: "Brand designer",
    initials: "PS",
    quote:
      "The drafted DMs sound like me — not like a template. I tweak one line and send. Closed two retainer clients in week one.",
  },
  {
    name: "Marco T.",
    role: "Indie marketer",
    initials: "MT",
    quote:
      "Finally a tool that doesn't try to spam for me. The transparency and the manual-only flow build real trust with prospects.",
  },
];

const ROLES = ["Designer", "Developer", "Marketer", "Other"];

// ===== Styles: layout / sections =====
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Nav
  nav: {
    paddingTop: Platform.OS === "web" ? 18 : 14,
    paddingBottom: 12,
    backgroundColor: C.bg,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  navInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    maxWidth: 1240,
    width: "100%",
    alignSelf: "center",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoMark: {
    width: 28,
    height: 28,
    borderRadius: 8,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.primary,
  },
  logoGradient: { ...StyleSheet.absoluteFillObject as any },
  brandName: { fontFamily: FONT.heading, fontSize: 17, color: C.text, letterSpacing: -0.2 },
  navLinks: { flexDirection: "row", gap: 28 },
  navLink: { fontFamily: FONT.bodyMid, fontSize: 14, color: C.textMuted },
  navCtas: { flexDirection: "row", alignItems: "center", gap: 16 },
  navCta: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: C.primary,
  },
  navCtaText: { fontFamily: FONT.bodySemi, color: "#fff", fontSize: 13 },

  // Hero
  hero: {
    paddingTop: 64,
    paddingBottom: 80,
    backgroundColor: C.bg,
    overflow: "hidden",
  },
  heroInner: {
    maxWidth: 1240,
    width: "100%",
    alignSelf: "center",
  },
  heroBgGlow: {
    position: "absolute",
    top: -200,
    left: -200,
    width: 700,
    height: 700,
    borderRadius: 700,
    backgroundColor: "rgba(99,102,241,0.18)",
    opacity: 0.7,
    ...(Platform.OS === "web" ? ({ filter: "blur(120px)" } as any) : {}),
  },
  heroBgGlow2: {
    position: "absolute",
    top: 100,
    right: -250,
    width: 600,
    height: 600,
    borderRadius: 600,
    backgroundColor: "rgba(139,92,246,0.16)",
    opacity: 0.6,
    ...(Platform.OS === "web" ? ({ filter: "blur(140px)" } as any) : {}),
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 24,
  },
  heroBadgeDot: {
    width: 6, height: 6, borderRadius: 6, backgroundColor: C.success,
  },
  heroBadgeText: { fontFamily: FONT.bodyMid, color: C.textMuted, fontSize: 12, letterSpacing: 0.2 },
  heroTitle: {
    fontFamily: FONT.heading,
    color: C.text,
    letterSpacing: -1.4,
    marginBottom: 20,
  },
  heroTitleAccent: {
    color: "transparent",
    ...(Platform.OS === "web"
      ? ({ backgroundImage: `linear-gradient(90deg, ${C.primary}, ${C.primary2})`, WebkitBackgroundClip: "text", backgroundClip: "text" } as any)
      : { color: C.primary2 }),
  },
  heroSubtitle: {
    fontFamily: FONT.body,
    color: C.textMuted,
    lineHeight: 28,
    maxWidth: 560,
    marginBottom: 32,
  },
  heroCtaRow: { flexDirection: "row", gap: 12, marginBottom: 20, flexWrap: "wrap" },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 12,
    backgroundColor: C.primary,
    shadowColor: C.primary,
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  primaryBtnText: { fontFamily: FONT.bodySemi, color: "#fff", fontSize: 15 },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  secondaryBtnText: { fontFamily: FONT.bodySemi, color: C.text, fontSize: 14 },
  trustRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  trustText: { fontFamily: FONT.bodyMid, color: C.textMuted, fontSize: 13 },

  // Logo strip
  logoStrip: {
    paddingVertical: 28,
    backgroundColor: C.bgAlt,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.border,
  },
  logoStripText: {
    fontFamily: FONT.bodyMid,
    color: C.textDim,
    fontSize: 13,
    textAlign: "center",
    letterSpacing: 0.3,
  },

  // Generic section
  section: {
    paddingTop: 96,
    paddingBottom: 24,
    maxWidth: 1240,
    width: "100%",
    alignSelf: "center",
  },
  eyebrow: {
    fontFamily: FONT.mono,
    color: C.primary,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: FONT.heading,
    color: C.text,
    fontSize: 36,
    lineHeight: 44,
    letterSpacing: -0.8,
    marginBottom: 14,
    maxWidth: 720,
  },
  sectionSubtitle: {
    fontFamily: FONT.body,
    color: C.textMuted,
    fontSize: 16,
    lineHeight: 26,
    maxWidth: 640,
    marginBottom: 40,
  },

  stepsGrid: { },
  featuresGrid: { },
  testimonialsGrid: { },

  // CTA
  ctaSection: {
    paddingTop: 64,
    paddingBottom: 96,
    maxWidth: 1240,
    width: "100%",
    alignSelf: "center",
  },
  ctaCard: {
    backgroundColor: C.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.border,
    padding: 36,
    overflow: "hidden",
    position: "relative",
  },
  ctaGlow: {
    position: "absolute",
    top: -150,
    right: -100,
    width: 480,
    height: 480,
    borderRadius: 480,
    backgroundColor: "rgba(99,102,241,0.18)",
    ...(Platform.OS === "web" ? ({ filter: "blur(80px)" } as any) : {}),
  },
  ctaTitle: {
    fontFamily: FONT.heading,
    color: C.text,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.6,
    marginBottom: 10,
  },
  ctaSubtitle: {
    fontFamily: FONT.body,
    color: C.textMuted,
    fontSize: 16,
    lineHeight: 26,
    marginBottom: 28,
    maxWidth: 580,
  },
  formRow: { alignItems: "stretch" },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    backgroundColor: C.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    height: 48,
  },
  input: {
    flex: 1,
    color: C.text,
    fontFamily: FONT.bodyMid,
    fontSize: 15,
    height: 48,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },
  selectWrap: { position: "relative", zIndex: 5 },
  selectBtn: {
    height: 48,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  selectText: { flex: 1, fontFamily: FONT.bodyMid, fontSize: 14 },
  selectMenu: {
    position: "absolute",
    top: 54,
    left: 0,
    right: 0,
    backgroundColor: C.surfaceHi,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 6,
    zIndex: 100,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  selectItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  selectItemText: { fontFamily: FONT.bodyMid, color: C.text, fontSize: 14 },

  formNote: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
  },
  formNoteText: { fontFamily: FONT.bodyMid, fontSize: 13 },

  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 18, marginTop: 18 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { fontFamily: FONT.body, color: C.textMuted, fontSize: 12 },

  // Footer
  footer: {
    paddingTop: 40,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bgAlt,
  },
  footerInner: {
    maxWidth: 1240,
    width: "100%",
    alignSelf: "center",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerLinks: { flexDirection: "row", flexWrap: "wrap", gap: 24 },
  footerLink: { fontFamily: FONT.bodyMid, color: C.textMuted, fontSize: 13 },
  footerDisclaimer: {
    fontFamily: FONT.body,
    color: C.textDim,
    fontSize: 12,
    textAlign: "center",
    marginTop: 24,
    maxWidth: 1240,
    alignSelf: "center",
  },
  footerCopy: {
    fontFamily: FONT.body,
    color: C.textDim,
    fontSize: 12,
    textAlign: "center",
    marginTop: 6,
  },
});

// ===== Step + Feature + Testimonial card styles =====
const cards = StyleSheet.create({
  step: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 24,
    minHeight: 200,
    position: "relative",
    overflow: "hidden",
  },
  stepIndex: {
    position: "absolute",
    top: 18,
    right: 22,
  },
  stepIndexText: {
    fontFamily: FONT.mono,
    color: C.textDim,
    fontSize: 12,
    letterSpacing: 1,
  },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(99,102,241,0.14)",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.30)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  stepTitle: {
    fontFamily: FONT.headingMid,
    color: C.text,
    fontSize: 18,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  stepDesc: {
    fontFamily: FONT.body,
    color: C.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },

  feature: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 24,
    minHeight: 180,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: "rgba(99,102,241,0.14)",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.30)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  featureTitle: {
    fontFamily: FONT.headingMid,
    color: C.text,
    fontSize: 17,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  featureDesc: {
    fontFamily: FONT.body,
    color: C.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },

  testimonial: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 24,
    minHeight: 200,
  },
  testimonialQuote: {
    fontFamily: FONT.body,
    color: C.text,
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 22,
  },
  testimonialFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 36,
    backgroundColor: "rgba(99,102,241,0.18)",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: FONT.bodySemi,
    color: C.text,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  testimonialName: { fontFamily: FONT.bodySemi, color: C.text, fontSize: 14 },
  testimonialRole: { fontFamily: FONT.body, color: C.textMuted, fontSize: 12, marginTop: 2 },
});

// ===== Mockup styles =====
const mockup = StyleSheet.create({
  wrap: {
    width: 460,
    maxWidth: "100%",
    height: 460,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  glow1: {
    position: "absolute",
    top: 20,
    left: 0,
    width: 320,
    height: 320,
    borderRadius: 320,
    backgroundColor: "rgba(99,102,241,0.35)",
    opacity: 0.6,
    ...(Platform.OS === "web" ? ({ filter: "blur(100px)" } as any) : {}),
  },
  glow2: {
    position: "absolute",
    bottom: 0,
    right: 10,
    width: 260,
    height: 260,
    borderRadius: 260,
    backgroundColor: "rgba(139,92,246,0.35)",
    opacity: 0.5,
    ...(Platform.OS === "web" ? ({ filter: "blur(110px)" } as any) : {}),
  },
  card: {
    width: 380,
    maxWidth: "100%",
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.borderHi,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
  },
  cardTilt: Platform.OS === "web" ? ({ transform: [{ rotateZ: "-1.5deg" }, { rotateY: "6deg" }, { rotateX: "2deg" }] } as any) : {},
  cardHeader: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.surfaceHi,
  },
  dotRow: { flexDirection: "row", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 10 },
  cardHeaderText: { fontFamily: FONT.mono, color: C.textDim, fontSize: 11, letterSpacing: 0.3 },

  scoreRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  scorePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(16,185,129,0.12)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.32)",
  },
  scoreDot: { width: 6, height: 6, borderRadius: 6, backgroundColor: C.success },
  scorePillText: { fontFamily: FONT.bodySemi, color: "#34D399", fontSize: 11, letterSpacing: 0.3 },
  tagPill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(99,102,241,0.12)",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.30)",
  },
  tagPillText: { fontFamily: FONT.bodySemi, color: "#A5B4FC", fontSize: 11, letterSpacing: 0.3 },
  title: {
    fontFamily: FONT.headingMid,
    color: C.text,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  body: {
    fontFamily: FONT.body,
    color: C.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 18,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontFamily: FONT.body, color: C.textMuted, fontSize: 11 },

  btnRow: { flexDirection: "row", gap: 10 },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: C.primary,
  },
  primaryBtnText: { fontFamily: FONT.bodySemi, color: "#fff", fontSize: 13 },
  ghostBtn: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostBtnText: { fontFamily: FONT.bodySemi, color: C.text, fontSize: 13 },

  // Mini floating card (AI message preview)
  miniWrap: {
    position: "absolute",
    bottom: 4,
    right: -12,
    width: 280,
    maxWidth: "70%",
  },
  miniCard: {
    backgroundColor: C.surfaceHi,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.borderHi,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
  },
  miniTilt: Platform.OS === "web" ? ({ transform: [{ rotateZ: "2deg" }, { rotateY: "-4deg" }] } as any) : {},
  miniHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: C.primary,
  },
  aiBadgeText: { fontFamily: FONT.bodySemi, color: "#fff", fontSize: 10, letterSpacing: 0.3 },
  miniHeaderText: { fontFamily: FONT.mono, color: C.textDim, fontSize: 10 },
  miniBody: { fontFamily: FONT.body, color: C.text, fontSize: 12, lineHeight: 18 },
  copyRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  copyText: { fontFamily: FONT.bodyMid, color: C.textMuted, fontSize: 11 },
});


// ===== Legal modal styles =====
const legal = StyleSheet.create({
  scrim: {
    ...(StyleSheet.absoluteFillObject as any),
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  center: {
    ...(StyleSheet.absoluteFillObject as any),
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 },
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  title: {
    fontFamily: FONT.heading,
    color: C.text,
    fontSize: 20,
    letterSpacing: -0.3,
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: 32,
    backgroundColor: C.surfaceHi,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    fontFamily: FONT.body,
    color: C.textMuted,
    fontSize: 14,
    lineHeight: 24,
    paddingTop: 18,
    paddingBottom: 8,
  },
});
