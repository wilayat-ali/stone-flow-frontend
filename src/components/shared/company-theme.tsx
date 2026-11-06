'use client'

import { useEffect } from 'react'
import type { ThemeId } from '@/config/themes'
import { useColorTheme } from '@/providers/color-theme-provider'

/**
 * Declares "this part of the app belongs to a company with this default theme". While it is on
 * screen the company theme applies; when it goes away (logout, another company) it is cleared, so
 * one company's theme can never show on another company's screens.
 */
export function CompanyTheme({ theme }: { theme: ThemeId | null }) {
    const { setCompany } = useColorTheme()

    useEffect(() => {
        setCompany(theme)
        return () => setCompany(null)
    }, [theme, setCompany])

    return null
}
