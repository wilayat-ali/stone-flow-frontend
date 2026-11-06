'use client'

import { useLocale } from 'next-intl'
import { localeDirection, type Locale } from '@/i18n/routing'

export function useDirection() {
    const locale = useLocale() as Locale
    const dir = localeDirection[locale]
    return { dir, isRtl: dir === 'rtl' }
}
