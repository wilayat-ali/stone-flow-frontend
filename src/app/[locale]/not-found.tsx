import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/config/auth'

export default function NotFound() {
    const t = useTranslations('common')

    return (
        <div className="flex min-h-svh items-center justify-center">
            <EmptyState
                title={t('notFound')}
                description={t('notFoundDescription')}
                action={
                    <Button asChild>
                        <Link href={ROUTES.dashboard}>{t('goHome')}</Link>
                    </Button>
                }
            />
        </div>
    )
}
