'use client'

import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ShieldOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { usePathname } from '@/i18n/navigation'
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { EmptyState } from '@/components/shared/empty-state'
import { appNav, isNavAllowed, isNavItemActive, superAdminNav } from '@/config/nav'
import { getMyAccess, myAccessKey, setMyAccess, type MyAccess } from '@/features/admin/role-store'
import { useRolesReady, useRolesVersion } from '@/features/admin/use-roles'
import type { Workspace } from '@/features/workspace/data'
import { AppSidebar } from './app-sidebar'
import { LanguageSwitcher } from './language-switcher'
import { ThemeToggle } from './theme-toggle'

export type AppShellProps = {
    variant: 'app' | 'superAdmin'
    user: { name: string; email: string }
    workspaces?: Workspace[]
    activeWorkspaceId?: string
    roleKey?: string
    /** The signed-in person's permissions as the server read them; refreshed in the browser. */
    access?: MyAccess
    children: ReactNode
}

/** Page shell from the shadcn dashboard-01 block. Shared by every authenticated area. */
export function AppShell({ children, access, ...sidebarProps }: AppShellProps) {
    const t = useTranslations('nav')
    const ta = useTranslations('access')
    const rolesReady = useRolesReady()
    const myAccess = useQuery({ queryKey: myAccessKey, queryFn: getMyAccess, initialData: access, enabled: !!access })
    useEffect(() => {
        // No answer from the backend: show the no-access notice instead of a blank page.
        if (myAccess.data) setMyAccess(myAccess.data)
        else if (sidebarProps.variant === 'app') setMyAccess({ roleKey: sidebarProps.roleKey ?? '', permissions: [] })
    }, [myAccess.data, sidebarProps.variant, sidebarProps.roleKey])
    useRolesVersion()
    const pathname = usePathname()
    const groups = sidebarProps.variant === 'app' ? appNav : superAdminNav

    const activeItem = groups
        .flatMap((group) => group.items)
        .find((item) => isNavItemActive(item, pathname))

    // A page the role may not see (typed URL, or the role was just edited) shows a notice, not the page.
    const allowed = sidebarProps.variant !== 'app' || isNavAllowed(activeItem?.permission, sidebarProps.roleKey)

    return (
        <SidebarProvider
            style={
                {
                    '--sidebar-width': 'calc(var(--spacing) * 72)',
                    '--header-height': 'calc(var(--spacing) * 12)',
                } as CSSProperties
            }
        >
            <AppSidebar {...sidebarProps} />
            {/* The inset card scrolls (not the page) so the header can stay pinned inside it. */}
            <SidebarInset className="h-svh min-w-0 overflow-y-auto md:min-h-0 md:h-[calc(100svh-1rem)]">
                <header className="bg-background sticky top-0 z-20 flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
                    <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
                        <SidebarTrigger className="-ms-1" />
                        <Separator
                            orientation="vertical"
                            className="mx-2 data-[orientation=vertical]:h-4"
                        />
                        {activeItem && (
                            <h1 className="text-base font-medium">
                                {t(activeItem.titleKey)}
                            </h1>
                        )}
                        <div className="ms-auto flex items-center gap-1">
                            <LanguageSwitcher />
                            <ThemeToggle />
                        </div>
                    </div>
                </header>
                <div className="@container/main flex flex-1 flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
                    {!rolesReady && sidebarProps.variant === 'app' ? null : allowed ? children : <EmptyState icon={ShieldOff} title={ta('title')} description={ta('description')} />}
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
