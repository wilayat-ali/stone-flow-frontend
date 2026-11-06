import {
    Building2,
    LayoutDashboard,
    LayoutGrid,
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
                icon: Settings,
                roles: SETTINGS_ROLES,
            },
        ],
    },
    {
        labelKey: 'administration',
        roles: ADMIN_VIEW_ROLES,
        items: [
            {
                titleKey: 'adminOverview',
                href: '/admin-center/overview',
                icon: LayoutGrid,
            },
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
