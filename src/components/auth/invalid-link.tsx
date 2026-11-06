import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { ROUTES } from '@/config/auth'

/** Shown when an invite or reset link is invalid, used or expired (or the server is down). */
export async function InvalidLink({ unavailable = false }: { unavailable?: boolean }) {
    const t = await getTranslations('auth')

    return (
        <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-xl font-semibold">{unavailable ? t('link.unavailable') : t('link.invalidTitle')}</h1>
            {!unavailable && <p className="text-muted-foreground text-sm">{t('link.invalidDescription')}</p>}
            <Link href={ROUTES.login} className="text-primary text-sm font-medium hover:underline">
                {t('login.changeCompany')}
            </Link>
        </div>
    )
}
