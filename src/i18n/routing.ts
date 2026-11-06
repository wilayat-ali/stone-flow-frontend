import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
    locales: ['en', 'ur'],
    defaultLocale: 'en',
    localePrefix: 'always',
})

export type Locale = (typeof routing.locales)[number]

export const localeDirection: Record<Locale, 'ltr' | 'rtl'> = {
    en: 'ltr',
    ur: 'rtl',
}

export const localeLabel: Record<Locale, string> = {
    en: 'English',
    ur: 'اردو',
}
