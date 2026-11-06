'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import type { z } from 'zod'
import { useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { PasswordField } from '@/components/shared/form-fields'
import { companyLoginRoute } from '@/config/auth'
import { useAuthSchemas } from '@/features/auth/use-auth-schemas'
import { request } from '@/lib/client-api'
import { AuthCard } from './auth-card'

/** Sets a new password from a reset link an administrator shared (`/{company}/reset-password?token=…`). */
export function SetPasswordForm({ company, token }: { company: string; token: string }) {
    const t = useTranslations('auth')
    const router = useRouter()
    const { setPassword } = useAuthSchemas()

    const form = useForm<z.infer<typeof setPassword>>({
        resolver: zodResolver(setPassword),
        defaultValues: { password: '', confirmPassword: '' },
    })

    const onSubmit = async ({ password }: z.infer<typeof setPassword>) => {
        let ok = false
        try {
            await request('/api/auth/reset', { body: { token, password } })
            ok = true
        } catch {}
        if (!ok) {
            toast.error(t('link.invalidDescription'))
            return
        }
        toast.success(t('setPassword.success'))
        router.replace(companyLoginRoute(company))
    }

    const passwordProps = {
        showLabel: t('showPassword'),
        hideLabel: t('hidePassword'),
        placeholder: t('passwordPlaceholder'),
    }

    return (
        <AuthCard title={t('setPassword.title')} description={t('setPassword.description')}>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
                    <PasswordField control={form.control} name="password" label={t('password')} {...passwordProps} />
                    <PasswordField
                        control={form.control}
                        name="confirmPassword"
                        label={t('confirmPassword')}
                        {...passwordProps}
                    />
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                        {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
                        {t('setPassword.submit')}
                    </Button>
                </form>
            </Form>
        </AuthCard>
    )
}
