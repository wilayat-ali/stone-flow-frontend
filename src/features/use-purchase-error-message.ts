'use client'

import { useTranslations } from 'next-intl'
import { errorCode } from '@/lib/client-api'

/** Turns a failed purchase request into a sentence from the short code the backend gives. */
export function usePurchaseErrorMessage() {
    const t = useTranslations('purchases.errors')

    return (error: unknown): string => {
        const code = errorCode(error)
        return code && t.has(code as never) ? t(code as never) : t('generic')
    }
}
