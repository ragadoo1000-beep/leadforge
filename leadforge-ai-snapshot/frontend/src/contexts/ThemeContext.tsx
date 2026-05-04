import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { palettes, ThemeMode, ColorPalette } from "../theme";

const KEY = "leadforge_theme";

type ThemeCtx = {
  mode: ThemeMode;
  colors: ColorPalette;
  toggle: () => void;
  setMode: (m: ThemeMode) => void;
};

const Ctx = createContext<ThemeCtx | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("light");

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === "dark" || v === "light") setMode(v);
    });
  }, []);

  const persist = useCallback((m: ThemeMode) => {
    setMode(m);
    AsyncStorage.setItem(KEY, m).catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    persist(mode === "light" ? "dark" : "light");
  }, [mode, persist]);

  return (
    <Ctx.Provider value={{ mode, colors: palettes[mode], toggle, setMode: persist }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider");
  return ctx;
}
