import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/contexts/AuthContext";
import LandingScreen from "../src/screens/LandingScreen";

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) {
      if (!user.onboarded) {
        router.replace("/onboarding");
      } else {
        router.replace("/(tabs)/feed");
      }
    }
    // If not logged in, stay here and render the landing page below.
  }, [user, loading, router]);

  if (loading) {
    return (
      <View style={styles.loader} testID="splash-screen">
        <ActivityIndicator color="#6366F1" size="large" />
      </View>
    );
  }

  // Render landing page for guests (unauthenticated visitors).
  if (!user) {
    return <LandingScreen />;
  }

  // While the redirect runs for authenticated users, render a quiet loader.
  return (
    <View style={styles.loader}>
      <ActivityIndicator color="#6366F1" size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: "#0A0A0F",
    alignItems: "center",
    justifyContent: "center",
  },
});
