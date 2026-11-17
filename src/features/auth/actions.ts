'use server'

import { cookies } from 'next/headers'
import {
    ADMIN_SESSION_COOKIE,
    ADMIN_TOKEN_COOKIE,
    COMPANY_COOKIE,
    COMPANY_THEME_COOKIE,
    REFRESH_COOKIE,
    SESSION_COOKIE,
    TOKEN_COOKIE,
    WORKSPACE_COOKIE,
} from '@/config/auth'
import { api } from '@/lib/api'
import { setSessionCookies } from '@/lib/session-cookies'
import { refreshSession } from '@/lib/session-refresh'
import { tokenExpiresWithin } from '@/lib/token-refresh'
import { cookieOptions, REMEMBER_COMPANY, rememberCompanyTheme } from './login'
import { listWorkspaces } from '@/features/workspace/data'

/** The access token, renewed first if it has expired (a Server Action can set cookies, a page cannot). */
async function freshToken(store: Awaited<ReturnType<typeof cookies>>): Promise<string | undefined> {
    const token = store.get(TOKEN_COOKIE)?.value
    const refreshToken = store.get(REFRESH_COOKIE)?.value
    if (!refreshToken || !tokenExpiresWithin(token, 20_000)) return token
    const outcome = await refreshSession(refreshToken)
    if (outcome.ok) {
        setSessionCookies(store, outcome.tokens)
        return outcome.tokens.token
    }
    return outcome.definitive ? undefined : token
}

/** Switch the active company (POST /auth/switch-company) and remember it. */
export async function selectWorkspaceAction(id: string): Promise<boolean> {
    const store = await cookies()
    const token = await freshToken(store)
    if (!token) return false

    const result = await api<{ token: string; tokenExpires: number }>('/auth/switch-company', {
        token,
        body: { companyId: id },
    })
    if (!result.ok) return false

    // The refresh token is unchanged: the backend keeps the new company on the session it belongs to.
    setSessionCookies(store, { token: result.data.token })
    store.set(WORKSPACE_COOKIE, id, cookieOptions)
    const workspace = (await listWorkspaces()).find((w) => w.id === id)
    if (workspace) store.set(COMPANY_COOKIE, workspace.slug, REMEMBER_COMPANY)
    await rememberCompanyTheme(result.data.token)
    return true
}

export async function logoutAction() {
    const store = await cookies()
    const token = store.get(TOKEN_COOKIE)?.value
    if (token) await api('/auth/logout', { method: 'POST', token })
    store.delete(TOKEN_COOKIE)
    store.delete(REFRESH_COOKIE)
    store.delete(SESSION_COOKIE)
    store.delete(WORKSPACE_COOKIE)
    // The company theme belongs to the session that is ending.
    store.delete(COMPANY_THEME_COOKIE)
}

export async function adminLogoutAction() {
    const store = await cookies()
    store.delete(ADMIN_SESSION_COOKIE)
    store.delete(ADMIN_TOKEN_COOKIE)
}
