import { createContext, useContext, useState } from "react"

const ThemeContext = createContext();

export const useTheme = () => {
    const context = useContext(ThemeContext)
    if (!context) throw new Error("useTheme should be used within ThemeProvider")
    return context
}

export const ThemeProvider = ({ children }) => {
    const [isDark, setIsDark] = useState(false)

    const toggleTheme = () => {
        setIsDark(!isDark)
    }

    const value = { isDark, setIsDark, toggleTheme };

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};