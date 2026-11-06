import 'server-only'

import { cache } from 'react'
import { cookies } from 'next/headers'
import { TOKEN_COOKIE } from '@/config/auth'
import { api } from '@/lib/api'

export type Workspace = {
    id: string
    name: string
    slug: string
    roleKey: string
    roleName: string
}

type MyCompany = {
    companyId: string
    name: string
    slug: string
    roleKey: string
    roleName: string
}

/** Companies the signed-in user is an active member of (GET /auth/companies). */
export const listWorkspaces = cache(async (): Promise<Workspace[]> => {
    const token = (await cookies()).get(TOKEN_COOKIE)?.value
    if (!token) return []
    const result = await api<MyCompany[]>('/auth/companies', { token })
    if (!result.ok) return []
    return result.data.map((c) => ({
        id: c.companyId,
        name: c.name,
        slug: c.slug,
        roleKey: c.roleKey,
        roleName: c.roleName,
    }))
})
