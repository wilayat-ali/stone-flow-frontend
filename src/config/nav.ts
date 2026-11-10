import {
    Building2,
    LayoutDashboard,
    Palette,
    Settings,
    ShieldCheck,
    Users,
    type LucideIcon,
} from 'lucide-react'
import { ADMIN_MANAGE_ROLES, ADMIN_VIEW_ROLES, SETTINGS_ROLES, type RoleKey } from '@/features/admin/roles'
import type en from '@/messages/en.json'

export type NavKey = keyof typeof en.nav

export type NavItem = {
    titleKey: NavKey
    href: string
    icon: LucideIcon
    badge?: 'new' | 'pro'
    /** Limits who sees this item; omit it to show it to everyone who sees the group. */
    roles?: RoleKey[]
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

/** `roles` limits who sees the group; omit it to show it to everyone. */
export type NavGroup = { labelKey: NavKey; items: NavItem[]; roles?: RoleKey[] }

export const appNav: NavGroup[] = [
    {
        labelKey: 'home',
        items: [
            {
                titleKey: 'dashboard',
                href: '/dashboard',
                icon: LayoutDashboard,
                badge: 'new',
            },
            {
                titleKey: 'settings',
                href: '/settings/bank-cash',
                match: '/settings',
                icon: Settings,
                roles: SETTINGS_ROLES,
            },
        ],
    },
    {
        labelKey: 'administration',
        roles: ADMIN_VIEW_ROLES,
        items: [
            { titleKey: 'users', href: '/admin-center/users', icon: Users },
            {
                titleKey: 'roles',
                href: '/admin-center/roles',
                icon: ShieldCheck,
            },
            {
                titleKey: 'branding',
                href: '/admin-center/branding',
                icon: Palette,
                roles: ADMIN_MANAGE_ROLES,
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

/** The groups and items this role may see. */
export function visibleNav(groups: NavGroup[], roleKey: string | undefined): NavGroup[] {
    const allowed = (roles?: RoleKey[]) => !roles || (roleKey !== undefined && (roles as string[]).includes(roleKey))
    return groups
        .filter((group) => allowed(group.roles))
        .map((group) => ({ ...group, items: group.items.filter((item) => allowed(item.roles)) }))
}
