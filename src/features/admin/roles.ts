import type { Permission } from './permissions'
import { allRoles, hasAnyPermission, hasPermission, permissionsOf as permissionsOfRole } from './role-store'

/**
 * Role checks. Every one reads the signed-in person's role permissions (edited on the Roles page),
 * so a page never decides access on its own: it calls one of these.
 */
export type RoleKey = string

const has =
    (permission: Permission) =>
    (role: string | undefined) =>
        hasPermission(role, permission)

/** Who sees the Administration area at all. */
export const canViewAdmin = (role: string | undefined) => hasAnyPermission(role, ['users.view', 'roles.view', 'branding.manage'])

/** Who may invite, change roles and (de)activate people. Mirrors the backend. */
export const canManageMembers = has('users.manage')

/** Company settings (including bank and cash). */
export const canViewSettings = has('settings.view')

export const canManageRoles = has('roles.manage')
export const canConfigureApprovals = has('approvals.configure')

export const canManageSuppliers = has('suppliers.manage')
export const canCreateSuppliers = has('suppliers.create')

export const canEnterPurchases = has('purchasing.create')
export const canApprovePurchases = has('purchasing.approve')

export const canOperateProduction = has('production.operate')
export const canReverseProduction = has('production.reverse')

export const canViewInventoryValue = has('inventory.viewValue')

export const canCreateCustomers = has('customers.create')
export const canEditCustomers = has('customers.edit')
export const canEditCustomerOpening = has('customers.editOpening')

export const canCreateSales = has('sales.create')
export const canManageSales = has('sales.manage')

/** A Munshi's expenses wait for approval when it is on, and he pays from Munshi cash. */
export const canEnterExpenses = has('expenses.create')
export const canManageExpenses = has('expenses.manage')

/** Closing a month locks it; re-opening it is logged. */
export const canCloseMonth = has('monthEnd.close')
export const canReopenMonth = has('monthEnd.reopen')

const permissionsOf = (key: string) => new Set(permissionsOfRole(key))

/** `target` is a strict subset of `actor`: they hold less power than the person acting. */
const holdsLess = (actor: string, target: string) => {
    const mine = permissionsOf(actor)
    const theirs = permissionsOf(target)
    return theirs.size < mine.size && [...theirs].every((p) => mine.has(p))
}

/** Roles an actor may invite or assign: never Owner, and never one as powerful as their own. */
export function assignableRoles(actor: string | undefined): RoleKey[] {
    if (!actor || !canManageMembers(actor)) return []
    return allRoles()
        .filter((role) => role.key !== 'owner' && (actor === 'owner' || holdsLess(actor, role.key)))
        .map((role) => role.key)
}

/** Whether `actor` may act on a member who has the `target` role. */
export function canManageTarget(actor: string | undefined, target: string): boolean {
    if (!actor || target === 'owner' || !canManageMembers(actor)) return false
    return actor === 'owner' || holdsLess(actor, target)
}
