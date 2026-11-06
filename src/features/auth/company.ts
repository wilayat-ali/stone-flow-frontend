import 'server-only'

import { cache } from 'react'
import { COMPANY_SLUG_PATTERN } from '@/config/auth'
import { DEFAULT_THEME, isThemeId, type ThemeId } from '@/config/themes'
import { api } from '@/lib/api'

export type CompanyCheck =
    | { ok: true; name: string; theme: ThemeId }
    | { ok: false; error: 'invalid' | 'unavailable' }

/** Public check (GET /workspaces/verify) that a company exists and is active. */
export const verifyCompany = cache(async (slug: string): Promise<CompanyCheck> => {
    if (!COMPANY_SLUG_PATTERN.test(slug)) return { ok: false, error: 'invalid' }

    const result = await api<{ name: string; status: string; theme?: string | null }>(
        `/workspaces/verify?slug=${encodeURIComponent(slug)}`
    )
    if (!result.ok) {
        return { ok: false, error: result.status === 404 ? 'invalid' : 'unavailable' }
    }
    if (result.data.status !== 'active') return { ok: false, error: 'invalid' }
    const theme = result.data.theme
    return { ok: true, name: result.data.name, theme: isThemeId(theme) ? theme : DEFAULT_THEME }
})
