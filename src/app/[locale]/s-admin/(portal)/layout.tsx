import type { ReactNode } from 'react'
import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { ROUTES } from '@/config/auth'
import { getAdminSession } from '@/lib/session'

export default async function SuperAdminLayout({ children }: { children: ReactNode }) {
    const locale = await getLocale()
    const session = await getAdminSession()

    // proxy.ts already guards this; server-side safety net.
    if (!session) return redirect({ href: ROUTES.superAdminLogin, locale })

    return (
        <AppShell variant="superAdmin" user={session}>
            {children}
        </AppShell>
    )
}
