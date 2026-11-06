import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { ROUTES } from '@/config/auth'

/** Shown when a company name in the URL does not exist, or the server cannot be reached. */
export async function InvalidCompany({ unavailable = false }: { unavailable?: boolean }) {
    const t = await getTranslations('auth')

    return (
        <div className="flex flex-col items-center gap-2 text-center">
            <p>{unavailable ? t('login.errors.unavailable') : t('company.notFound')}</p>
            <Link href={ROUTES.login} className="text-primary text-sm font-medium hover:underline">
                {t('login.changeCompany')}
            </Link>
        </div>
    )
}
