import {
    Building2,
    Contact,
    Boxes,
    ClipboardCheck,
    Factory,
    ShoppingCart,
    Truck,
    LayoutDashboard,
    Palette,
    Receipt,
    Wallet,
    Settings,
    ShieldCheck,
    Users,
    type LucideIcon,
} from 'lucide-react'
import { hasAnyPermission } from '@/features/admin/role-store'
import type { Permission } from '@/features/admin/permissions'
import type en from '@/messages/en.json'

export type NavKey = keyof typeof en.nav

export type NavItem = {
    titleKey: NavKey
    href: string
    icon: LucideIcon
    badge?: 'new' | 'pro'
    /** Shows a live count next to the title, e.g. entries waiting for approval. */
    count?: 'approvals' | 'cheques'
    /** Shown to roles holding any of these permissions; omit it to show it to everyone who sees the group. */
    permission?: Permission | Permission[]
    /**
     * Path prefix this item counts as active for, when `href` only points at one sub-page
     * of a wider section (e.g. Settings always opens on Bank & Cash, but every settings tab
     * should still highlight it and show its title). Defaults to `href`.
     */
    match?: string
}

/** The path(s) a nav item should be treated as active for. */
export const navItemMatch = (item: NavItem) => item.match ?? item.href

export const isNavItemActive = (item: NavItem, pathname: string) => {
    const base = navItemMatch(item)
    return pathname === base || pathname.startsWith(`${base}/`)
}

/** `permission` limits who sees the group; omit it to show it to everyone. */
export type NavGroup = { labelKey: NavKey; items: NavItem[]; permission?: Permission | Permission[] }

export const appNav: NavGroup[] = [
    {
        labelKey: 'home',
        items: [
            {
                titleKey: 'dashboard',
                href: '/dashboard',
                icon: LayoutDashboard,
                badge: 'new',
                permission: 'dashboard.view',
            },
            {
                titleKey: 'suppliers',
                href: '/suppliers',
                icon: Truck,
                permission: 'suppliers.view',
            },
            {
                titleKey: 'purchasing',
                href: '/purchasing',
                icon: ShoppingCart,
                permission: 'purchasing.view',
            },
            {
                titleKey: 'production',
                href: '/production',
                icon: Factory,
                permission: 'production.view',
            },
            {
                titleKey: 'inventory',
                href: '/inventory',
                icon: Boxes,
                permission: 'inventory.view',
            },
            {
                titleKey: 'customers',
                href: '/customers',
                icon: Contact,
                permission: 'customers.view',
            },
            {
                titleKey: 'sales',
                href: '/sales',
                icon: Receipt,
                count: 'cheques',
                permission: 'sales.view',
            },
            {
                titleKey: 'expenses',
                href: '/expenses',
                icon: Wallet,
                permission: 'expenses.view',
            },
            {
                titleKey: 'approvals',
                href: '/approvals',
                icon: ClipboardCheck,
                count: 'approvals',
                permission: 'approvals.view',
            },
            {
                titleKey: 'settings',
                href: '/settings/bank-cash',
                match: '/settings',
                icon: Settings,
                permission: 'settings.view',
            },
        ],
    },
    {
        labelKey: 'administration',
        permission: ['users.view', 'roles.view', 'branding.manage'],
        items: [
            { titleKey: 'users', href: '/admin-center/users', icon: Users, permission: 'users.view' },
            {
                titleKey: 'roles',
                href: '/admin-center/roles',
                icon: ShieldCheck,
                permission: 'roles.view',
            },
            {
                titleKey: 'branding',
                href: '/admin-center/branding',
                icon: Palette,
                permission: 'branding.manage',
            },
        ],
    },
]

export const superAdminNav: NavGroup[] = [
    {
        labelKey: 'platform',
        items: [
            {
                titleKey: 'superAdminHome',
                href: '/s-admin/home',
                icon: LayoutDashboard,
            },
            {
                titleKey: 'workspaces',
                href: '/s-admin/workspaces',
                icon: Building2,
            },
        ],
    },
]

/** Whether this role may see an item or group with this `permission`. */
export const isNavAllowed = (permission: Permission | Permission[] | undefined, roleKey: string | undefined) =>
    !permission || hasAnyPermission(roleKey, Array.isArray(permission) ? permission : [permission])

/** The groups and items this role may see. */
export function visibleNav(groups: NavGroup[], roleKey: string | undefined): NavGroup[] {
    return groups
        .filter((group) => isNavAllowed(group.permission, roleKey))
        .map((group) => ({ ...group, items: group.items.filter((item) => isNavAllowed(item.permission, roleKey)) }))
}
