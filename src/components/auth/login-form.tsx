'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import type { z } from 'zod'
import { Link, useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { PasswordField, TextField } from '@/components/shared/form-fields'
import { ROUTES } from '@/config/auth'
import type { LoginResult } from '@/features/auth/login'
import { useAuthSchemas } from '@/features/auth/use-auth-schemas'
import { AuthCard } from './auth-card'

/** Login for one verified company; the company comes from the `/{company}/login` URL. */
export function LoginForm({ company, companyName }: { company: string; companyName: string }) {
    const t = useTranslations('auth')
    const router = useRouter()
    const schemas = useAuthSchemas()
    const [submitting, setSubmitting] = useState(false)

    const form = useForm<z.infer<typeof schemas.login>>({
        resolver: zodResolver(schemas.login),
        defaultValues: { identifier: '', password: '' },
    })

    const submit = async (values: z.infer<typeof schemas.login>) => {
        setSubmitting(true)
        let result: LoginResult = { ok: false, error: 'unavailable' }
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ company, ...values }),
            })
            result = await response.json()
        } catch {}
        if (!result.ok) {
            setSubmitting(false)
            toast.error(t(`login.errors.${result.error}`))
            return
        }
        router.replace(ROUTES.dashboard)
    }

    return (
        <AuthCard
            title={t('login.title')}
            description={t('login.description', { company: companyName })}
            footer={
                <>
                    {t('login.wrongCompany')}{' '}
                    <Link href={ROUTES.login} className="text-primary font-medium hover:underline">
                        {t('login.changeCompany')}
                    </Link>
                </>
            }
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
                    <TextField
                        control={form.control}
                        name="identifier"
                        label={t('identifier')}
                        placeholder={t('identifierPlaceholder')}
                        autoComplete="username"
                    />
                    <PasswordField
                        control={form.control}
                        name="password"
                        label={t('password')}
                        placeholder={t('passwordPlaceholder')}
                        showLabel={t('showPassword')}
                        hideLabel={t('hidePassword')}
                        labelAside={
                            <Link href={ROUTES.forgotPassword} className="text-muted-foreground text-sm hover:underline">
                                {t('login.forgot')}
                            </Link>
                        }
                    />
                    <Button type="submit" disabled={submitting}>
                        {submitting && <Loader2 className="animate-spin" />}
                        {t('login.submit')}
                    </Button>
                </form>
            </Form>
        </AuthCard>
    )
}
