import 'server-only'

import { cookies } from 'next/headers'
import { DEFAULT_THEME, isThemeId } from '@/config/themes'
import {
    COMPANY_COOKIE,
    COMPANY_THEME_COOKIE,
    REFRESH_COOKIE,
    SESSION_COOKIE,
    TOKEN_COOKIE,
    WORKSPACE_COOKIE,
} from '@/config/auth'
import { api } from '@/lib/api'
import { companyThemeCookie } from '@/lib/theme'
import { serializeSession } from '@/lib/session'

export const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
}

export const REMEMBER_COMPANY = { ...cookieOptions, maxAge: 60 * 60 * 24 * 365 }

export const nameFromEmail = (email: string) =>
    email
        .split('@')[0]
        .replace(/[._-]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())

export type LoginResponse = {
    token: string
    refreshToken: string
    tokenExpires: number
    user: { firstName?: string | null; lastName?: string | null; email?: string | null }
}

export type LoginError = 'invalid' | 'throttled' | 'unavailable'

export type LoginResult = { ok: true } | { ok: false; error: LoginError }

/**
 * Company-scoped login (POST /auth/workspace/login). The backend answers every
 * failure with the same 401, so the form cannot say which part was wrong.
 * Tokens go into httpOnly cookies and never into the response body.
 */
export async function loginWithCompany(input: {
    company: string
    identifier: string
    password: string
}): Promise<LoginResult> {
    const result = await api<LoginResponse>('/auth/workspace/login', {
        body: {
            slug: input.company,
            identifier: input.identifier,
            password: input.password,
        },
    })
    if (!result.ok) {
        if (result.status === 401 || result.status === 422) return { ok: false, error: 'invalid' }
        if (result.status === 429) return { ok: false, error: 'throttled' }
        return { ok: false, error: 'unavailable' }
    }

    await startSession(result.data, input.company, input.identifier)
    return { ok: true }
}

/** Stores a backend login response in httpOnly cookies; the active workspace is `company`. */
export async function startSession(data: LoginResponse, company: string, fallbackEmail: string) {
    const { token, refreshToken, tokenExpires, user } = data
    const email = user.email ?? fallbackEmail
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || nameFromEmail(email)
    const store = await cookies()
    store.set(TOKEN_COOKIE, token, { ...cookieOptions, expires: new Date(tokenExpires) })
    store.set(REFRESH_COOKIE, refreshToken, cookieOptions)
    store.set(SESSION_COOKIE, serializeSession({ name, email }), cookieOptions)
    // Remembered so an expired session returns to this company's login page.
    store.set(COMPANY_COOKIE, company, REMEMBER_COMPANY)

    // The login is already scoped to this company, so it is the active workspace.
    const companies = await api<{ companyId: string; slug: string }[]>('/auth/companies', { token })
    const active = companies.ok ? companies.data.find((c) => c.slug === company) : undefined
    if (active) store.set(WORKSPACE_COOKIE, active.companyId, cookieOptions)
    else store.delete(WORKSPACE_COOKIE)

    await rememberCompanyTheme(token)
}

/** Remembers the company's default colour theme (from GET /company/me), tied to that company, so a full page load can render it. */
export async function rememberCompanyTheme(token: string) {
    const me = await api<{ company: { id: string; theme?: string | null } }>('/company/me', { token })
    const store = await cookies()
    if (me.ok) {
        const { id, theme } = me.data.company
        store.set(COMPANY_THEME_COOKIE, companyThemeCookie(id, isThemeId(theme) ? theme : DEFAULT_THEME), REMEMBER_COMPANY)
    } else {
        store.delete(COMPANY_THEME_COOKIE)
    }
}
