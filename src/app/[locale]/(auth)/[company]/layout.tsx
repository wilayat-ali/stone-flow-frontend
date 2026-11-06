import type { ReactNode } from 'react'
import { CompanyTheme } from '@/components/shared/company-theme'
import { verifyCompany } from '@/features/auth/company'
import { getThemeChoice } from '@/lib/theme'

/**
 * Pages reached through a company's own link (login, accept invite, reset password) use that
 * company's default theme, whatever company the browser was last signed in to. A person's own
 * pick still wins.
 */
export default async function CompanyLayout({
    children,
    params,
}: {
    children: ReactNode
    params: Promise<{ company: string }>
}) {
    const { company } = await params
    const [check, choice] = await Promise.all([verifyCompany(company), getThemeChoice()])
    if (!check.ok) return children

    // Runs while the page is still being parsed, so the first paint already has the right colours.
    // The value is one of our fixed theme ids, never user input.
    const first = choice.personal ?? check.theme

    return (
        <>
            <script dangerouslySetInnerHTML={{ __html: `document.documentElement.dataset.theme=${JSON.stringify(first)}` }} />
            <CompanyTheme theme={check.theme} />
            {children}
        </>
    )
}
