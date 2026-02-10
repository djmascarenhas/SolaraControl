import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

export type Theme = "light" | "dark" | "light-blue";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem("mc_theme");
    if (saved === "light" || saved === "dark" || saved === "light-blue") return saved;
    return "dark";
  });

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem("mc_theme", t);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light-blue");
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light-blue") {
      root.classList.add("light-blue");
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider");
  return ctx;
}
