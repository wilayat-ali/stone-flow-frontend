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
import { cookieOptions, REMEMBER_COMPANY, rememberCompanyTheme } from './login'
import { listWorkspaces } from '@/features/workspace/data'

/** Switch the active company (POST /auth/switch-company) and remember it. */
export async function selectWorkspaceAction(id: string): Promise<boolean> {
    const store = await cookies()
    const token = store.get(TOKEN_COOKIE)?.value
    if (!token) return false

    const result = await api<{ token: string; tokenExpires: number }>('/auth/switch-company', {
        token,
        body: { companyId: id },
    })
    if (!result.ok) return false

    store.set(TOKEN_COOKIE, result.data.token, {
        ...cookieOptions,
        expires: new Date(result.data.tokenExpires),
    })
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
