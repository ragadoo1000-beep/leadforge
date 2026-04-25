import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../src/contexts/AuthContext";
import { api } from "../src/lib/api";
import { colors, fonts, radii, space } from "../src/theme";

const PROFESSIONS = ["Designer", "Developer", "Marketer", "Writer", "Video Editor", "Other"];
const SKILLS = ["UI/UX", "Branding", "React", "Node.js", "Python", "SEO", "Copywriting", "Figma", "Webflow", "Mobile Apps", "Logo Design", "Motion"];
const EXPERIENCES = ["Beginner", "Intermediate", "Advanced"];
const TONES = ["Formal", "Casual", "Persuasive"];

export default function OnboardingScreen() {
  const { setUser } = useAuth();
  const router = useRouter();
  const [profession, setProfession] = useState<string>("Designer");
  const [skills, setSkills] = useState<string[]>([]);
  const [experience, setExperience] = useState<string>("Intermediate");
  const [portfolio, setPortfolio] = useState("");
  const [pricing, setPricing] = useState("");
  const [tone, setTone] = useState("Casual");
  const [loading, setLoading] = useState(false);

  const toggleSkill = (s: string) => {
    setSkills((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const updated = await api.updateProfile({
        profession,
        skills,
        experience_level: experience,
        portfolio_links: portfolio.split(",").map((s) => s.trim()).filter(Boolean),
        pricing_range: pricing,
        tone_preference: tone,
      });
      setUser(updated);
      router.replace("/(tabs)/feed");
    } catch (e: any) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.overline}>STEP 1 OF 1</Text>
          <Text style={styles.title}>Set up your profile</Text>
          <Text style={styles.subtitle}>Used to personalize your AI outreach.</Text>

          <View style={{ height: space.xl }} />

          <Text style={styles.label}>PROFESSION</Text>
          <View style={styles.chipRow}>
            {PROFESSIONS.map((p) => (
              <TouchableOpacity
                key={p}
                testID={`profession-chip-${p.toLowerCase()}`}
                onPress={() => setProfession(p)}
                style={[styles.chip, profession === p && styles.chipActive]}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, profession === p && styles.chipTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: space.lg }} />
          <Text style={styles.label}>SKILLS (select multiple)</Text>
          <View style={styles.chipRow}>
            {SKILLS.map((s) => (
              <TouchableOpacity
                key={s}
                testID={`skill-chip-${s.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                onPress={() => toggleSkill(s)}
                style={[styles.chip, skills.includes(s) && styles.chipActive]}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, skills.includes(s) && styles.chipTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: space.lg }} />
          <Text style={styles.label}>EXPERIENCE</Text>
          <View style={styles.chipRow}>
            {EXPERIENCES.map((e) => (
              <TouchableOpacity
                key={e}
                testID={`experience-chip-${e.toLowerCase()}`}
                onPress={() => setExperience(e)}
                style={[styles.chip, experience === e && styles.chipActive]}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, experience === e && styles.chipTextActive]}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: space.lg }} />
          <Text style={styles.label}>PORTFOLIO LINKS (comma separated)</Text>
          <TextInput
            testID="portfolio-input"
            value={portfolio}
            onChangeText={setPortfolio}
            placeholder="dribbble.com/you, github.com/you"
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
            autoCapitalize="none"
          />

          <View style={{ height: space.lg }} />
          <Text style={styles.label}>PRICING RANGE (optional)</Text>
          <TextInput
            testID="pricing-input"
            value={pricing}
            onChangeText={setPricing}
            placeholder="$30-50/hr or $500-2000/project"
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
          />

          <View style={{ height: space.lg }} />
          <Text style={styles.label}>OUTREACH TONE</Text>
          <View style={styles.chipRow}>
            {TONES.map((t) => (
              <TouchableOpacity
                key={t}
                testID={`tone-chip-${t.toLowerCase()}`}
                onPress={() => setTone(t)}
                style={[styles.chip, tone === t && styles.chipActive]}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, tone === t && styles.chipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: space.xl }} />
          <TouchableOpacity
            testID="onboarding-finish-btn"
            style={[styles.btnPrimary, loading && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>FORGE MY FEED</Text>}
          </TouchableOpacity>
          <View style={{ height: space.xl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: space.lg, paddingTop: space.lg },
  overline: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.primary, letterSpacing: 2 },
  title: { fontFamily: fonts.heading, fontSize: 32, color: colors.textPrimary, marginTop: space.sm },
  subtitle: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, marginTop: space.xs },
  label: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textTertiary, letterSpacing: 1.5, marginBottom: space.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.bodyMedium, color: colors.textSecondary, fontSize: 13 },
  chipTextActive: { color: "#fff" },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: space.md,
    paddingVertical: 14,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  btnPrimary: { backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: 16, alignItems: "center" },
  btnText: { color: "#fff", fontFamily: fonts.bodySemi, fontSize: 14, letterSpacing: 1.5 },
});
