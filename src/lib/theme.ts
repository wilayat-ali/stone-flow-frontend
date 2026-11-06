import 'server-only'

import { cache } from 'react'
import { cookies } from 'next/headers'
import { COMPANY_THEME_COOKIE, THEME_COOKIE, TOKEN_COOKIE, WORKSPACE_COOKIE } from '@/config/auth'
import { DEFAULT_THEME, isThemeId, type ThemeId } from '@/config/themes'
import { api } from '@/lib/api'

export type ThemeChoice = {
    /** What the screen shows: the person's own pick, else the company default, else Tangerine. */
    active: ThemeId
    /** The person's own pick on this device, if any. */
    personal: ThemeId | null
    /** Default theme of the company the person is signed in to, if we know it. */
    company: ThemeId | null
}

/** Cookie value that ties a theme to one company: `<companyId>|<theme>`. */
export const companyThemeCookie = (companyId: string, theme: string) => `${companyId}|${theme}`

/**
 * Used to render `<html data-theme>` on a full page load. The company theme only counts when the
 * person is signed in AND the cookie belongs to the company they are in, so a theme left behind by
 * another company (or by a previous login) is ignored.
 */
export async function getThemeChoice(): Promise<ThemeChoice> {
    const store = await cookies()
    const personal = store.get(THEME_COOKIE)?.value
    const personalId = isThemeId(personal) ? personal : null

    let companyTheme: ThemeId | null = null
    const signedIn = store.has(TOKEN_COOKIE)
    const workspace = store.get(WORKSPACE_COOKIE)?.value
    const [cookieCompany, cookieTheme] = (store.get(COMPANY_THEME_COOKIE)?.value ?? '').split('|')
    if (signedIn && workspace && cookieCompany === workspace && isThemeId(cookieTheme)) {
        companyTheme = cookieTheme
    }

    return { active: personalId ?? companyTheme ?? DEFAULT_THEME, personal: personalId, company: companyTheme }
}

/** The signed-in person's company default theme, straight from the backend (null if none). */
export const getCompanyTheme = cache(async (): Promise<ThemeId | null> => {
    const token = (await cookies()).get(TOKEN_COOKIE)?.value
    if (!token) return null
    const me = await api<{ company: { theme?: string | null } }>('/company/me', { token })
    const theme = me.ok ? me.data.company.theme : null
    return isThemeId(theme) ? theme : DEFAULT_THEME
})
