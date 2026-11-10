'use client'

import { useTranslations } from 'next-intl'
import { errorCode } from '@/lib/client-api'

/**
 * Turns a failed Cash & Bank request into a sentence the user can act on, from the short code the
 * backend gives (`ACCOUNT_HAS_BALANCE`, `invalidDate`, ...). Unknown failures get a generic line.
 */
export function useErrorMessage() {
    const t = useTranslations('settings.bankCash.errors')

    return (error: unknown): string => {
        const code = errorCode(error)
        return code && t.has(code as never) ? t(code as never) : t('generic')
    }
}
