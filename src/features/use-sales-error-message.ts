'use client'

import { useTranslations } from 'next-intl'
import { ApiError, errorCode } from '@/lib/client-api'

const withCount = ['NOT_AVAILABLE', 'NOT_AVAILABLE_INCHES', 'INSUFFICIENT_STOCK', 'INSUFFICIENT_INCHES', 'MORE_THAN_REMAINING', 'BELOW_COLLECTED', 'MORE_THAN_ORDER_REMAINING']

/**
 * Turns a failed bill, collection or order into a sentence. A refused quantity carries the number that
 * is really there ("Only 40 available. Make an Order for stone not ready yet").
 */
export function useSalesErrorMessage() {
    const t = useTranslations('sales.errors')

    return (error: unknown): string => {
        const code = errorCode(error)
        if (code && error instanceof ApiError && withCount.includes(code)) {
            const body = error.body as { available?: unknown; remaining?: unknown; collected?: unknown } | null
            const count = body?.available ?? body?.remaining ?? body?.collected
            if (typeof count === 'number' && t.has(code as never)) return (t as unknown as (key: string, values: Record<string, number>) => string)(code, { count })
        }
        return code && t.has(code as never) ? t(code as never) : t('generic')
    }
}
