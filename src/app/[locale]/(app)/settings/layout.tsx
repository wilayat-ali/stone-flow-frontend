import type { ReactNode } from 'react'
import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { ROUTES } from '@/config/auth'
import { canViewSettings } from '@/features/admin/roles'
import { SettingsShell } from '@/components/settings/settings-shell'
import { getActiveWorkspace } from '@/lib/session'

/** Settings are for Owner and Partner; everyone else goes back to the dashboard. */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
    const [workspace, locale] = await Promise.all([getActiveWorkspace(), getLocale()])
    if (!canViewSettings(workspace?.roleKey)) return redirect({ href: ROUTES.dashboard, locale })
    return <SettingsShell>{children}</SettingsShell>
}
