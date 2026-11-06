import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'

export default async function Page() {
    return redirect({ href: '/settings/bank-cash', locale: await getLocale() })
}
