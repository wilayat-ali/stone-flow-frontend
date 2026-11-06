import { cookies } from 'next/headers'
import { getLocale } from 'next-intl/server'
import { BrandingPage } from '@/components/admin/branding-page'
import { ROUTES, TOKEN_COOKIE } from '@/config/auth'
import { DEFAULT_THEME, isThemeId } from '@/config/themes'
import { canManageMembers } from '@/features/admin/roles'
import { redirect } from '@/i18n/navigation'
import { api } from '@/lib/api'
import { getActiveWorkspace } from '@/lib/session'

export default async function Page() {
    const [workspace, locale, store] = await Promise.all([getActiveWorkspace(), getLocale(), cookies()])

    // Branding is for the owner and partners; the backend enforces it too.
    if (!canManageMembers(workspace?.roleKey)) return redirect({ href: ROUTES.dashboard, locale })

    const me = await api<{ company: { theme?: string | null } }>('/company/me', {
        token: store.get(TOKEN_COOKIE)?.value,
    })
    const saved = me.ok ? me.data.company.theme : null

    return <BrandingPage current={isThemeId(saved) ? saved : DEFAULT_THEME} companyName={workspace?.name ?? ''} />
}
