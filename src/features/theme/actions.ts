'use server'

import { cookies } from 'next/headers'
import { THEME_COOKIE } from '@/config/auth'
import { isThemeId } from '@/config/themes'

/** Remember the person's own colour theme on this device; `null` goes back to the company's theme. */
export async function setPersonalThemeAction(theme: string | null) {
    const store = await cookies()
    if (isThemeId(theme)) {
        store.set(THEME_COOKIE, theme, {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 365,
        })
    } else {
        store.delete(THEME_COOKIE)
    }
}
