'use client'

import { useTranslations } from 'next-intl'
import { useMoney } from '@/hooks/use-money'
import { cn } from '@/lib/utils'

/** What we owe a supplier, or the advance we paid them; settled shows a dash. */
export function BalanceText({ balance, className }: { balance: number; className?: string }) {
    const t = useTranslations('suppliers')
    const money = useMoney()

    if (balance === 0) return <span className="text-muted-foreground">{t('settled')}</span>

    return (
        <span className={cn('flex flex-col tabular-nums', className)}>
            <bdi className={cn('font-medium', balance > 0 ? 'text-destructive' : 'text-success')}>
                {money(Math.abs(balance))}
            </bdi>
            <span className="text-muted-foreground text-xs">{balance > 0 ? t('owed') : t('advance')}</span>
        </span>
    )
}
