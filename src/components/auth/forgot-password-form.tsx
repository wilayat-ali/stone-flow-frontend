'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, MailCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { z } from 'zod'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { TextField } from '@/components/shared/form-fields'
import { ROUTES } from '@/config/auth'
import { useAuthSchemas } from '@/features/auth/use-auth-schemas'
import { AuthCard } from './auth-card'

export function ForgotPasswordForm() {
    const t = useTranslations('auth')
    const { forgot } = useAuthSchemas()
    const [sentTo, setSentTo] = useState<string | null>(null)

    const form = useForm<z.infer<typeof forgot>>({
        resolver: zodResolver(forgot),
        defaultValues: { email: '' },
    })

    const onSubmit = async (values: z.infer<typeof forgot>) => {
        await new Promise((resolve) => setTimeout(resolve, 700)) // mock API
        setSentTo(values.email)
    }

    const backToLogin = (
        <Link href={ROUTES.login} className="text-primary font-medium hover:underline">
            {t('forgot.backToLogin')}
        </Link>
    )

    if (sentTo) {
        return (
            <AuthCard
                title={t('forgot.sentTitle')}
                description={t('forgot.sentDescription', { email: sentTo })}
                footer={backToLogin}
            >
                <div className="bg-muted text-muted-foreground mx-auto flex size-14 items-center justify-center rounded-full">
                    <MailCheck className="size-7" aria-hidden />
                </div>
            </AuthCard>
        )
    }

    return (
        <AuthCard
            title={t('forgot.title')}
            description={t('forgot.description')}
            footer={backToLogin}
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
                    <TextField
                        control={form.control}
                        name="email"
                        label={t('email')}
                        type="email"
                        placeholder={t('emailPlaceholder')}
                    />
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                        {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
                        {t('forgot.submit')}
                    </Button>
                </form>
            </Form>
        </AuthCard>
    )
}
