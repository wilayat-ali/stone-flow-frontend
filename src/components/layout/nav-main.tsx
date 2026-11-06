'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar'
import type { NavGroup } from '@/config/nav'

/** Based on the shadcn `sidebar-07` NavMain, fed from `config/nav.ts`. */
export function NavMain({ groups }: { groups: NavGroup[] }) {
    const t = useTranslations('nav')
    const pathname = usePathname()

    const isActive = (href: string) =>
        pathname === href || pathname.startsWith(`${href}/`)

    return (
        <>
            {groups.map((group) => (
                <SidebarGroup key={group.labelKey}>
                    <SidebarGroupLabel>{t(group.labelKey)}</SidebarGroupLabel>
                    <SidebarMenu>
                        {group.items.map((item) => (
                            <SidebarMenuItem key={item.href}>
                                <SidebarMenuButton
                                    asChild
                                    tooltip={t(item.titleKey)}
                                    isActive={isActive(item.href)}
                                >
                                    <Link href={item.href}>
                                        <item.icon />
                                        <span>{t(item.titleKey)}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarGroup>
            ))}
        </>
    )
}
