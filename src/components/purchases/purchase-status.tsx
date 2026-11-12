'use client'

import { useTranslations } from 'next-intl'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import type { PurchaseStatus } from '@/features/purchases'

const tone: Record<PurchaseStatus, StatusTone> = {
    pending: 'warning',
    in_stock: 'info',
    cutting: 'info',
    cut: 'success',
    rejected: 'danger',
    cancelled: 'neutral',
}

export function PurchaseStatusBadge({ status }: { status: PurchaseStatus }) {
    const t = useTranslations('purchases.statuses')
    return <StatusBadge tone={tone[status]}>{t(status)}</StatusBadge>
}
