'use client'

import { useTranslations } from 'next-intl'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import type { PaymentState } from '@/features/sales'

const tone: Record<PaymentState, StatusTone> = { paid: 'success', partly: 'warning', udhaar: 'danger', cancelled: 'neutral' }

/** Paid, Partly paid, Udhaar (nothing paid) or Cancelled. */
export function PaymentStateBadge({ state }: { state: PaymentState }) {
    const t = useTranslations('sales.payState')
    return <StatusBadge tone={tone[state]}>{t(state)}</StatusBadge>
}
