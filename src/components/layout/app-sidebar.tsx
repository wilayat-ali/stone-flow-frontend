'use client'

import type { ComponentProps } from 'react'
import { Layers } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from '@/components/ui/sidebar'
import { appNav, superAdminNav, visibleNav } from '@/config/nav'
import type { Workspace } from '@/features/workspace/data'
import { useDirection } from '@/hooks/use-direction'
import { NavMain } from './nav-main'
import { UserMenu } from './user-menu'
import { WorkspaceSwitcher } from './workspace-switcher'

export type AppSidebarProps = {
    variant: 'app' | 'superAdmin'
    user: { name: string; email: string }
    workspaces?: Workspace[]
    activeWorkspaceId?: string
    roleKey?: string
} & Omit<ComponentProps<typeof Sidebar>, 'variant'>

/** shadcn sidebar-07 structure with the dashboard-01 inset look; collapses to an icon rail. */
export function AppSidebar({
    variant,
    user,
    workspaces = [],
    activeWorkspaceId,
    roleKey,
    ...props
}: AppSidebarProps) {
    const t = useTranslations('nav')
    const tc = useTranslations('common')
    const { isRtl } = useDirection()

    return (
        <Sidebar
            variant="inset"
            collapsible="icon"
            side={isRtl ? 'right' : 'left'}
            {...props}
        >
            <SidebarHeader>
                {variant === 'app' && activeWorkspaceId ? (
                    <WorkspaceSwitcher
                        workspaces={workspaces}
                        activeId={activeWorkspaceId}
                    />
                ) : (
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton size="lg" asChild>
                                <div>
                                    <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                                        <Layers className="size-4" />
                                    </div>
                                    <div className="grid flex-1 text-start text-sm leading-tight">
                                        <span className="truncate font-medium">
                                            {tc('appName')}
                                        </span>
                                        <span className="truncate text-xs">
                                            {t('superAdmin')}
                                        </span>
                                    </div>
                                </div>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                )}
            </SidebarHeader>
            <SidebarContent className="overflow-x-hidden">
                <NavMain
                    groups={variant === 'app' ? visibleNav(appNav, roleKey) : superAdminNav}
                />
            </SidebarContent>
            <SidebarFooter>
                <UserMenu user={user} variant={variant} />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    )
}
