import type { ReactNode } from 'react'
import { redirect } from '@/i18n/navigation'
import { getLocale } from 'next-intl/server'
import { AppShell } from '@/components/layout/app-shell'
import { CompanyTheme } from '@/components/shared/company-theme'
import { ROUTES } from '@/config/auth'
import { listWorkspaces } from '@/features/workspace/data'
import { getAccess } from '@/lib/access'
import { getActiveWorkspace, getSession } from '@/lib/session'
import { getCompanyTheme } from '@/lib/theme'

export default async function AppLayout({ children }: { children: ReactNode }) {
    const locale = await getLocale()
    const [session, workspace, workspaces, companyTheme, access] = await Promise.all([
        getSession(),
        getActiveWorkspace(),
        listWorkspaces(),
        getCompanyTheme(),
        getAccess(),
    ])

    // proxy.ts already guards these; this is the server-side safety net.
    if (!session) return redirect({ href: ROUTES.login, locale })
    if (!workspace) return redirect({ href: ROUTES.selectWorkspace, locale })

    return (
        <AppShell
            variant="app"
            user={session}
            workspaces={workspaces}
            activeWorkspaceId={workspace.id}
            roleKey={workspace.roleKey}
            access={access}
        >
            <CompanyTheme theme={companyTheme} />
            {children}
        </AppShell>
    )
}
