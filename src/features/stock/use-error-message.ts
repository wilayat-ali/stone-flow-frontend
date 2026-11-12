'use client'

import { useTranslations } from 'next-intl'
import { ApiError, errorCode } from '@/lib/client-api'

/**
 * Turns a failed stock request into a sentence. A refused movement carries how much is really in
 * stock (`{ code: 'INSUFFICIENT_STOCK', available: 40 }`), shown as "Only 40 pieces in stock".
 */
export function useStockErrorMessage() {
    const t = useTranslations('stock.errors')

    return (error: unknown): string => {
        const code = errorCode(error)
        if (code === 'INSUFFICIENT_STOCK' && error instanceof ApiError) {
            const available = (error.body as { available?: unknown } | null)?.available
            if (typeof available === 'number') return t('insufficient', { count: available })
        }
        return code && t.has(code as never) ? t(code as never) : t('generic')
    }
}
