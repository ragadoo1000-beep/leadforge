import React from "react";
import LandingScreen from "../src/screens/LandingScreen";

// Root route — the entire site is the LeadForge AI marketing landing page.
// No auth redirects, no app shell. Pure marketing site.
export default function Index() {
  return <LandingScreen />;
}
