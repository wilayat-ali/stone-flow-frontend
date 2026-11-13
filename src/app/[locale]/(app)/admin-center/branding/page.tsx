import { cookies } from 'next/headers'
import { BrandingPage } from '@/components/admin/branding-page'
import { TOKEN_COOKIE } from '@/config/auth'
import { DEFAULT_THEME, isThemeId } from '@/config/themes'
import { api } from '@/lib/api'
import { getActiveWorkspace } from '@/lib/session'

export default async function Page() {
    // Who may open Branding is checked in the app shell, from the role's permissions; the backend enforces it too.
    const [workspace, store] = await Promise.all([getActiveWorkspace(), cookies()])

    const me = await api<{ company: { theme?: string | null } }>('/company/me', {
        token: store.get(TOKEN_COOKIE)?.value,
    })
    const saved = me.ok ? me.data.company.theme : null

    return <BrandingPage current={isThemeId(saved) ? saved : DEFAULT_THEME} companyName={workspace?.name ?? ''} />
}
