'use client'

import { useTranslations } from 'next-intl'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import { chequeState, type Cheque, type ChequeState } from '@/features/supplier-payments'

const tone: Record<ChequeState, StatusTone> = {
    issued: 'neutral',
    due: 'warning',
    confirm: 'danger',
    cleared: 'success',
    bounced: 'danger',
    cancelled: 'neutral',
}

/** Where a cheque stands. A cheque two days past its date shows "Did it clear?". */
export function ChequeStateBadge({ cheque }: { cheque: Cheque }) {
    const t = useTranslations('purchases.cheques.states')
    const state = chequeState(cheque)
    return <StatusBadge tone={tone[state]}>{t(state)}</StatusBadge>
}
