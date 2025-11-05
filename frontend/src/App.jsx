import React, { createContext, useState, useEffect } from 'react'
export const ThemeContext = createContext({ theme: 'dark', toggle: () => { } })

export default function App({ children }) {
    const [theme, setTheme] = useState('dark')

    useEffect(() => {
        // toggle class on root (documentElement) so Tailwind's `dark:` classes work
        if (theme === 'dark') document.documentElement.classList.add('dark')
        else document.documentElement.classList.remove('dark')
    }, [theme])


    const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))


    return (
        <ThemeContext.Provider value={{ theme, toggle }}>
            {children}
        </ThemeContext.Provider>
    )
}