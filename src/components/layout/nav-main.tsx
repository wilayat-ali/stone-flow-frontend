'use client'

import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar'
import { isNavItemActive, type NavGroup } from '@/config/nav'
import { pendingCount, pendingCountKey } from '@/features/approvals/api'
import { customerChequesQueryKey, dueChequeCount } from '@/features/customer-payments'

/** Based on the shadcn `sidebar-07` NavMain, fed from `config/nav.ts`. */
export function NavMain({ groups }: { groups: NavGroup[] }) {
    const t = useTranslations('nav')
    const pathname = usePathname()

    // Only asked for when this role's menu has the Approvals item (the backend refuses everyone else).
    const showsApprovals = groups.some((group) => group.items.some((item) => item.count === 'approvals'))
    const pending = useQuery({
        queryKey: pendingCountKey,
        queryFn: pendingCount,
        enabled: showsApprovals,
        refetchInterval: 60_000,
    })

    // Customer cheques whose date has come: deposit them.
    const showsCheques = groups.some((group) => group.items.some((item) => item.count === 'cheques'))
    const dueCheques = useQuery({
        queryKey: [customerChequesQueryKey, 'due-count'],
        queryFn: dueChequeCount,
        enabled: showsCheques,
        refetchInterval: 60_000,
    })

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
                                    isActive={isNavItemActive(item, pathname)}
                                >
                                    <Link href={item.href}>
                                        <item.icon />
                                        <span>{t(item.titleKey)}</span>
                                    </Link>
                                </SidebarMenuButton>
                                {item.count === 'cheques' && !!dueCheques.data && <SidebarMenuBadge>{dueCheques.data}</SidebarMenuBadge>}
                                {item.count === 'approvals' && !!pending.data && (
                                    <SidebarMenuBadge>{pending.data}</SidebarMenuBadge>
                                )}
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarGroup>
            ))}
        </>
    )
}
