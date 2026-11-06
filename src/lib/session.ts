import { cookies } from 'next/headers'
import {
    ADMIN_SESSION_COOKIE,
    ADMIN_TOKEN_COOKIE,
    SESSION_COOKIE,
    TOKEN_COOKIE,
    WORKSPACE_COOKIE,
} from '@/config/auth'
import { listWorkspaces, type Workspace } from '@/features/workspace/data'

export type Session = { name: string; email: string; role?: string }

const parse = <T>(value?: string): T | null => {
    if (!value) return null
    try {
        return JSON.parse(decodeURIComponent(value)) as T
    } catch {
        return null
    }
}

// The signed-in user is only valid while the backend token cookie is.
export async function getSession(): Promise<Session | null> {
    const store = await cookies()
    if (!store.has(TOKEN_COOKIE)) return null
    return parse<Session>(store.get(SESSION_COOKIE)?.value)
}

export async function getAdminSession(): Promise<Session | null> {
    const store = await cookies()
    if (!store.has(ADMIN_TOKEN_COOKIE)) return null
    return parse<Session>(store.get(ADMIN_SESSION_COOKIE)?.value)
}

export async function getActiveWorkspace(): Promise<Workspace | null> {
    const store = await cookies()
    const id = store.get(WORKSPACE_COOKIE)?.value
    if (!id) return null
    return (await listWorkspaces()).find((workspace) => workspace.id === id) ?? null
}

export const serializeSession = (session: Session) =>
    encodeURIComponent(JSON.stringify(session))
