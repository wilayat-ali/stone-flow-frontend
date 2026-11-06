import { getTranslations } from 'next-intl/server'
import { AdminLoginForm } from '@/components/super-admin/admin-login-form'
import { Brand } from '@/components/layout/brand'
import { LanguageSwitcher } from '@/components/layout/language-switcher'
import { ThemeToggle } from '@/components/layout/theme-toggle'

export default async function SuperAdminLoginPage() {
    const t = await getTranslations('common')

    return (
        <div className="flex min-h-svh flex-col gap-4 p-6 md:p-10">
            <div className="flex items-center justify-between">
                <Brand name={t('appName')} />
                <div className="flex items-center gap-1">
                    <LanguageSwitcher />
                    <ThemeToggle />
                </div>
            </div>
            <div className="flex flex-1 items-center justify-center">
                <div className="w-full max-w-sm">
                    <AdminLoginForm />
                </div>
            </div>
        </div>
    )
}
