'use client'

import { Check, ChevronsUpDown, Layers } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar'
import { selectWorkspaceAction } from '@/features/auth/actions'
import type { Workspace } from '@/features/workspace/data'
import { useDirection } from '@/hooks/use-direction'

/** Based on the shadcn `sidebar-07` TeamSwitcher. */
export function WorkspaceSwitcher({
    workspaces,
    activeId,
}: {
    workspaces: Workspace[]
    activeId: string
}) {
    const t = useTranslations('workspace')
    const router = useRouter()
    const { isMobile } = useSidebar()
    const { isRtl } = useDirection()
    const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0]

    const select = async (id: string) => {
        await selectWorkspaceAction(id)
        router.refresh()
    }

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                        >
                            <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                                <Layers className="size-4" />
                            </div>
                            <div className="grid flex-1 text-start text-sm leading-tight">
                                <span className="truncate font-medium">
                                    {active.name}
                                </span>
                                <span className="truncate text-xs">
                                    {active.roleName}
                                </span>
                            </div>
                            <ChevronsUpDown className="ms-auto" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                        align="start"
                        side={isMobile ? 'bottom' : isRtl ? 'left' : 'right'}
                        sideOffset={4}
                    >
                        <DropdownMenuLabel className="text-muted-foreground text-xs">
                            {t('switcher')}
                        </DropdownMenuLabel>
                        {workspaces.map((workspace) => (
                            <DropdownMenuItem
                                key={workspace.id}
                                onClick={() => select(workspace.id)}
                                className="gap-2 p-2"
                            >
                                <div className="flex size-6 items-center justify-center rounded-md border">
                                    <Layers className="size-3.5 shrink-0" />
                                </div>
                                {workspace.name}
                                {workspace.id === active.id && (
                                    <Check className="ms-auto size-4" />
                                )}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}
