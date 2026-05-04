import { Platform } from "react-native";

// ===== Light + Dark palettes =====
const lightPalette = {
  background: "#F4F5F8",
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  border: "#E6E8EE",
  borderFocus: "#2D52F5",
  primary: "#2D52F5",
  primaryHover: "#1E3DCC",
  primarySoft: "rgba(45, 82, 245, 0.10)",
  textPrimary: "#0E1422",
  textSecondary: "#525866",
  textTertiary: "#878E9E",
  inverse: "#FFFFFF",
  success: "#16A34A",
  successBg: "rgba(22, 163, 74, 0.12)",
  warning: "#F59E0B",
  warningBg: "rgba(245, 158, 11, 0.12)",
  error: "#EF4444",
  errorBg: "rgba(239, 68, 68, 0.12)",
  info: "#3B82F6",
  infoBg: "rgba(59, 130, 246, 0.12)",
  shadow: "rgba(14, 20, 34, 0.08)",
  scrim: "rgba(14, 20, 34, 0.45)",
};

const darkPalette = {
  background: "#0A0A0A",
  surface: "#141414",
  surfaceElevated: "#1A1A1A",
  border: "#262626",
  borderFocus: "#FF5C00",
  primary: "#FF5C00",
  primaryHover: "#E05200",
  primarySoft: "rgba(255, 92, 0, 0.15)",
  textPrimary: "#FFFFFF",
  textSecondary: "#A1A1AA",
  textTertiary: "#71717A",
  inverse: "#FFFFFF",
  success: "#10B981",
  successBg: "rgba(16, 185, 129, 0.15)",
  warning: "#F59E0B",
  warningBg: "rgba(245, 158, 11, 0.15)",
  error: "#EF4444",
  errorBg: "rgba(239, 68, 68, 0.15)",
  info: "#3B82F6",
  infoBg: "rgba(59, 130, 246, 0.15)",
  shadow: "rgba(0, 0, 0, 0.4)",
  scrim: "rgba(0, 0, 0, 0.7)",
};

export type ThemeMode = "light" | "dark";
export type ColorPalette = typeof lightPalette;

export const palettes: Record<ThemeMode, ColorPalette> = {
  light: lightPalette,
  dark: darkPalette,
};

export const fonts = {
  heading: "Sora_700Bold",
  headingMedium: "Sora_600SemiBold",
  body: "Geist_400Regular",
  bodyMedium: "Geist_500Medium",
  bodySemi: "Geist_600SemiBold",
  mono: "GeistMono_500Medium",
  monoBold: "GeistMono_700Bold",
};

export const radii = { sm: 6, md: 12, lg: 16, xl: 20, pill: 999 };
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };

export const cardShadow = (mode: ThemeMode) =>
  Platform.select({
    ios: {
      shadowColor: mode === "light" ? "#0E1422" : "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: mode === "light" ? 0.06 : 0.3,
      shadowRadius: 8,
    },
    android: {
      elevation: mode === "light" ? 2 : 4,
    },
    default: {},
  });

// Backwards-compat default export (dark) for any code not yet themed
export const colors = darkPalette;
