import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { ROUTES } from '@/config/auth'

export default async function HomePage() {
    const locale = await getLocale()
    return redirect({ href: ROUTES.dashboard, locale })
}
