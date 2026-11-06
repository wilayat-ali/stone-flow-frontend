import { getLocale } from 'next-intl/server'
import { InvalidCompany } from '@/components/auth/invalid-company'
import { companyLoginRoute } from '@/config/auth'
import { verifyCompany } from '@/features/auth/company'
import { redirect } from '@/i18n/navigation'

/**
 * `/{company}` on its own: ask the API whether the company exists, then go to its login page,
 * or say the name is not valid. Nothing here guesses from the company used last time.
 */
export default async function CompanyRootPage({
    params,
}: {
    params: Promise<{ company: string }>
}) {
    const [{ company }, locale] = await Promise.all([params, getLocale()])
    const check = await verifyCompany(company)

    if (!check.ok) return <InvalidCompany unavailable={check.error === 'unavailable'} />
    return redirect({ href: companyLoginRoute(company), locale })
}
