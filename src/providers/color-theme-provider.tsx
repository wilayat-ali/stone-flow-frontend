'use client'

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react'
import { DEFAULT_THEME, type ThemeId } from '@/config/themes'
import { setPersonalThemeAction } from '@/features/theme/actions'

type ColorThemeContext = {
    /** The theme on screen right now. */
    active: ThemeId
    personal: ThemeId | null
    /** Default theme of the company the person is in (or looking at); null when there is none. */
    company: ThemeId | null
    /** Pick your own theme, or `null` to follow the company's. */
    setPersonal: (theme: ThemeId | null) => void
    /** Used by `CompanyTheme`; screens never call this directly. */
    setCompany: (theme: ThemeId | null) => void
}

const Context = createContext<ColorThemeContext | null>(null)

/**
 * Colour theme (separate from light/dark). Order: the person's own pick, then the company's
 * default, then Tangerine. The server renders `<html data-theme>` from cookies so a full page
 * load has no flash; this keeps `<html>` in step when the choice changes without a reload.
 */
export function ColorThemeProvider({
    personal: initialPersonal,
    company: initialCompany,
    children,
}: {
    personal: ThemeId | null
    company: ThemeId | null
    children: ReactNode
}) {
    const [personal, setPersonalState] = useState(initialPersonal)
    const [company, setCompany] = useState(initialCompany)
    const [prev, setPrev] = useState({ personal: initialPersonal, company: initialCompany })

    // New values from the server (after a refresh) replace the local ones.
    if (initialPersonal !== prev.personal || initialCompany !== prev.company) {
        setPrev({ personal: initialPersonal, company: initialCompany })
        if (initialPersonal !== prev.personal) setPersonalState(initialPersonal)
        if (initialCompany !== prev.company) setCompany(initialCompany)
    }

    const active = personal ?? company ?? DEFAULT_THEME

    useEffect(() => {
        document.documentElement.dataset.theme = active
    }, [active])

    const setPersonal = useCallback((theme: ThemeId | null) => {
        setPersonalState(theme)
        void setPersonalThemeAction(theme)
    }, [])

    const value = useMemo(
        () => ({ active, personal, company, setPersonal, setCompany }),
        [active, personal, company, setPersonal]
    )

    return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useColorTheme() {
    const value = useContext(Context)
    if (!value) throw new Error('useColorTheme must be used inside ColorThemeProvider')
    return value
}
