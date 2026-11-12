'use client'

import { useTranslations } from 'next-intl'
import { ApiError, errorCode } from '@/lib/client-api'

/**
 * Turns a failed production entry into a sentence. A refused input carries how much is really in
 * stock (`{ code: 'INSUFFICIENT_STOCK', available: 40, what: '14 soot 12x24' }`).
 */
export function useEntryErrorMessage() {
    const t = useTranslations('production.entries.errors')

    return (error: unknown): string => {
        const code = errorCode(error)
        if (error instanceof ApiError && (code === 'INSUFFICIENT_STOCK' || code === 'INSUFFICIENT_INCHES' || code === 'REVERSE_NEGATIVE')) {
            const body = error.body as { available?: unknown; what?: unknown } | null
            if (typeof body?.available === 'number') {
                return t(code, { count: body.available, what: typeof body.what === 'string' ? body.what : '' })
            }
        }
        return code && t.has(code as never) ? t(code as never) : t('generic')
    }
}
