import type { ReactNode } from 'react'
import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { ROUTES } from '@/config/auth'
import { canViewAdmin } from '@/features/admin/roles'
import { getActiveWorkspace } from '@/lib/session'

/** Administration is for Owner, Partner and Manager; everyone else goes back to the dashboard. */
export default async function AdminCenterLayout({ children }: { children: ReactNode }) {
    const [workspace, locale] = await Promise.all([getActiveWorkspace(), getLocale()])
    if (!canViewAdmin(workspace?.roleKey)) return redirect({ href: ROUTES.dashboard, locale })
    return children
}
