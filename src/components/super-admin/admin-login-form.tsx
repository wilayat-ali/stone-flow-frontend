'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { z } from 'zod'
import { toast } from 'sonner'
import { useRouter } from '@/i18n/navigation'
import { AuthCard } from '@/components/auth/auth-card'
import { PasswordField, TextField } from '@/components/shared/form-fields'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { ROUTES } from '@/config/auth'
import type { LoginResult } from '@/features/auth/login'
import { useAuthSchemas } from '@/features/auth/use-auth-schemas'

export function AdminLoginForm() {
    const t = useTranslations('auth')
    const ts = useTranslations('superAdmin.login')
    const router = useRouter()
    const { adminLogin: login } = useAuthSchemas()

    const form = useForm<z.infer<typeof login>>({
        resolver: zodResolver(login),
        defaultValues: { email: '', password: '' },
    })

    const onSubmit = async (values: z.infer<typeof login>) => {
        let result: LoginResult = { ok: false, error: 'unavailable' }
        try {
            const response = await fetch('/api/s-admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            })
            result = await response.json()
        } catch {}
        if (!result.ok) {
            toast.error(t(`login.errors.${result.error}`))
            return
        }
        router.replace(ROUTES.superAdminHome)
    }

    return (
        <AuthCard title={ts('title')} description={ts('description')}>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
                    <TextField
                        control={form.control}
                        name="email"
                        label={t('email')}
                        type="email"
                        placeholder={t('emailPlaceholder')}
                    />
                    <PasswordField
                        control={form.control}
                        name="password"
                        label={t('password')}
                        placeholder={t('passwordPlaceholder')}
                        showLabel={t('showPassword')}
                        hideLabel={t('hidePassword')}
                    />
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                        {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
                        {t('login.submit')}
                    </Button>
                </form>
            </Form>
        </AuthCard>
    )
}
