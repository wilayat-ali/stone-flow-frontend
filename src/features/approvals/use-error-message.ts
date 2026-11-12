'use client'

import { useTranslations } from 'next-intl'
import { errorCode } from '@/lib/client-api'

/**
 * Turns a failed approve/reject into a sentence. When approving fails because the module's
 * re-validation did not pass (stock gone, bank short), the entry stays pending and the reason shows.
 */
export function useApprovalErrorMessage() {
    const t = useTranslations('approvals.errors')

    return (error: unknown): string => {
        const code = errorCode(error)
        return code && t.has(code as never) ? t(code as never) : t('generic')
    }
}
