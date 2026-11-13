/**
 * Everything a role can be allowed to do, grouped by module. A permission is `module.action`.
 * Add a module or action here, give it labels under `admin.roles.permissions` in both message
 * files, and check it with `hasPermission`.
 */
export const permissionCatalog = {
    dashboard: ['view'],
    suppliers: ['view', 'create', 'manage'],
    purchasing: ['view', 'create', 'approve'],
    production: ['view', 'operate', 'reverse'],
    inventory: ['view', 'viewValue'],
    customers: ['view', 'create', 'edit', 'editOpening'],
    sales: ['view', 'create', 'manage'],
    expenses: ['view', 'create', 'manage'],
    monthEnd: ['close', 'reopen'],
    approvals: ['view', 'configure'],
    settings: ['view'],
    users: ['view', 'manage'],
    roles: ['view', 'manage'],
    branding: ['manage'],
} as const

type Catalog = typeof permissionCatalog

export type PermissionModule = keyof Catalog
export type Permission = { [M in PermissionModule]: `${M}.${Catalog[M][number]}` }[PermissionModule]

export const permissionModules = Object.keys(permissionCatalog) as PermissionModule[]

export const allPermissions = permissionModules.flatMap((module) =>
    (permissionCatalog[module] as readonly string[]).map((action) => `${module}.${action}`)
) as Permission[]

export const modulePermissions = (module: PermissionModule) =>
    (permissionCatalog[module] as readonly string[]).map((action) => `${module}.${action}` as Permission)

const views: Permission[] = [
    'dashboard.view',
    'suppliers.view',
    'purchasing.view',
    'production.view',
    'inventory.view',
    'customers.view',
    'sales.view',
    'expenses.view',
]

/** What the five roles every company starts with are allowed to do. */
export const defaultPermissions: Record<string, Permission[]> = {
    owner: allPermissions,
    partner: allPermissions.filter((p) => p !== 'roles.manage' && p !== 'monthEnd.reopen'),
    manager: [
        ...views,
        'suppliers.create',
        'suppliers.manage',
        'purchasing.create',
        'purchasing.approve',
        'production.operate',
        'customers.create',
        'customers.edit',
        'sales.create',
        'sales.manage',
        'expenses.create',
        'expenses.manage',
        'approvals.view',
        'users.view',
        'roles.view',
    ],
    munshi: [
        ...views,
        'suppliers.create',
        'purchasing.create',
        'production.operate',
        'customers.create',
        'sales.create',
        'expenses.create',
    ],
    viewer: views,
}
