import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

const STORAGE_KEY = "mecatos:erp-theme";
const ThemeContext = createContext<{ dark: boolean; toggleTheme: () => void } | null>(null);

export function ErpThemeProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "dark"; }
    catch { return false; }
  });
  const isErp = !/^\/(?:login|reset-password|cajero)(?:\/|$)/.test(pathname);

  // Se monta antes de los guards de sesión y Suspense. El script de index.html
  // ya aplicó la misma preferencia antes de descargar CSS o JavaScript.
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (isErp && dark) root.dataset.erpTheme = "dark";
    else delete root.dataset.erpTheme;
    return () => { delete root.dataset.erpTheme; };
  }, [dark, isErp]);

  useLayoutEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light"); }
    catch { /* El tema funciona también con el almacenamiento bloqueado. */ }
  }, [dark]);

  return <ThemeContext.Provider value={{ dark, toggleTheme: () => setDark(value => !value) }}>{children}</ThemeContext.Provider>;
}

export function useErpTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("useErpTheme requiere ErpThemeProvider");
  return theme;
}
