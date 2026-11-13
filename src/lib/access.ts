import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { TOKEN_COOKIE } from '@/config/auth'
import type { Permission } from '@/features/admin/permissions'
import { api } from '@/lib/api'

export type Access = { roleKey: string; permissions: Permission[] }

/** The signed-in person's role and permissions, as the backend reads them now (undefined if it cannot be reached). */
export const getAccess = cache(async (): Promise<Access | undefined> => {
    const token = (await cookies()).get(TOKEN_COOKIE)?.value
    if (!token) return undefined
    const me = await api<{ me: Access }>('/company/me', { token })
    return me.ok ? { roleKey: me.data.me.roleKey, permissions: me.data.me.permissions } : undefined
})
