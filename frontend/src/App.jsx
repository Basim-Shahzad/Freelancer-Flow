import React, { createContext, useState, useEffect } from "react";
export const ThemeContext = createContext({ theme: "dark", toggle: () => {} });
import { Toaster } from "react-hot-toast";

export default function App({ children }) {
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      <Toaster position="top-center"  />
      {children}
    </ThemeContext.Provider>
  );
}
