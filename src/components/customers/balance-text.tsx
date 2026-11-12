'use client'

import { useTranslations } from 'next-intl'
import { useMoney } from '@/hooks/use-money'
import { cn } from '@/lib/utils'

/** What a customer owes (red), or the advance they paid ahead (green); settled reads as a muted word. */
export function BalanceText({ balance, className }: { balance: number; className?: string }) {
    const t = useTranslations('customers')
    const money = useMoney()

    if (balance === 0) return <span className="text-muted-foreground">{t('settled')}</span>

    return (
        <span className={cn('flex flex-col tabular-nums', className)}>
            <bdi className={cn('font-medium', balance > 0 ? 'text-destructive' : 'text-success')}>{money(Math.abs(balance))}</bdi>
            <span className="text-muted-foreground text-xs">{balance > 0 ? t('owes') : t('advance')}</span>
        </span>
    )
}
