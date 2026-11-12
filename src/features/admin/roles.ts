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

/**
 * Suppliers: Owner, Partner and Manager add and edit; a Munshi may add (the entry waits for approval
 * when it is on); a Viewer only looks. Kept here, with the other role lists, so the permission matrix
 * on the Roles page can replace them in one place.
 */
export const SUPPLIERS_MANAGE_ROLES: RoleKey[] = ['owner', 'partner', 'manager']
export const SUPPLIERS_CREATE_ROLES: RoleKey[] = [...SUPPLIERS_MANAGE_ROLES, 'munshi']

export const canManageSuppliers = (role: string | undefined) =>
    isRoleKey(role) && SUPPLIERS_MANAGE_ROLES.includes(role)

export const canCreateSuppliers = (role: string | undefined) =>
    isRoleKey(role) && SUPPLIERS_CREATE_ROLES.includes(role)

/**
 * Purchases: the same people who add suppliers enter trucks (a Munshi's wait for approval when it is
 * on). Only Owner, Partner and Manager approve, reject, edit after approval or cancel.
 */
export const canEnterPurchases = canCreateSuppliers
export const canApprovePurchases = canManageSuppliers

/** Production: everyone who enters purchases also sends trucks to machines and finishes them. */
export const canOperateProduction = canCreateSuppliers

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

/**
 * Expenses: whoever enters purchases records them (a Munshi's wait for approval when it is on, and he
 * pays from Munshi cash). Approving, cancelling, paying a bill and giving cash to the munshi are the
 * Owner, Partner and Manager's.
 */
export const canEnterExpenses = canCreateSuppliers
export const canManageExpenses = canManageSuppliers

/** Closing a month locks it: Owner and Partner only. Re-opening it is the Owner's alone, and logged. */
export const canCloseMonth = canManageMembers
export const canReopenMonth = (role: string | undefined) => role === 'owner'
