'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import type { z } from 'zod'
import { useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { TextField } from '@/components/shared/form-fields'
import { companyLoginRoute } from '@/config/auth'
import type { CompanyCheck } from '@/features/auth/company'
import { useAuthSchemas } from '@/features/auth/use-auth-schemas'
import { AuthCard } from './auth-card'

/** Fallback entry when the user has no company link: verify it, then go to `/{company}/login`. */
export function CompanyForm() {
    const t = useTranslations('auth')
    const router = useRouter()
    const schemas = useAuthSchemas()
    const [checking, setChecking] = useState(false)

    const form = useForm<z.infer<typeof schemas.company>>({
        resolver: zodResolver(schemas.company),
        defaultValues: { company: '' },
    })

    const submit = async ({ company }: z.infer<typeof schemas.company>) => {
        setChecking(true)
        let result: CompanyCheck = { ok: false, error: 'unavailable' }
        try {
            const response = await fetch(`/api/auth/company?slug=${encodeURIComponent(company)}`)
            result = await response.json()
        } catch {}
        if (!result.ok) {
            setChecking(false)
            toast.error(
                result.error === 'invalid' ? t('company.invalid') : t('login.errors.unavailable')
            )
            return
        }
        router.push(companyLoginRoute(company))
    }

    return (
        <AuthCard title={t('company.title')} description={t('company.description')}>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
                    <TextField
                        control={form.control}
                        name="company"
                        label={t('company.label')}
                        placeholder={t('company.placeholder')}
                        autoComplete="organization"
                    />
                    <Button type="submit" disabled={checking}>
                        {checking && <Loader2 className="animate-spin" />}
                        {t('company.submit')}
                    </Button>
                </form>
            </Form>
        </AuthCard>
    )
}
