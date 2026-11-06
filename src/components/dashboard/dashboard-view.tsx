'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { StatCard, StatCardGrid } from '@/components/shared/stat-card'
import { documents } from '@/features/dashboard/documents'
import { ChartAreaInteractive } from './chart-area-interactive'
import { DocumentsTable } from './documents-table'

/** Dashboard page composition from the shadcn dashboard-01 block. */
export function DashboardView() {
    const t = useTranslations('dashboard')
    const format = useFormatter()

    const percent = (value: number, sign = true) =>
        format.number(value / 100, {
            style: 'percent',
            maximumFractionDigits: 1,
            signDisplay: sign ? 'exceptZero' : 'auto',
        })

    return (
        <>
            <StatCardGrid>
                <StatCard
                    label={t('stats.revenue')}
                    value={format.number(1250, { style: 'currency', currency: 'USD' })}
                    trend={{ value: percent(12.5), direction: 'up' }}
                    footer={t('stats.revenueFooter')}
                    note={t('stats.revenueNote')}
                />
                <StatCard
                    label={t('stats.customers')}
                    value={format.number(1234)}
                    trend={{ value: percent(-20), direction: 'down' }}
                    footer={t('stats.customersFooter')}
                    note={t('stats.customersNote')}
                />
                <StatCard
                    label={t('stats.accounts')}
                    value={format.number(45678)}
                    trend={{ value: percent(12.5), direction: 'up' }}
                    footer={t('stats.accountsFooter')}
                    note={t('stats.accountsNote')}
                />
                <StatCard
                    label={t('stats.growth')}
                    value={percent(4.5, false)}
                    trend={{ value: percent(4.5), direction: 'up' }}
                    footer={t('stats.growthFooter')}
                    note={t('stats.growthNote')}
                />
            </StatCardGrid>
            <ChartAreaInteractive />
            <DocumentsTable data={documents} />
        </>
    )
}
