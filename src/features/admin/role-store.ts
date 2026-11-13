import { request } from '@/lib/client-api'
import type { Permission } from './permissions'

export type Role = {
    key: string
    /** The five starting roles come with English names; the screens translate them until someone renames one. */
    name: string
    description: string
    permissions: Permission[]
    /** One of the five roles every company starts with. They can be edited like any other, except Owner. */
    builtin: boolean
    /** Everyone who has the role (any status) plus pending invitations: what blocks deleting it. */
    memberCount: number
}

export type RoleInput = { name: string; description: string; permissions: Permission[] }

export type MyAccess = { roleKey: string; permissions: Permission[] }

/** The Owner always keeps everything, so a company can never lock itself out. */
export const OWNER_ROLE = 'owner'

export const rolesQueryKey = ['roles'] as const
export const myAccessKey = ['my-access'] as const

const base = '/api/company'

// What the screens read while rendering. The backend is the source of truth; these hold its last answer so every
// `can…` check can stay synchronous. Browser only: the app shell fills them after the first render.
let roles: Role[] = []
let mine: MyAccess | null = null

let version = 0
const listeners = new Set<() => void>()

const notify = () => {
    version += 1
    listeners.forEach((listener) => listener())
}

/** For `useSyncExternalStore`: screens re-read permissions whenever the roles or my access change. */
export const subscribeRoles = (listener: () => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
}
export const rolesVersion = () => version
/** False on the server and until the signed-in person's permissions are known. */
export const rolesReady = () => mine !== null

export const setMyAccess = (access: MyAccess) => {
    if (mine && mine.roleKey === access.roleKey && mine.permissions.join() === access.permissions.join()) return
    mine = access
    notify()
}

export const allRoles = () => roles
export const roleByKey = (key: string | undefined) => roles.find((r) => r.key === key)

/**
 * Permissions of a role. Pages pass the signed-in person's role key (it can be stale if their role was changed
 * after login), so their own role, or one the list does not know, is answered from `my-access`.
 */
export const permissionsOf = (roleKey: string | undefined): readonly string[] => {
    if (mine && (roleKey === undefined || roleKey === mine.roleKey || !roleByKey(roleKey))) return mine.permissions
    return roleByKey(roleKey)?.permissions ?? []
}

export const hasPermission = (roleKey: string | undefined, permission: Permission) => permissionsOf(roleKey).includes(permission)

export const hasAnyPermission = (roleKey: string | undefined, permissions: Permission[]) =>
    permissions.some((p) => hasPermission(roleKey, p))

export async function listRoles(): Promise<Role[]> {
    const data = await request<Role[]>(`${base}/roles`)
    if (JSON.stringify(data) !== JSON.stringify(roles)) {
        roles = data
        notify()
    }
    return data
}

export const getMyAccess = async (): Promise<MyAccess> => {
    const { me } = await request<{ me: MyAccess }>(`${base}/me`)
    return { roleKey: me.roleKey, permissions: me.permissions }
}

export const createRole = (input: RoleInput) => request<Role>(`${base}/roles`, { body: input })

export const updateRole = (key: string, input: RoleInput) =>
    request<Role>(`${base}/roles/${encodeURIComponent(key)}`, { method: 'PATCH', body: input })

export const deleteRole = (key: string) => request<unknown>(`${base}/roles/${encodeURIComponent(key)}`, { method: 'DELETE' })
