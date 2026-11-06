'use client'

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
import { ROUTES, companyLoginRoute } from '@/config/auth'
import { useAuthSchemas } from '@/features/auth/use-auth-schemas'
import { ApiError, request } from '@/lib/client-api'
import { AuthCard } from './auth-card'

/** A new person joins a company from an invite link: name and password, then they are signed in. */
export function AcceptInviteForm({
    token,
    company,
    companyName,
    roleName,
}: {
    token: string
    company: string
    companyName: string
    roleName: string | null
}) {
    const t = useTranslations('auth')
    const router = useRouter()
    const { acceptInvite } = useAuthSchemas()

    const form = useForm<z.infer<typeof acceptInvite>>({
        resolver: zodResolver(acceptInvite),
        defaultValues: { firstName: '', lastName: '', password: '', confirmPassword: '' },
    })

    const onSubmit = async ({ firstName, lastName, password }: z.infer<typeof acceptInvite>) => {
        try {
            await request('/api/auth/accept', { body: { token, firstName, lastName, password } })
        } catch (error) {
            const status = error instanceof ApiError ? error.status : 0
            toast.error(
                status === 409
                    ? t('invite.accountExists')
                    : status === 0 || status >= 500
                      ? t('link.unavailable')
                      : t('link.invalidDescription')
            )
            return
        }
        router.replace(ROUTES.dashboard)
    }

    const passwordProps = {
        showLabel: t('showPassword'),
        hideLabel: t('hidePassword'),
        placeholder: t('passwordPlaceholder'),
    }

    return (
        <AuthCard
            title={t('invite.title', { company: companyName })}
            description={
                roleName ? t('invite.description', { role: roleName }) : t('invite.descriptionNoRole')
            }
            footer={
                <>
                    {t('invite.haveAccount')}{' '}
                    <Link href={companyLoginRoute(company)} className="text-primary font-medium hover:underline">
                        {t('invite.logIn')}
                    </Link>
                </>
            }
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
                    <div className="grid grid-cols-2 gap-3">
                        <TextField
                            control={form.control}
                            name="firstName"
                            label={t('firstName')}
                            autoComplete="given-name"
                        />
                        <TextField
                            control={form.control}
                            name="lastName"
                            label={t('lastName')}
                            autoComplete="family-name"
                        />
                    </div>
                    <PasswordField control={form.control} name="password" label={t('password')} {...passwordProps} />
                    <PasswordField
                        control={form.control}
                        name="confirmPassword"
                        label={t('confirmPassword')}
                        {...passwordProps}
                    />
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                        {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
                        {t('invite.submit')}
                    </Button>
                </form>
            </Form>
        </AuthCard>
    )
}
