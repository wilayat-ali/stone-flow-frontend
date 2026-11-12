'use client'

import { useTranslations } from 'next-intl'
import { errorCode } from '@/lib/client-api'

/** Turns a failed expense, bill payment or munshi cash request into a sentence from the short code the backend gives. */
export function useExpenseErrorMessage() {
    const t = useTranslations('expenses.errors')

    return (error: unknown): string => {
        const code = errorCode(error)
        return code && t.has(code as never) ? t(code as never) : t('generic')
    }
}
