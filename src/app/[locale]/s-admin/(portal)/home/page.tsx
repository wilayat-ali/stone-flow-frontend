import { getFormatter, getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard, StatCardGrid } from '@/components/shared/stat-card'

export default async function SuperAdminHomePage() {
    const t = await getTranslations('superAdmin.home')
    const tn = await getTranslations('nav')
    const tc = await getTranslations('common')
    const format = await getFormatter()

    return (
        <>
            <PageHeader title={t('title')} description={t('description')} />
            <StatCardGrid>
                <StatCard label={tn('workspaces')} value={format.number(128)} />
                <StatCard label={tn('users')} value={format.number(4096)} />
                <StatCard label={tc('active')} value={format.number(117)} />
            </StatCardGrid>
        </>
    )
}
