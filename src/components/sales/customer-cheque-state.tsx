'use client'

import { useTranslations } from 'next-intl'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import { customerChequeState, type CustomerCheque, type CustomerChequeState } from '@/features/customer-payments'

const tone: Record<CustomerChequeState, StatusTone> = {
    post_dated: 'info',
    due: 'warning',
    cleared: 'success',
    bounced: 'danger',
}

/** Where a customer's cheque stands: post-dated, due (deposit it now), cleared or bounced. */
export function CustomerChequeStateBadge({ cheque }: { cheque: Pick<CustomerCheque, 'status' | 'chequeDate'> }) {
    const t = useTranslations('sales.cheques.states')
    const state = customerChequeState(cheque)
    return <StatusBadge tone={tone[state]}>{t(state)}</StatusBadge>
}
