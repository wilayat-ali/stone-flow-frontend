'use client'

import { useTranslations } from 'next-intl'
import { ApiError, errorCode } from '@/lib/client-api'

/** Turns a failed stock entry into a sentence. A refused removal says how much is really in stock. */
export function useInventoryErrorMessage() {
    const t = useTranslations('inventory.errors')

    return (error: unknown): string => {
        const code = errorCode(error)
        if (error instanceof ApiError && (code === 'INSUFFICIENT_STOCK' || code === 'INSUFFICIENT_INCHES')) {
            const available = (error.body as { available?: unknown } | null)?.available
            if (typeof available === 'number') return t(code, { count: available })
        }
        return code && t.has(code as never) ? t(code as never) : t('generic')
    }
}
