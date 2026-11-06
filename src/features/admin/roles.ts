/** Company roles seeded by the backend for every company (system roles). */
export const roleKeys = ['owner', 'partner', 'manager', 'munshi', 'viewer'] as const

export type RoleKey = (typeof roleKeys)[number]

export const isRoleKey = (value: string | undefined): value is RoleKey =>
    roleKeys.includes(value as RoleKey)

/** Who sees the Administration area at all. */
export const ADMIN_VIEW_ROLES: RoleKey[] = ['owner', 'partner', 'manager']

/** Who may invite, change roles and (de)activate people. Mirrors the backend. */
export const ADMIN_MANAGE_ROLES: RoleKey[] = ['owner', 'partner']

/** Company settings (including bank and cash): no settings or bank setup for Manager, Munshi or Viewer. */
export const SETTINGS_ROLES: RoleKey[] = ['owner', 'partner']

export const canViewSettings = (role: string | undefined) =>
    isRoleKey(role) && SETTINGS_ROLES.includes(role)

export const canViewAdmin = (role: string | undefined) =>
    isRoleKey(role) && ADMIN_VIEW_ROLES.includes(role)

export const canManageMembers = (role: string | undefined) =>
    isRoleKey(role) && ADMIN_MANAGE_ROLES.includes(role)

/** Roles an actor may invite or assign. Nobody is made Owner. */
export function assignableRoles(actor: string | undefined): RoleKey[] {
    if (actor === 'owner') return ['partner', 'manager', 'munshi', 'viewer']
    if (actor === 'partner') return ['manager', 'munshi', 'viewer']
    return []
}

/** Whether `actor` may act on a member who has the `target` role. */
export function canManageTarget(actor: string | undefined, target: string): boolean {
    if (target === 'owner') return false
    if (actor === 'owner') return true
    if (actor === 'partner') return target !== 'partner'
    return false
}
