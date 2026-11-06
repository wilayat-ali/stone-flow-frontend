'use client'

import { BadgeCheck, Bell, ChevronsUpDown, LogOut } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar'
import { ROUTES } from '@/config/auth'
import { adminLogoutAction, logoutAction } from '@/features/auth/actions'
import { useDirection } from '@/hooks/use-direction'
import { generateInitials } from '@/lib/utils'

export type UserMenuProps = {
    user: { name: string; email: string }
    variant: 'app' | 'superAdmin'
}

function Identity({ name, email }: UserMenuProps['user']) {
    return (
        <>
            <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg">
                    {generateInitials(name)}
                </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-start text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs">{email}</span>
            </div>
        </>
    )
}

/** Based on the shadcn `sidebar-07` NavUser. */
export function UserMenu({ user, variant }: UserMenuProps) {
    const t = useTranslations('user')
    const tc = useTranslations('common')
    const router = useRouter()
    const { isMobile } = useSidebar()
    const { isRtl } = useDirection()

    const logout = async () => {
        if (variant === 'superAdmin') {
            await adminLogoutAction()
            router.replace(ROUTES.superAdminLogin)
        } else {
            await logoutAction()
            router.replace(ROUTES.login)
        }
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
                            <Identity {...user} />
                            <ChevronsUpDown className="ms-auto size-4" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                        side={isMobile ? 'bottom' : isRtl ? 'left' : 'right'}
                        align="end"
                        sideOffset={4}
                    >
                        <DropdownMenuLabel className="p-0 font-normal">
                            <div className="flex items-center gap-2 px-1 py-1.5 text-start text-sm">
                                <Identity {...user} />
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuItem>
                                <BadgeCheck />
                                {t('account')}
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <Bell />
                                {t('notifications')}
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={logout}>
                            <LogOut />
                            {tc('logout')}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}
