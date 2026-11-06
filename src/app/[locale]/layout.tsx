import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Noto_Naskh_Arabic } from 'next/font/google'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getThemeChoice } from '@/lib/theme'
import { AppProviders } from '@/providers/app-providers'
import { ColorThemeProvider } from '@/providers/color-theme-provider'
import { localeDirection, routing } from '@/i18n/routing'
import '../globals.css'

const urdu = Noto_Naskh_Arabic({
    variable: '--font-urdu',
    subsets: ['arabic'],
    display: 'swap',
})

export function generateStaticParams() {
    return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>
}): Promise<Metadata> {
    const { locale } = await params
    if (!hasLocale(routing.locales, locale)) return {}
    const t = await getTranslations({ locale, namespace: 'common' })
    return {
        title: { default: t('appName'), template: `%s | ${t('appName')}` },
    }
}

export default async function LocaleLayout({
    children,
    params,
}: {
    children: ReactNode
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params
    if (!hasLocale(routing.locales, locale)) notFound()
    setRequestLocale(locale)

    const dir = localeDirection[locale]
    const theme = await getThemeChoice()

    return (
        <html
            lang={locale}
            dir={dir}
            data-theme={theme.active}
            className={urdu.variable}
            suppressHydrationWarning
        >
            <body className="antialiased">
                <NextIntlClientProvider>
                    <ColorThemeProvider personal={theme.personal} company={theme.company}>
                        <AppProviders dir={dir}>{children}</AppProviders>
                    </ColorThemeProvider>
                </NextIntlClientProvider>
            </body>
        </html>
    )
}
